/**
 * Recurring-route detection and commute intelligence.
 *
 * Pure aggregation over drive records so the page math can be unit-tested
 * without Postgres. The DB layer is responsible for turning TeslaMate rows
 * into `RouteDriveInput` (including estimated energy cost).
 */

export type RouteDriveInput = {
  id: number;
  /** ISO timestamp of the drive start. */
  startDate: string;
  startLabel: string | null;
  endLabel: string | null;
  distanceKm: number | null;
  durationMin: number | null;
  /** Drive efficiency in Wh/km, when the car/range data allows it. */
  efficiencyWhPerKm: number | null;
  /** Estimated cost for this drive, when an energy price is known. */
  cost: number | null;
};

export type RouteOutlierMetric = "distance" | "duration" | "efficiency" | "cost";

export type RouteOutlier = {
  driveId: number;
  startDate: string;
  metric: RouteOutlierMetric;
  value: number;
  /** Route median for this metric. */
  expected: number;
  /** Absolute deviation from the median, in percent. */
  deviationPct: number;
  direction: "high" | "low";
};

export type RecurringRoute = {
  key: string;
  startLabel: string;
  endLabel: string;
  /** Drives on this exact start → end pair. */
  count: number;
  /** Unique UTC calendar days with at least one drive. */
  distinctDays: number;
  /** Share of drives that started Monday–Friday (UTC). */
  weekdayShare: number;
  /** Frequent weekday route — a reasonable commute candidate. */
  isCommute: boolean;
  avgDistanceKm: number;
  totalDistanceKm: number;
  avgDurationMin: number | null;
  /** Distance-weighted Wh/km across drives that have an efficiency value. */
  avgEfficiencyWhPerKm: number | null;
  /** Mean cost per drive across drives that have a cost. */
  avgCost: number | null;
  /** Sum of known drive costs; null when no drive has a cost. */
  totalCost: number | null;
  lastDriveAt: string;
  outliers: RouteOutlier[];
  /** Unique drives with at least one flagged metric. */
  outlierDrives: number;
};

export type RecurringRoutesSummary = {
  /** All input drives, including ones filtered out of route grouping. */
  drives: number;
  /** Drives that belong to a recurring route. */
  matchedDrives: number;
  routes: number;
  commuteRoutes: number;
  outlierDrives: number;
  /** Outlier drives as a share of matched drives. */
  outlierSharePct: number | null;
};

export type RecurringRoutes = {
  routes: RecurringRoute[];
  summary: RecurringRoutesSummary;
};

export type BuildRecurringRoutesOptions = {
  /** Minimum drives on a start/end pair before it counts as recurring. */
  minCount?: number;
  /** Relative deviation from the route median that flags an outlier. */
  outlierPct?: number;
  /** Weekday share needed for a route to be marked as a commute. */
  commuteWeekdayShare?: number;
  /** Distinct days needed for a route to be marked as a commute. */
  commuteMinDays?: number;
  /** Maximum routes returned, after sorting. */
  maxRoutes?: number;
};

export const RECURRING_ROUTE_DEFAULTS = {
  minCount: 3,
  outlierPct: 25,
  commuteWeekdayShare: 0.6,
  commuteMinDays: 5,
  maxRoutes: 20,
} as const;

/** TeslaMate's placeholder for an address it could not resolve. */
const UNKNOWN_LABELS = new Set(["", "unknown", "unknown location", "unknown place"]);

