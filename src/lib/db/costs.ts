import { cached } from "@/lib/cache";
import { num } from "@/lib/format";
import {
  buildCostInsights,
  type ChargeMonth,
  type CostInsights,
  type DriveMonth,
  type PlaceCost,
} from "@/lib/costInsights";
import { sinceMonthsSql } from "./range";
import { localTs, q } from "./pool";

const COST_TTL_MS = 5 * 60_000;

type CostChargeMonthRow = {
  month: Date;
  sessions: string | number | null;
  sessions_with_cost: string | number | null;
  energy: string | number | null;
  cost_energy: string | number | null;
  cost: string | number | null;
};

type CostDriveMonthRow = {
  month: Date;
  distance: string | number | null;
};

type CostPlaceRow = {
  location: string | null;
  sessions: string | number | null;
  sessions_with_cost: string | number | null;
  energy: string | number | null;
  cost_energy: string | number | null;
  cost: string | number | null;
  last_visit: Date | null;
};

export type CostChargeMonth = ChargeMonth;
export type CostDriveMonth = DriveMonth;
export type CostPlace = PlaceCost;

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Monthly charge sessions, energy, cost, and the subset with a recorded cost. */
export async function getCostChargeMonths(
  carId: number,
  months: number | null,
): Promise<ChargeMonth[]> {
  const key = `costChargeMonths:${carId}:${months ?? "all"}`;
  return cached(key, COST_TTL_MS, async () => {
    const params: unknown[] = [carId];
    const rows = await q<CostChargeMonthRow>(`
      SELECT date_trunc('month', ${localTs("start_date")}) AS month,
             count(*)::int AS sessions,
             count(*) FILTER (WHERE cost IS NOT NULL)::int AS sessions_with_cost,
             coalesce(sum(charge_energy_added), 0) AS energy,
             coalesce(sum(charge_energy_added) FILTER (WHERE cost IS NOT NULL), 0) AS cost_energy,
             coalesce(sum(cost), 0) AS cost
      FROM charging_processes
      WHERE car_id = $1 AND charge_energy_added > 0.1${sinceMonthsSql("start_date", months, params)}
      GROUP BY 1 ORDER BY 1
    `, params);
    return rows.map((r) => ({
      month: monthKey(r.month),
      sessions: Number(r.sessions ?? 0),
      sessionsWithCost: Number(r.sessions_with_cost ?? 0),
      energyKwh: num(r.energy) ?? 0,
      costEnergyKwh: num(r.cost_energy) ?? 0,
      cost: num(r.cost) ?? 0,
    }));
  });
}

/** Monthly driven distance for the same car/window. */
export async function getCostDriveMonths(
  carId: number,
  months: number | null,
): Promise<DriveMonth[]> {
  const key = `costDriveMonths:${carId}:${months ?? "all"}`;
  return cached(key, COST_TTL_MS, async () => {
    const params: unknown[] = [carId];
    const rows = await q<CostDriveMonthRow>(`
      SELECT date_trunc('month', ${localTs("start_date")}) AS month,
             coalesce(sum(distance), 0) AS distance
      FROM drives
      WHERE car_id = $1 AND distance > 0.1${sinceMonthsSql("start_date", months, params)}
      GROUP BY 1 ORDER BY 1
    `, params);
    return rows.map((r) => ({
      month: monthKey(r.month),
      distanceKm: num(r.distance) ?? 0,
    }));
  });
}

/** Per-location charge cost, energy, session counts, and priced-energy totals. */
export async function getCostPlaces(
  carId: number,
  months: number | null,
): Promise<PlaceCost[]> {
  const key = `costPlaces:${carId}:${months ?? "all"}`;
  return cached(key, COST_TTL_MS, async () => {
    const params: unknown[] = [carId];
    const rows = await q<CostPlaceRow>(`
      SELECT COALESCE(g.name, a.city, a.display_name) AS location,
             count(*)::int AS sessions,
             count(*) FILTER (WHERE cp.cost IS NOT NULL)::int AS sessions_with_cost,
             coalesce(sum(cp.charge_energy_added), 0) AS energy,
             coalesce(sum(cp.charge_energy_added) FILTER (WHERE cp.cost IS NOT NULL), 0) AS cost_energy,
             coalesce(sum(cp.cost), 0) AS cost,
             max(cp.start_date) AS last_visit
      FROM charging_processes cp
      JOIN cars c ON c.id = cp.car_id
      LEFT JOIN addresses a ON a.id = cp.address_id
      LEFT JOIN geofences g ON g.id = cp.geofence_id
      WHERE cp.car_id = $1 AND cp.charge_energy_added > 0.1${sinceMonthsSql("cp.start_date", months, params)}
      GROUP BY 1
      ORDER BY sum(cp.cost) DESC NULLS LAST, sum(cp.charge_energy_added) DESC NULLS LAST
    `, params);
    return rows.map((r) => ({
      location: r.location ?? "Unknown location",
      sessions: Number(r.sessions ?? 0),
      sessionsWithCost: Number(r.sessions_with_cost ?? 0),
      energyKwh: num(r.energy) ?? 0,
      costEnergyKwh: num(r.cost_energy) ?? 0,
      cost: num(r.cost) ?? 0,
      lastVisit: r.last_visit ? r.last_visit.toISOString() : null,
    }));
  });
}

/** Full charging-cost insight roll-up for one car and calendar window. */
export async function getCostInsights(
  carId: number,
  months: number | null,
): Promise<CostInsights> {
  const [chargeMonths, driveMonths, places] = await Promise.all([
    getCostChargeMonths(carId, months),
    getCostDriveMonths(carId, months),
    getCostPlaces(carId, months),
  ]);
  return buildCostInsights(chargeMonths, driveMonths, places);
}

/** Alias kept for callers that prefer a "load" verb. */
export const loadCostInsights = getCostInsights;
export const fetchCostInsights = getCostInsights;