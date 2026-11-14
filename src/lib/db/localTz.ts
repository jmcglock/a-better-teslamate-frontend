function resolveLocalTz(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return /^[A-Za-z0-9_+\-/]+$/.test(tz) ? tz : "UTC";
}

/** IANA zone used for day/month buckets (the server's TZ, e.g. America/New_York). */
export const LOCAL_TZ = resolveLocalTz();

/**
 * SQL expression converting a UTC `timestamp without time zone` column to local
 * wall-clock time, so date_trunc('day'|'month') buckets follow local midnight.
 * The result is still timestamp-without-tz, which the pool.ts parser reads as a
 * UTC Date; callers already treat bucket Dates as UTC wall-clock.
 */
export function localTs(column: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(column)) throw new Error(`unsafe column: ${column}`);
  return `((${column} AT TIME ZONE 'UTC') AT TIME ZONE '${LOCAL_TZ}')`;
}

/** Today's local calendar date as a UTC-midnight Date (matches bucket Dates). */
export function localToday(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: LOCAL_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(`${parts}T00:00:00Z`);
}
