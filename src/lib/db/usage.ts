import { cached } from "@/lib/cache";
import { buildUsageInsights, type UsageInsights, type UsageInterval } from "@/lib/usage";
import { q } from "./pool";

const USAGE_TTL_MS = 5 * 60_000;

type UsageRow = {
  state: string;
  start_date: Date;
  end_date: Date | null;
};

type UsageBoundsRow = {
  window_start: Date;
  window_end: Date;
};

export type UsageWindow = { start: Date; end: Date };

/**
 * The selected window. `null` months means all history, starting at the first
 * recorded state. Month windows align to the first of the month, matching the
 * other stats pages.
 */
export async function getUsageWindow(carId: number, months: number | null): Promise<UsageWindow> {
  const rows = await q<UsageBoundsRow>(
    `
    SELECT CASE
             WHEN $2::int IS NULL THEN coalesce(min(start_date), now())
             ELSE date_trunc('month', now()) - (($2::int - 1) * interval '1 month')
           END AS window_start,
           now() AS window_end
    FROM states
    WHERE car_id = $1
    `,
    [carId, months],
  );
  const row = rows[0];
  if (!row) {
    const now = new Date();
    return { start: now, end: now };
  }
  return { start: row.window_start, end: row.window_end };
}

async function loadIntervals(carId: number, window: UsageWindow): Promise<UsageInterval[]> {
  const rows = await q<UsageRow>(
    `
    SELECT state::text AS state, start_date, end_date
    FROM states
    WHERE car_id = $1
      AND start_date < $3
      AND (end_date IS NULL OR end_date > $2)
    ORDER BY start_date
    `,
    [carId, window.start, window.end],
  );
  return rows.map((r) => ({
    state: r.state,
    start: r.start_date.toISOString(),
    end: r.end_date ? r.end_date.toISOString() : null,
  }));
}

/** State intervals that overlap the window, oldest first. */
export async function getUsageIntervals(
  carId: number,
  months: number | null,
): Promise<UsageInterval[]> {
  return loadIntervals(carId, await getUsageWindow(carId, months));
}

/** Full usage and sleep roll-up for one car and range. */
export async function getUsageInsights(
  carId: number,
  months: number | null,
): Promise<UsageInsights> {
  return cached(`usageInsights:${carId}:${months ?? "all"}`, USAGE_TTL_MS, async () => {
    const window = await getUsageWindow(carId, months);
    const intervals = await loadIntervals(carId, window);
    return buildUsageInsights(intervals, {
      start: window.start.toISOString(),
      end: window.end.toISOString(),
    });
  });
}
