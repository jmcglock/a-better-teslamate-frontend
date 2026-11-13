/**
 * Software-update impact: compare the car's behaviour before and after each
 * install. Samples on both sides are restricted to a shared outside-temperature
 * band so seasonal swings do not masquerade as a software regression.
 *
 * Pure module so the window and matching math is testable without Postgres.
 */

export const DAY_MS = 86_400_000;

export type ImpactMetricKey = "efficiency" | "range" | "dcSpeed" | "standbyDrain";

export const IMPACT_METRIC_KEYS: readonly ImpactMetricKey[] = [
  "efficiency",
  "range",
  "dcSpeed",
  "standbyDrain",
];

export type ImpactSample = {
  /** ISO timestamp for the sample (drive start, charge start, parked-gap midpoint). */
  at: string;
  /** Outside temperature in °C, when TeslaMate recorded one. */
  tempC: number | null;
  /** Metric value in its natural unit (Wh/km, km, kW, %/day). */
  value: number;
  /** Optional weight (distance, energy, hours). Defaults to 1. */
  weight?: number;
};

export type ImpactSamples = Record<ImpactMetricKey, readonly ImpactSample[]>;

export type UpdateEvent = {
  id: number;
  version: string;
  /** ISO timestamp when the install completed (fallback: install start). */
  installedAt: string;
};

export type ImpactOptions = {
  beforeDays: number;
  afterDays: number;
  /** Half-width of the shared temperature band in °C. */
  tempToleranceC: number;
  /** Matched samples needed per side before a comparison is flagged low-confidence. */
  minSamples: number;
};

export const DEFAULT_IMPACT_OPTIONS: ImpactOptions = {
  beforeDays: 90,
  afterDays: 90,
  tempToleranceC: 5,
  minSamples: 3,
};

export type TempMatch = "matched" | "no-overlap" | "unavailable" | "empty";

export type TempBand = { minC: number; maxC: number };

export type ImpactMetric = {
  /** Weighted mean before the install, or null when no sample matched. */
  before: number | null;
  /** Weighted mean after the install, or null when no sample matched. */
  after: number | null;
  /** after - before in the metric's unit. */
  delta: number | null;
  /** Relative change, percent of before. */
  deltaPct: number | null;
  /** Matched sample counts (after temperature filtering). */
  beforeSamples: number;
  afterSamples: number;
  /** Raw sample counts inside the time windows, before temperature filtering. */
  beforeTotal: number;
  afterTotal: number;
  lowSample: boolean;
  tempMatch: TempMatch;
  tempBand: TempBand | null;
};

export type ImpactWindow = { start: string; end: string };

export type VersionImpact = {
  id: number;
  version: string;
  installedAt: string;
  previousVersion: string | null;
  nextVersion: string | null;
  /** Before window, clamped at the previous install. */
  before: ImpactWindow;
  /** After window, clamped at the next install. */
  after: ImpactWindow;
  metrics: Record<ImpactMetricKey, ImpactMetric>;
};

const PRECISION: Record<ImpactMetricKey, number> = {
  efficiency: 0,
  range: 1,
  dcSpeed: 1,
  standbyDrain: 2,
};

function round(v: number, places: number): number {
  const p = 10 ** places;
  return Math.round(v * p) / p;
}

