import { cached } from "@/lib/cache";

const CAR_IDENTITY_TTL_MS = 60_000;
import { num } from "@/lib/format";
import { sinceMonthsSql } from "./range";
import { localTs, q } from "./pool";

const STATS_TTL_MS = 5 * 60_000;

export const STATS_RANGES = [
  { key: "12m", label: "12 mo", months: 12 },
  { key: "24m", label: "24 mo", months: 24 },
  { key: "36m", label: "36 mo", months: 36 },
  { key: "all", label: "All", months: null },
] as const;

export type StatsRangeKey = (typeof STATS_RANGES)[number]["key"];

/** Unknown values fall back to 12 months, the previous fixed window. */
export function parseStatsRange(key: string | undefined | null): StatsRangeKey {
  const found = STATS_RANGES.find((range) => range.key === key);
  return found ? found.key : "12m";
}

export function statsRangeMonths(key: StatsRangeKey): number | null {
  const found = STATS_RANGES.find((range) => range.key === key);
  return found ? found.months : 12;
}

export function statsRangeLabel(key: StatsRangeKey): string {
  return STATS_RANGES.find((range) => range.key === key)?.label ?? "12 mo";
}

export function drainPctPerDay(socStart: number, socEnd: number, hours: number): number | null {
  if (hours < 6) return null;
  const drain = socStart - socEnd;
  if (drain < 0) return null;
  return (drain / hours) * 24;
}

export function monthLabel(d: Date): string {
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const year = String(d.getUTCFullYear()).slice(-2);
  return `${month} ${year}`;
}

type MonthRow = { month: Date; v: string | number | null };

export async function getMonthlyMileage(
  carId: number,
  range: StatsRangeKey = "12m",
): Promise<{ label: string; v: number }[]> {
  const months = statsRangeMonths(range);
  return cached(`mileage:${carId}:${range}`, STATS_TTL_MS, async () => {
    const params: unknown[] = [carId];
    const rows = await q<MonthRow>(`
      SELECT date_trunc('month', ${localTs("start_date")}) AS month, sum(distance) AS v
      FROM drives WHERE car_id = $1 AND distance > 0.1${sinceMonthsSql("start_date", months, params)}
      GROUP BY 1 ORDER BY 1 DESC
    `, params);
    return rows.reverse().map((r) => ({ label: monthLabel(r.month), v: num(r.v) ?? 0 }));
  });
}

export async function getMonthlyEfficiency(
  carId: number,
  range: StatsRangeKey = "12m",
): Promise<{ label: string; v: number }[]> {
  const months = statsRangeMonths(range);
  return cached(`efficiency:${carId}:${range}`, STATS_TTL_MS, async () => {
    const params: unknown[] = [carId];
    const rows = await q<MonthRow>(`
      SELECT date_trunc('month', ${localTs("d.start_date")}) AS month,
             sum((d.start_rated_range_km - d.end_rated_range_km) * c.efficiency) * 1000 / nullif(sum(d.distance), 0) AS v
      FROM drives d JOIN cars c ON c.id = d.car_id
      WHERE d.car_id = $1 AND d.distance > 0.1 AND d.start_rated_range_km IS NOT NULL AND d.end_rated_range_km IS NOT NULL${sinceMonthsSql("d.start_date", months, params)}
      GROUP BY 1 ORDER BY 1 DESC
    `, params);
    return rows.reverse().flatMap((r) => {
      const v = num(r.v);
      return v === null || v <= 0 ? [] : [{ label: monthLabel(r.month), v }];
    });
  });
}

/**
 * Projected full-pack rated range (km) by month — battery health proxy.
 * The chart follows `range`. Pass `"all"` for a stable degradation baseline;
 * the previous page used a fixed 24-month limit.
 */
export type EfficiencyTempPoint = { tempC: number; whPerKm: number; distanceKm: number };

export type EfficiencyTempSeries = {
  points: EfficiencyTempPoint[];
  driveCount: number;
};

