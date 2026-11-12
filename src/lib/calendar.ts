export const CALENDAR_METRICS = [
  { key: "drives", label: "Drives" },
  { key: "charges", label: "Charges" },
] as const;

export type CalendarMetric = (typeof CALENDAR_METRICS)[number]["key"];

/** Unknown values keep the original drive calendar. */
export function parseCalendarMetric(key: string | null | undefined): CalendarMetric {
  const found = CALENDAR_METRICS.find((metric) => metric.key === key);
  return found ? found.key : "drives";
}

/**
 * Heatmap bucket for a day. 0 means no activity; 1–4 grow with the busiest day
 * in the window so the scale follows the selected car and range.
 */
export function calendarLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (!(value > 0) || !(max > 0)) return 0;
  const ratio = value / max;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

const DAY_MS = 86_400_000;

/**
 * Calendar days between two dates (inclusive), grouped into Sunday–Saturday
 * weeks. Dates are normalized to UTC midnight so the grid is stable across
 * daylight-saving changes. Partial first and last weeks stay partial.
 */
export function calendarWeeks(start: Date, end: Date): string[][] {
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  if (!Number.isFinite(startDay) || !Number.isFinite(endDay) || endDay < startDay) return [];

  const weeks: string[][] = [];
  let week: string[] = [];
  for (let t = startDay; t <= endDay; t += DAY_MS) {
    const day = new Date(t);
    if (day.getUTCDay() === 0 && week.length > 0) {
      weeks.push(week);
      week = [];
    }
    week.push(day.toISOString().slice(0, 10));
  }
  if (week.length > 0) weeks.push(week);
  return weeks;
}