function isNum(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function weightedMean(samples: readonly ImpactSample[]): number | null {
  let sum = 0;
  let total = 0;
  for (const sample of samples) {
    if (!isNum(sample.value)) continue;
    const weight = sample.weight === undefined ? 1 : sample.weight;
    if (!isNum(weight) || weight <= 0) continue;
    sum += sample.value * weight;
    total += weight;
  }
  return total > 0 ? sum / total : null;
}

function temperatures(samples: readonly ImpactSample[]): number[] {
  return samples.flatMap((sample) => (isNum(sample.tempC) ? [sample.tempC] : []));
}

type MatchResult = {
  before: ImpactSample[];
  after: ImpactSample[];
  tempBand: TempBand | null;
  tempMatch: TempMatch;
};

/**
 * Restrict both sides to the overlap of their temperature ranges, narrowed to
 * +/- tolerance around the centre. Empty overlap means the two windows cannot
 * be compared honestly, so the metric is left blank instead of showing noise.
 */
function matchByTemperature(
  before: readonly ImpactSample[],
  after: readonly ImpactSample[],
  toleranceC: number,
): MatchResult {
  if (before.length === 0 || after.length === 0) {
    return { before: [], after: [], tempBand: null, tempMatch: "empty" };
  }

  const beforeTemps = temperatures(before);
  const afterTemps = temperatures(after);
  if (beforeTemps.length === 0 || afterTemps.length === 0) {
    return { before: [...before], after: [...after], tempBand: null, tempMatch: "unavailable" };
  }

  const low = Math.max(Math.min(...beforeTemps), Math.min(...afterTemps));
  const high = Math.min(Math.max(...beforeTemps), Math.max(...afterTemps));
  if (low > high) {
    return { before: [], after: [], tempBand: null, tempMatch: "no-overlap" };
  }

  const centre = (low + high) / 2;
  const half = Math.min(Math.max(0, toleranceC), (high - low) / 2);
  const band: TempBand = { minC: centre - half, maxC: centre + half };
  const within = (sample: ImpactSample) =>
    isNum(sample.tempC) && sample.tempC >= band.minC && sample.tempC <= band.maxC;

  return {
    before: before.filter(within),
    after: after.filter(within),
    tempBand: band,
    tempMatch: "matched",
  };
}

function computeMetric(
  key: ImpactMetricKey,
  before: readonly ImpactSample[],
  after: readonly ImpactSample[],
  options: ImpactOptions,
): ImpactMetric {
  const matched = matchByTemperature(before, after, options.tempToleranceC);
  const beforeMean = weightedMean(matched.before);
  const afterMean = weightedMean(matched.after);
  const precision = PRECISION[key];
  const delta =
    beforeMean !== null && afterMean !== null
      ? round(afterMean - beforeMean, precision)
      : null;
  const deltaPct =
    beforeMean !== null && afterMean !== null && beforeMean !== 0
      ? round(((afterMean - beforeMean) / beforeMean) * 100, 1)
      : null;

  return {
    before: beforeMean === null ? null : round(beforeMean, precision),
    after: afterMean === null ? null : round(afterMean, precision),
    delta,
    deltaPct,
    beforeSamples: matched.before.length,
    afterSamples: matched.after.length,
    beforeTotal: before.length,
    afterTotal: after.length,
    lowSample:
      matched.before.length < options.minSamples || matched.after.length < options.minSamples,
    tempMatch: matched.tempMatch,
    tempBand: matched.tempBand,
  };
}

/**
 * One result per install, newest first. Windows are capped by the neighbouring
 * installs so the after-window never attributes a later version's behaviour to
 * the version being measured (and vice versa for the before-window).
 */
export function buildUpdateImpact(
  updates: readonly UpdateEvent[],
  samples: ImpactSamples,
  options: Partial<ImpactOptions> = {},
): VersionImpact[] {
  const opts: ImpactOptions = { ...DEFAULT_IMPACT_OPTIONS, ...options };
  const ordered = updates
    .filter((update) => Number.isFinite(Date.parse(update.installedAt)))
    .sort((a, b) => {
      const byTime = Date.parse(a.installedAt) - Date.parse(b.installedAt);
      return byTime !== 0 ? byTime : a.id - b.id;
    });

  const rows = ordered.map((update, index) => {
    const installMs = Date.parse(update.installedAt);
    const previous = ordered[index - 1];
    const next = ordered[index + 1];
    const previousMs = previous ? Date.parse(previous.installedAt) : null;
    const nextMs = next ? Date.parse(next.installedAt) : null;

    const beforeStartMs = Math.max(
      previousMs ?? Number.NEGATIVE_INFINITY,
      installMs - opts.beforeDays * DAY_MS,
    );
    const afterEndMs = Math.min(
      nextMs ?? Number.POSITIVE_INFINITY,
      installMs + opts.afterDays * DAY_MS,
    );

    const inBefore = (sample: ImpactSample) => {
      const ms = Date.parse(sample.at);
      return Number.isFinite(ms) && ms >= beforeStartMs && ms < installMs;
    };
    const inAfter = (sample: ImpactSample) => {
      const ms = Date.parse(sample.at);
      return Number.isFinite(ms) && ms > installMs && ms <= afterEndMs;
    };

    const metrics = {} as Record<ImpactMetricKey, ImpactMetric>;
    for (const key of IMPACT_METRIC_KEYS) {
      const all = samples[key] ?? [];
      metrics[key] = computeMetric(key, all.filter(inBefore), all.filter(inAfter), opts);
    }

    return {
      id: update.id,
      version: update.version,
      installedAt: update.installedAt,
      previousVersion: previous?.version ?? null,
      nextVersion: next?.version ?? null,
      before: { start: new Date(beforeStartMs).toISOString(), end: update.installedAt },
      after: { start: update.installedAt, end: new Date(afterEndMs).toISOString() },
      metrics,
    };
  });

  return rows.reverse();
}
