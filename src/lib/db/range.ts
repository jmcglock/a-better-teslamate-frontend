const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_.]*$/;

/**
 * SQL fragment limiting a timestamp column to the last `months` calendar months,
 * including the current month. `months === null` means all history.
 * The column must be a trusted identifier; the month count is parameterized.
 */
export function sinceMonthsSql(column: string, months: number | null, params: unknown[]): string {
  if (months === null) return "";
  if (!IDENTIFIER.test(column)) throw new Error(`unsafe column: ${column}`);
  params.push(Math.max(0, months - 1));
  return ` AND ${column} >= date_trunc('month', now()) - ($${params.length}::int * interval '1 month')`;
}

export const HISTORY_RANGES = [
  { key: "1m", label: "Month", months: 1 },
  { key: "3m", label: "3 mo", months: 3 },
  { key: "12m", label: "12 mo", months: 12 },
  { key: "all", label: "All", months: null },
] as const;

export type HistoryRangeKey = (typeof HISTORY_RANGES)[number]["key"];

/** Unknown values keep the previous list behavior: the full history. */
export function parseHistoryRange(key: string | undefined | null): HistoryRangeKey {
  const found = HISTORY_RANGES.find((range) => range.key === key);
  return found ? found.key : "all";
}

export function historyRangeMonths(key: HistoryRangeKey): number | null {
  return HISTORY_RANGES.find((range) => range.key === key)?.months ?? null;
}

export function parseCarId(raw: string | undefined, knownIds: number[]): number | null {
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || !knownIds.includes(id)) return null;
  return id;
}

/** Bookmarkable path. Omits the default range and page 1. */
export function historyHref(
  path: string,
  opts: { car?: number | null; range?: string; page?: number; defaultRange?: string },
): string {
  const params = new URLSearchParams();
  if (opts.car != null) params.set("car", String(opts.car));
  const defaultRange = opts.defaultRange ?? "all";
  if (opts.range && opts.range !== defaultRange) params.set("range", opts.range);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