function cleanLabel(label: string | null | undefined): string | null {
  if (label == null) return null;
  const trimmed = label.trim().replace(/\s+/g, " ");
  if (UNKNOWN_LABELS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

/** Grouping key: case- and whitespace-insensitive start → end pair. */
export function routeKey(startLabel: string, endLabel: string): string {
  const start = startLabel.trim().toLowerCase().replace(/\s+/g, " ");
  const end = endLabel.trim().toLowerCase().replace(/\s+/g, " ");
  return `${start}\u0000${end}`;
}

const round = (v: number, places: number) => {
  const p = 10 ** places;
  return Math.round(v * p) / p;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

/** Monday–Friday in UTC. */
function isWeekday(iso: string): boolean {
  const day = new Date(iso).getUTCDay();
  return day >= 1 && day <= 5;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

type MetricSpec = {
  metric: RouteOutlierMetric;
  value: (drive: RouteDriveInput) => number | null;
  places: number;
};

const METRICS: MetricSpec[] = [
  { metric: "distance", value: (d) => d.distanceKm, places: 1 },
  { metric: "duration", value: (d) => d.durationMin, places: 0 },
  { metric: "efficiency", value: (d) => d.efficiencyWhPerKm, places: 0 },
  { metric: "cost", value: (d) => d.cost, places: 2 },
];

function findOutliers(
  drives: RouteDriveInput[],
  outlierPct: number,
  minCount: number,
): RouteOutlier[] {
  if (drives.length < Math.max(3, minCount)) return [];
  const outliers: RouteOutlier[] = [];

  for (const spec of METRICS) {
    const samples = drives.flatMap((drive) => {
      const value = spec.value(drive);
      return value !== null && Number.isFinite(value) ? [{ drive, value }] : [];
    });
    if (samples.length < Math.max(3, minCount)) continue;

    const expected = median(samples.map((s) => s.value));
    if (!(expected > 0)) continue;

    for (const { drive, value } of samples) {
      const deviationPct = (Math.abs(value - expected) / expected) * 100;
      if (deviationPct < outlierPct) continue;
      outliers.push({
        driveId: drive.id,
        startDate: drive.startDate,
        metric: spec.metric,
        value: round(value, spec.places),
        expected: round(expected, spec.places),
        deviationPct: round(deviationPct, 0),
        direction: value >= expected ? "high" : "low",
      });
    }
  }

  return outliers.sort((a, b) => b.deviationPct - a.deviationPct);
}

function buildRoute(
  key: string,
  startLabel: string,
  endLabel: string,
  drives: RouteDriveInput[],
  options: Required<Pick<BuildRecurringRoutesOptions, "outlierPct" | "minCount" | "commuteWeekdayShare" | "commuteMinDays">>,
): RecurringRoute {
  const distances = drives.flatMap((d) => (d.distanceKm !== null ? [d.distanceKm] : []));
  const durations = drives.flatMap((d) => (d.durationMin !== null ? [d.durationMin] : []));
  const costs = drives.flatMap((d) => (d.cost !== null ? [d.cost] : []));

  const weighted = drives.flatMap((d) =>
    d.efficiencyWhPerKm !== null && d.distanceKm !== null && d.distanceKm > 0
      ? [{ efficiency: d.efficiencyWhPerKm, distance: d.distanceKm }]
      : [],
  );
  const weightedDistance = weighted.reduce((sum, w) => sum + w.distance, 0);
  const avgEfficiencyWhPerKm =
    weightedDistance > 0
      ? round(
          weighted.reduce((sum, w) => sum + w.efficiency * w.distance, 0) / weightedDistance,
          0,
        )
      : null;

  const days = new Set(drives.map((d) => utcDay(d.startDate)));
  const weekdayShare =
    drives.length > 0 ? drives.filter((d) => isWeekday(d.startDate)).length / drives.length : 0;
  const outliers = findOutliers(drives, options.outlierPct, options.minCount);
  const outlierDrives = new Set(outliers.map((o) => o.driveId)).size;
  const lastDriveAt = drives.reduce(
    (latest, d) => (d.startDate > latest ? d.startDate : latest),
    drives[0].startDate,
  );
  const totalDistanceKm = round(distances.reduce((sum, v) => sum + v, 0), 1);
  const totalCost = costs.length > 0 ? round(costs.reduce((sum, v) => sum + v, 0), 2) : null;
  const avgCost = costs.length > 0 ? round(costs.reduce((sum, v) => sum + v, 0) / costs.length, 2) : null;
  const avgDurationMin = mean(durations);

  return {
    key,
    startLabel,
    endLabel,
    count: drives.length,
    distinctDays: days.size,
    weekdayShare: round(weekdayShare, 2),
    isCommute: days.size >= options.commuteMinDays && weekdayShare >= options.commuteWeekdayShare,
    avgDistanceKm: round(mean(distances) ?? 0, 1),
    totalDistanceKm,
    avgDurationMin: avgDurationMin === null ? null : round(avgDurationMin, 0),
    avgEfficiencyWhPerKm,
    avgCost,
    totalCost,
    lastDriveAt,
    outliers,
    outlierDrives,
  };
}

/**
 * Groups drives into recurring start/end pairs, ranks them by frequency, and
 * flags drives that deviate from their route's own median.
 */
export function buildRecurringRoutes(
  drives: readonly RouteDriveInput[],
  options: BuildRecurringRoutesOptions = {},
): RecurringRoutes {
  const minCount = Math.max(2, Math.trunc(options.minCount ?? RECURRING_ROUTE_DEFAULTS.minCount));
  const outlierPct = Math.max(1, options.outlierPct ?? RECURRING_ROUTE_DEFAULTS.outlierPct);
  const commuteWeekdayShare =
    options.commuteWeekdayShare ?? RECURRING_ROUTE_DEFAULTS.commuteWeekdayShare;
  const commuteMinDays = Math.max(
    1,
    Math.trunc(options.commuteMinDays ?? RECURRING_ROUTE_DEFAULTS.commuteMinDays),
  );
  const maxRoutes = Math.max(1, Math.trunc(options.maxRoutes ?? RECURRING_ROUTE_DEFAULTS.maxRoutes));

  const groups = new Map<
    string,
    { startLabel: string; endLabel: string; drives: RouteDriveInput[] }
  >();

  for (const drive of drives) {
    const startLabel = cleanLabel(drive.startLabel);
    const endLabel = cleanLabel(drive.endLabel);
    if (!startLabel || !endLabel) continue;
    if (drive.distanceKm === null || !(drive.distanceKm > 0.1)) continue;

    const key = routeKey(startLabel, endLabel);
    const group = groups.get(key);
    if (group) {
      group.drives.push(drive);
    } else {
      groups.set(key, { startLabel, endLabel, drives: [drive] });
    }
  }

  const routes = [...groups.entries()]
    .filter(([, group]) => group.drives.length >= minCount)
    .map(([key, group]) =>
      buildRoute(key, group.startLabel, group.endLabel, group.drives, {
        outlierPct,
        minCount,
        commuteWeekdayShare,
        commuteMinDays,
      }),
    )
    .sort((a, b) => {
      const byCount = b.count - a.count;
      if (byCount !== 0) return byCount;
      const byDistance = b.totalDistanceKm - a.totalDistanceKm;
      if (byDistance !== 0) return byDistance;
      return a.key.localeCompare(b.key);
    })
    .slice(0, maxRoutes);

  const matchedDrives = routes.reduce((sum, route) => sum + route.count, 0);
  const outlierDrives = routes.reduce((sum, route) => sum + route.outlierDrives, 0);

  return {
    routes,
    summary: {
      drives: drives.length,
      matchedDrives,
      routes: routes.length,
      commuteRoutes: routes.filter((route) => route.isCommute).length,
      outlierDrives,
      outlierSharePct:
        matchedDrives > 0 ? round((outlierDrives / matchedDrives) * 100, 0) : null,
    },
  };
}
