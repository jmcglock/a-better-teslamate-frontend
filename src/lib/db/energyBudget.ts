import { cached } from "@/lib/cache";
import { num } from "@/lib/format";
import { buildEnergyBudget, type EnergyChargeMonth, type EnergyDriveMonth } from "@/lib/energyBudget";
import { sinceMonthsSql } from "./range";
import { q } from "./pool";

const TTL_MS = 5 * 60_000;

type ChargeRow = { month: Date; wall: string | number | null; pack: string | number | null; cost: string | number | null };
type DriveRow = { month: Date; distance: string | number | null; range_used: string | number | null };

export async function getEnergyChargeMonths(carId: number, months: number | null): Promise<EnergyChargeMonth[]> {
  const key = `energyCharge:${carId}:${months ?? "all"}`;
  return cached(key, TTL_MS, async () => {
    const params: unknown[] = [carId];
    const rows = await q<ChargeRow>(`
      SELECT date_trunc('month', start_date) AS month,
             coalesce(sum(charge_energy_used), 0) AS wall,
             coalesce(sum(charge_energy_added), 0) AS pack,
             coalesce(sum(cost), 0) AS cost
      FROM charging_processes
      WHERE car_id = $1 AND charge_energy_added > 0.1${sinceMonthsSql("start_date", months, params)}
      GROUP BY 1 ORDER BY 1
    `, params);
    return rows.map((r) => ({
      month: r.month.toISOString().slice(0, 7),
      wallKwh: num(r.wall) ?? 0,
      packKwh: num(r.pack) ?? 0,
      cost: num(r.cost) ?? 0,
    }));
  });
}

export async function getEnergyDriveMonths(carId: number, months: number | null): Promise<EnergyDriveMonth[]> {
  const key = `energyDrive:${carId}:${months ?? "all"}`;
  return cached(key, TTL_MS, async () => {
    const params: unknown[] = [carId];
    const rows = await q<DriveRow>(`
      SELECT date_trunc('month', start_date) AS month,
             coalesce(sum(distance), 0) AS distance,
             coalesce(sum(start_rated_range_km - end_rated_range_km), 0) AS range_used
      FROM drives
      WHERE car_id = $1 AND distance > 0.1${sinceMonthsSql("start_date", months, params)}
      GROUP BY 1 ORDER BY 1
    `, params);
    return rows.map((r) => ({
      month: r.month.toISOString().slice(0, 7),
      distanceKm: num(r.distance) ?? 0,
      rangeUsedKm: num(r.range_used) ?? 0,
    }));
  });
}