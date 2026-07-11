import { num } from "@/lib/format";
import { q } from "./pool";

export function drainPctPerDay(socStart: number, socEnd: number, hours: number): number | null {
  if (hours < 6) return null;
  const drain = socStart - socEnd;
  if (drain < 0) return null;
  return (drain / hours) * 24;
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

type MonthRow = { month: Date; v: string | number | null };

export async function getMonthlyMileage(): Promise<{ label: string; v: number }[]> {
  const rows = await q<MonthRow>(`
    SELECT date_trunc('month', start_date) AS month, sum(distance) AS v
    FROM drives WHERE distance > 0.1
    GROUP BY 1 ORDER BY 1 DESC LIMIT 12
  `);
  return rows.reverse().map((r) => ({ label: monthLabel(r.month), v: num(r.v) ?? 0 }));
}

export async function getMonthlyEfficiency(): Promise<{ label: string; v: number }[]> {
  const rows = await q<MonthRow>(`
    SELECT date_trunc('month', d.start_date) AS month,
           sum((d.start_rated_range_km - d.end_rated_range_km) * c.efficiency) * 1000 / nullif(sum(d.distance), 0) AS v
    FROM drives d JOIN cars c ON c.id = d.car_id
    WHERE d.distance > 0.1 AND d.start_rated_range_km IS NOT NULL AND d.end_rated_range_km IS NOT NULL
    GROUP BY 1 ORDER BY 1 DESC LIMIT 12
  `);
  return rows.reverse().flatMap((r) => {
    const v = num(r.v);
    return v === null || v <= 0 ? [] : [{ label: monthLabel(r.month), v }];
  });
}

/** Projected full-pack rated range (km) by month — battery health proxy. */
export async function getBatteryHealth(): Promise<{ t: number; v: number | null }[]> {
  const rows = await q<MonthRow>(`
    SELECT date_trunc('month', cp.start_date) AS month,
           max(cp.end_rated_range_km / nullif(cp.end_battery_level, 0) * 100) AS v
    FROM charging_processes cp
    WHERE cp.end_battery_level >= 50 AND cp.end_rated_range_km IS NOT NULL
    GROUP BY 1 ORDER BY 1 DESC LIMIT 24
  `);
  return rows.reverse().map((r) => ({ t: r.month.getTime(), v: num(r.v) }));
}

type CarIdentityRow = {
  model: string | null;
  marketing_name: string | null;
  trim_badging: string | null;
  vin: string | null;
  efficiency: string | number | null;
};

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

  const isSR =
    market.includes("SR") || market.includes("STANDARD") ||
    trim === "50" || trim === "RWD" || market.includes("RWD");
  const isLR = market.includes("LR") || market.includes("LONG") || trim === "74" || trim === "75" || trim === "AWD";
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

export async function getPrimaryCarIdentity(): Promise<{
  model: string | null;
  marketingName: string | null;
  trimBadging: string | null;
  vin: string | null;
  efficiency: number | null;
} | null> {
  const rows = await q<CarIdentityRow>(`
    SELECT model, marketing_name, trim_badging, vin, efficiency
    FROM cars
    ORDER BY display_priority NULLS LAST, id
    LIMIT 1
  `);
  const r = rows[0];
  if (!r) return null;
  return {
    model: r.model,
    marketingName: r.marketing_name,
    trimBadging: r.trim_badging,
    vin: r.vin,
    efficiency: num(r.efficiency),
  };
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
  const vals = series.map((p) => p.v).filter((v): v is number => v !== null && v > 0);
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

export async function getVampireDrain(): Promise<{ label: string; v: number }[]> {
  // Cap lookback tightly — this window scan is expensive and was blowing the tiny Postgres pool.
  const rows = await q<DrainRow>(`
    WITH d AS (
      SELECT car_id, end_date, end_position_id,
             lead(start_date) OVER w AS next_start,
             lead(start_position_id) OVER w AS next_start_pos
      FROM drives
      WHERE start_date > now() - interval '18 months'
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
    ORDER BY d.end_date DESC LIMIT 200
  `);

  const byMonth = new Map<string, { sum: number; n: number; date: Date }>();
  for (const r of rows) {
    const hours = num(r.hours);
    if (r.soc_start === null || r.soc_end === null || hours === null) continue;
    const drain = drainPctPerDay(r.soc_start, r.soc_end, hours);
    if (drain === null) continue;
    const key = `${r.end_date.getUTCFullYear()}-${r.end_date.getUTCMonth()}`;
    const cur = byMonth.get(key) ?? { sum: 0, n: 0, date: r.end_date };
    byMonth.set(key, { sum: cur.sum + drain, n: cur.n + 1, date: cur.date });
  }
  return [...byMonth.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-12)
    .map((m) => ({ label: monthLabel(m.date), v: m.sum / m.n }));
}