export async function getEfficiencyByTemp(
  carId: number,
  range: StatsRangeKey = "12m",
): Promise<EfficiencyTempSeries> {
  const months = statsRangeMonths(range);
  return cached(`effTempBuckets:${carId}:${range}`, STATS_TTL_MS, async () => {
    const params: unknown[] = [carId];
    // Weighted Wh/km by whole degree. Shipping one row per drive made the
    // scatter chart stall once history grew past a few thousand trips.
    const rows = await q<{
      temp_c: string | number | null;
      wh_per_km: string | number | null;
      distance_km: string | number | null;
      drives: string | number | null;
    }>(`
      SELECT round(d.outside_temp_avg)::int AS temp_c,
             sum((d.start_rated_range_km - d.end_rated_range_km) * c.efficiency) * 1000
               / nullif(sum(d.distance), 0) AS wh_per_km,
             sum(d.distance) AS distance_km,
             count(*)::int AS drives
      FROM drives d
      JOIN cars c ON c.id = d.car_id
      WHERE d.car_id = $1
        AND d.distance > 0.1
        AND d.outside_temp_avg IS NOT NULL
        AND d.start_rated_range_km IS NOT NULL
        AND d.end_rated_range_km IS NOT NULL
        AND d.start_rated_range_km > d.end_rated_range_km${sinceMonthsSql("d.start_date", months, params)}
      GROUP BY 1
      ORDER BY 1
    `, params);
    const points: EfficiencyTempPoint[] = [];
    let driveCount = 0;
    for (const r of rows) {
      const temp = num(r.temp_c);
      const whPerKm = num(r.wh_per_km);
      const distanceKm = num(r.distance_km);
      const drives = num(r.drives) ?? 0;
      if (temp === null || whPerKm === null || distanceKm === null || whPerKm <= 0) continue;
      driveCount += drives;
      points.push({ tempC: temp, whPerKm: Math.round(whPerKm), distanceKm: Math.round(distanceKm) });
    }
    return { points, driveCount };
  });
}

export type DriveDay = { date: string; count: number; distanceKm: number };

export async function getDriveDays(
  carId: number,
  range: StatsRangeKey = "12m",
): Promise<DriveDay[]> {
  const months = statsRangeMonths(range);
  return cached(`driveDays:${carId}:${range}`, STATS_TTL_MS, async () => {
    const params: unknown[] = [carId];
    const rows = await q<{ d: Date; c: string | number; dist: string | number | null }>(`
      SELECT date_trunc('day', ${localTs("d.start_date")}) AS d, count(*) AS c, sum(d.distance) AS dist
      FROM drives d
      WHERE d.car_id = $1 AND d.distance > 0.1${sinceMonthsSql("d.start_date", months, params)}
      GROUP BY 1 ORDER BY 1
    `, params);
    return rows.map((r) => ({
      date: r.d.toISOString().slice(0, 10),
      count: Number(r.c),
      distanceKm: Math.round(num(r.dist) ?? 0),
    }));
  });
}

export type ChargeDay = { date: string; count: number; energyKwh: number };

/** Charging sessions and energy added per calendar day, for the charge heatmap. */
export async function getChargeDays(
  carId: number,
  range: StatsRangeKey = "12m",
): Promise<ChargeDay[]> {
  const months = statsRangeMonths(range);
  return cached(`chargeDays:${carId}:${range}`, STATS_TTL_MS, async () => {
    const params: unknown[] = [carId];
    const rows = await q<{ d: Date; c: string | number; energy: string | number | null }>(`
      SELECT date_trunc('day', ${localTs("cp.start_date")}) AS d, count(*) AS c, sum(cp.charge_energy_added) AS energy
      FROM charging_processes cp
      WHERE cp.car_id = $1 AND cp.charge_energy_added > 0.1${sinceMonthsSql("cp.start_date", months, params)}
      GROUP BY 1 ORDER BY 1
    `, params);
    return rows.map((r) => ({
      date: r.d.toISOString().slice(0, 10),
      count: Number(r.c),
      energyKwh: Math.round((num(r.energy) ?? 0) * 10) / 10,
    }));
  });
}

export async function getBatteryHealth(
  carId: number,
  range: StatsRangeKey = "12m",
): Promise<{ t: number; v: number | null }[]> {
  const months = statsRangeMonths(range);
  return cached(`health:${carId}:${range}`, STATS_TTL_MS, async () => {
    const params: unknown[] = [carId];
    const rows = await q<MonthRow>(`
      SELECT date_trunc('month', ${localTs("cp.start_date")}) AS month,
             max(cp.end_rated_range_km / nullif(cp.end_battery_level, 0) * 100) AS v
      FROM charging_processes cp
      WHERE cp.car_id = $1 AND cp.end_battery_level >= 50 AND cp.end_rated_range_km IS NOT NULL${sinceMonthsSql("cp.start_date", months, params)}
      GROUP BY 1 ORDER BY 1 DESC
    `, params);
    return rows.reverse().map((r) => ({ t: r.month.getTime(), v: num(r.v) }));
  });
}

type CostMonthRow = {
  month: Date;
  cost: string | number | null;
  energy: string | number | null;
};

