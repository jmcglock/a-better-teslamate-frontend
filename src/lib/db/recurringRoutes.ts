import { cached } from "@/lib/cache";
import { num } from "@/lib/format";
import {
  buildRecurringRoutes,
  type BuildRecurringRoutesOptions,
  type RecurringRoutes,
  type RouteDriveInput,
} from "@/lib/recurringRoutes";
import { getCostInsights } from "./costs";
import { driveEfficiencyWhPerKm } from "./drives";
import { sinceMonthsSql } from "./range";
import { q } from "./pool";

const RECURRING_TTL_MS = 60_000;

export type RecurringDriveRow = {
  id: number;
  start_date: Date;
  distance: string | number | null;
  duration_min: string | number | null;
  range_used_km: string | null;
  efficiency: string | number | null;
  start_label: string | null;
  end_label: string | null;
};

export type RecurringRoutesResult = RecurringRoutes & {
  /** Average charging price used to estimate per-drive cost; null when unknown. */
  costRate: number | null;
};

const round = (v: number, places: number) => {
  const p = 10 ** places;
  return Math.round(v * p) / p;
};

/**
 * Estimated drive cost from consumed energy at an average charging price.
 * Returns null when efficiency or price is unknown.
 */
export function estimateDriveCost(
  efficiencyWhPerKm: number | null,
  distanceKm: number | null,
  costPerKwh: number | null,
): number | null {
  if (efficiencyWhPerKm === null || distanceKm === null || costPerKwh === null) return null;
  if (efficiencyWhPerKm <= 0 || distanceKm <= 0 || costPerKwh <= 0) return null;
  return round((efficiencyWhPerKm * distanceKm * costPerKwh) / 1000, 2);
}

export function mapRouteDriveRow(
  row: RecurringDriveRow,
  costPerKwh: number | null,
): RouteDriveInput {
  const distanceKm = num(row.distance);
  const efficiencyWhPerKm = driveEfficiencyWhPerKm(
    num(row.range_used_km),
    distanceKm,
    num(row.efficiency),
  );
  return {
    id: row.id,
    startDate: row.start_date.toISOString(),
    startLabel: row.start_label,
    endLabel: row.end_label,
    distanceKm,
    durationMin: num(row.duration_min),
    efficiencyWhPerKm,
    cost: estimateDriveCost(efficiencyWhPerKm, distanceKm, costPerKwh),
  };
}

/**
 * Drives for one car and calendar window, grouped into recurring start/end
 * pairs. Costs are estimated at the window's average charging rate.
 */
export async function getRecurringRoutes(
  carId: number,
  months: number | null,
  options: BuildRecurringRoutesOptions = {},
): Promise<RecurringRoutesResult> {
  const key = `recurringRoutes:${carId}:${months ?? "all"}:${JSON.stringify(options)}`;
  return cached(key, RECURRING_TTL_MS, async () => {
    const params: unknown[] = [carId];
    const [rows, insights] = await Promise.all([
      q<RecurringDriveRow>(`
        SELECT d.id, d.start_date, d.distance, d.duration_min,
               (d.start_rated_range_km - d.end_rated_range_km) AS range_used_km,
               c.efficiency,
               COALESCE(gs.name, sa.city, sa.display_name) AS start_label,
               COALESCE(ge.name, ea.city, ea.display_name) AS end_label
        FROM drives d
        JOIN cars c ON c.id = d.car_id
        LEFT JOIN addresses sa ON sa.id = d.start_address_id
        LEFT JOIN addresses ea ON ea.id = d.end_address_id
        LEFT JOIN geofences gs ON gs.id = d.start_geofence_id
        LEFT JOIN geofences ge ON ge.id = d.end_geofence_id
        WHERE d.car_id = $1 AND d.distance > 0.1${sinceMonthsSql("d.start_date", months, params)}
        ORDER BY d.start_date DESC
      `, params),
      getCostInsights(carId, months),
    ]);

    const costRate = insights.summary.avgCostPerKwh;
    return {
      ...buildRecurringRoutes(
        rows.map((row) => mapRouteDriveRow(row, costRate)),
        options,
      ),
      costRate,
    };
  });
}
