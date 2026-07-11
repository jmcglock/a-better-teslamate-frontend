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

type DrainRow = { end_date: Date; soc_start: number | null; soc_end: number | null; hours: string | number | null };

export async function getVampireDrain(): Promise<{ label: string; v: number }[]> {
  const rows = await q<DrainRow>(`
    WITH d AS (
      SELECT car_id, end_date, end_position_id,
             lead(start_date) OVER w AS next_start,
             lead(start_position_id) OVER w AS next_start_pos
      FROM drives WINDOW w AS (PARTITION BY car_id ORDER BY start_date)
    )
    SELECT d.end_date, p1.battery_level AS soc_start, p2.battery_level AS soc_end,
           extract(epoch FROM (d.next_start - d.end_date)) / 3600 AS hours
    FROM d
    JOIN positions p1 ON p1.id = d.end_position_id
    JOIN positions p2 ON p2.id = d.next_start_pos
    WHERE d.next_start - d.end_date > interval '6 hours'
      AND NOT EXISTS (
        SELECT 1 FROM charging_processes cp
        WHERE cp.car_id = d.car_id AND cp.start_date BETWEEN d.end_date AND d.next_start
      )
    ORDER BY d.end_date DESC LIMIT 500
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