export type MonthlyCost = { label: string; cost: number; energyKwh: number };

/** Monthly charge cost + energy for spend summary. */
export async function getMonthlyChargeCost(
  carId: number,
  range: StatsRangeKey = "12m",
): Promise<MonthlyCost[]> {
  const months = statsRangeMonths(range);
  return cached(`chargeCost:${carId}:${range}`, STATS_TTL_MS, async () => {
    const params: unknown[] = [carId];
    const rows = await q<CostMonthRow>(`
      SELECT date_trunc('month', ${localTs("start_date")}) AS month,
             sum(cost) AS cost,
             sum(charge_energy_added) AS energy
      FROM charging_processes
      WHERE car_id = $1 AND charge_energy_added > 0.1${sinceMonthsSql("start_date", months, params)}
      GROUP BY 1 ORDER BY 1 DESC
    `, params);
    return rows.reverse().map((r) => ({
      label: monthLabel(r.month),
      cost: num(r.cost) ?? 0,
      energyKwh: num(r.energy) ?? 0,
    }));
  });
}

type CarIdentityRow = {
  id: number;
  name: string | null;
  model: string | null;
  marketing_name?: string | null;
  trim_badging?: string | null;
  vin: string | null;
  efficiency: string | number | null;
};

export type CarIdentity = {
  id: number;
  name: string;
  model: string | null;
  marketingName: string | null;
  trimBadging: string | null;
  vin: string | null;
  efficiency: number | null;
};

function mapCarIdentity(r: CarIdentityRow): CarIdentity {
  return {
    id: r.id,
    name: r.name ?? `Car ${r.id}`,
    model: r.model,
    marketingName: r.marketing_name ?? null,
    trimBadging: r.trim_badging ?? null,
    vin: r.vin,
    efficiency: num(r.efficiency),
  };
}

/**
 * New-car EPA rated range (km) from model/trim/VIN year.
 * Values are approximate published EPA figures for the common US configs.
 */
export function newCarRatedRangeKm(car: {
  model: string | null;
  marketingName: string | null;
  trimBadging: string | null;
  vin: string | null;
}): number | null {
  const model = (car.model ?? "").toUpperCase();
  const market = (car.marketingName ?? "").toUpperCase();
  const trim = (car.trimBadging ?? "").toUpperCase();
  const vinYear = car.vin && car.vin.length >= 10 ? car.vin[9] : null;
  // VIN position 10: L=2020, M=2021, N=2022, P=2023, R=2024, S=2025, T=2026
  const year =
    vinYear === "L" ? 2020
    : vinYear === "M" ? 2021
    : vinYear === "N" ? 2022
    : vinYear === "P" ? 2023
    : vinYear === "R" ? 2024
    : vinYear === "S" ? 2025
    : vinYear === "T" ? 2026
    : null;

  const isLR = market.includes("LR") || market.includes("LONG") || trim === "74" || trim === "75" || trim === "AWD";
  const isSR =
    !isLR &&
    (market.includes("SR") || market.includes("STANDARD") ||
      trim === "50" || trim === "RWD" || market.includes("RWD"));
  const isP = market.includes("P") || market.startsWith("P") || trim.startsWith("P") || market.includes("PERF");

  if (model === "3") {
    // 2017–2020 SR+ ≈ 250 mi; 2021+ RWD/SR often ~263–272 mi. Use 250 for L-year SR+.
    if (isSR || (!isLR && !isP)) {
      if (year !== null && year <= 2020) return 402; // 250 mi
      return 422; // ~262 mi
    }
    if (isP) return 507; // ~315 mi class
    return 534; // ~332 mi LR class
  }
  if (model === "Y") {
    if (isSR || (!isLR && !isP)) return 393; // ~244 mi
    if (isP) return 488;
    return 530;
  }
  if (model === "S") return 650;
  if (model === "X") return 560;
  return null;
}

export async function listCarIdentities(): Promise<CarIdentity[]> {
  return cached("carIdentities", CAR_IDENTITY_TTL_MS, async () => {
    const rows = await q<CarIdentityRow>(`
      SELECT *
      FROM cars
      ORDER BY id
    `);
    return rows.map(mapCarIdentity);
  });
}

export async function getCarIdentity(carId: number): Promise<CarIdentity | null> {
  const cars = await listCarIdentities();
  return cars.find((c) => c.id === carId) ?? null;
}

export async function getPrimaryCarIdentity(): Promise<CarIdentity | null> {
  const cars = await listCarIdentities();
  return cars[0] ?? null;
}

export type BatteryHealthSummary = {
  currentKm: number | null;
  /** Observed peak full-pack range in TeslaMate history */
  peakKm: number | null;
  /** New-car EPA rated range baseline (km), when known */
  newKm: number | null;
  /**
   * Degradation vs new: current / new * 100.
   * Falls back to current / peak only when new baseline is unknown.
   */
  healthPct: number | null;
  /** 100 - healthPct when health known */
  degradationPct: number | null;
  /** Estimated usable pack kWh from current full range * cars.efficiency */
  currentKwh: number | null;
  /** Estimated new usable pack kWh from new range * cars.efficiency */
  newKwh: number | null;
  baseline: "new" | "peak" | null;
};

export function summarizeBatteryHealth(
  series: { t: number; v: number | null }[],
  opts?: { newKm?: number | null; efficiency?: number | null },
): BatteryHealthSummary {
  const ordered = [...series].sort((a, b) => a.t - b.t);
  const vals = ordered.map((p) => p.v).filter((v): v is number => v !== null && v > 0);
  if (vals.length === 0) {
    return {
      currentKm: null, peakKm: null, newKm: opts?.newKm ?? null,
      healthPct: null, degradationPct: null, currentKwh: null, newKwh: null, baseline: null,
    };
  }
  const currentKm = vals[vals.length - 1] ?? null;
  const peakKm = Math.max(...vals);
  const newKm = opts?.newKm ?? null;
  const baselineKm = newKm && newKm > 0 ? newKm : peakKm;
  const baseline: "new" | "peak" = newKm && newKm > 0 ? "new" : "peak";
  const healthPct = currentKm !== null && baselineKm > 0 ? (currentKm / baselineKm) * 100 : null;
  const degradationPct = healthPct === null ? null : Math.max(0, 100 - healthPct);
  const eff = opts?.efficiency ?? null;
  const currentKwh = currentKm !== null && eff !== null ? currentKm * eff : null;
  const newKwh = newKm !== null && eff !== null ? newKm * eff : null;
  return { currentKm, peakKm, newKm, healthPct, degradationPct, currentKwh, newKwh, baseline };
}

type DrainRow = { end_date: Date; soc_start: number | null; soc_end: number | null; hours: string | number | null };

export async function getVampireDrain(
  carId: number,
  range: StatsRangeKey = "12m",
): Promise<{ label: string; v: number }[]> {
  const months = statsRangeMonths(range);
  return cached(`drain:${carId}:${range}`, STATS_TTL_MS, async () => {
    const params: unknown[] = [carId];
    const rows = await q<DrainRow>(`
      WITH d AS (
        SELECT car_id, end_date, end_position_id,
               lead(start_date) OVER w AS next_start,
               lead(start_position_id) OVER w AS next_start_pos
        FROM drives
        WHERE car_id = $1${sinceMonthsSql("start_date", months, params)}
        WINDOW w AS (PARTITION BY car_id ORDER BY start_date)
      )
      SELECT d.end_date, p1.battery_level AS soc_start, p2.battery_level AS soc_end,
             extract(epoch FROM (d.next_start - d.end_date)) / 3600 AS hours
      FROM d
      JOIN positions p1 ON p1.id = d.end_position_id
      JOIN positions p2 ON p2.id = d.next_start_pos
      WHERE d.next_start - d.end_date > interval '6 hours'
        AND d.next_start - d.end_date < interval '14 days'
        AND NOT EXISTS (
          SELECT 1 FROM charging_processes cp
          WHERE cp.car_id = d.car_id AND cp.start_date BETWEEN d.end_date AND d.next_start
        )
    `, params);

    const byMonth = new Map<string, { sum: number; n: number; date: Date }>();
    for (const r of rows) {
      const hours = num(r.hours);
      if (r.soc_start === null || r.soc_end === null || hours === null) continue;
      const drain = drainPctPerDay(r.soc_start, r.soc_end, hours);
      if (drain === null) continue;
      // Bucket by local month; monthLabel reads UTC fields, so key on a UTC-midnight date.
      const month = new Date(Date.UTC(r.end_date.getFullYear(), r.end_date.getMonth(), 1));
      const key = month.toISOString();
      const cur = byMonth.get(key) ?? { sum: 0, n: 0, date: month };
      byMonth.set(key, { sum: cur.sum + drain, n: cur.n + 1, date: cur.date });
    }
    return [...byMonth.values()]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((m) => ({ label: monthLabel(m.date), v: m.sum / m.n }));
  });
}
