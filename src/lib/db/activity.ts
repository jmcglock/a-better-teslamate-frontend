import { num } from "@/lib/format";
import { mapChargeRow, type ChargeListItem, type ChargeRow } from "./charges";
import { mapDriveRow, type DriveListItem, type DriveRow } from "./drives";
import { q } from "./pool";

export type PeriodTotals = {
  distanceKm: number;
  energyAddedKwh: number;
  cost: number | null;
  driveCount: number;
  chargeCount: number;
};

export type CarActivity = {
  carId: number;
  lastDrive: DriveListItem | null;
  lastCharge: ChargeListItem | null;
  today: PeriodTotals;
  week: PeriodTotals;
};

const DRIVE_SELECT = `
  SELECT d.id, d.start_date, d.end_date, d.distance, d.duration_min, d.speed_max,
         (d.start_rated_range_km - d.end_rated_range_km) AS range_used_km,
         d.outside_temp_avg, d.inside_temp_avg, d.power_max, d.power_min,
         d.ascent, d.descent, d.start_rated_range_km, d.end_rated_range_km,
         c.efficiency,
         COALESCE(gs.name, sa.city, sa.display_name) AS start_label,
         COALESCE(ge.name, ea.city, ea.display_name) AS end_label
  FROM drives d
  JOIN cars c ON c.id = d.car_id
  LEFT JOIN addresses sa ON sa.id = d.start_address_id
  LEFT JOIN addresses ea ON ea.id = d.end_address_id
  LEFT JOIN geofences gs ON gs.id = d.start_geofence_id
  LEFT JOIN geofences ge ON ge.id = d.end_geofence_id
`;

const CHARGE_SELECT = `
  SELECT cp.id, cp.start_date, cp.end_date, cp.charge_energy_added, cp.charge_energy_used,
         cp.cost, cp.duration_min, cp.start_battery_level, cp.end_battery_level,
         cp.start_rated_range_km, cp.end_rated_range_km, cp.outside_temp_avg,
         COALESCE(g.name, a.city, a.display_name) AS location,
         (SELECT max(ch.charger_power) FROM charges ch WHERE ch.charging_process_id = cp.id) AS max_power,
         (SELECT max(ch.charger_voltage) FROM charges ch WHERE ch.charging_process_id = cp.id) AS max_voltage,
         (SELECT bool_or(ch.fast_charger_present) FROM charges ch WHERE ch.charging_process_id = cp.id) AS fast_charger,
         pos.latitude AS latitude, pos.longitude AS longitude
  FROM charging_processes cp
  LEFT JOIN addresses a ON a.id = cp.address_id
  LEFT JOIN geofences g ON g.id = cp.geofence_id
  LEFT JOIN positions pos ON pos.id = cp.position_id
`;

async function lastDrive(carId: number): Promise<DriveListItem | null> {
  const rows = await q<DriveRow>(
    `${DRIVE_SELECT} WHERE d.car_id = $1 AND d.distance > 0.1 ORDER BY d.start_date DESC LIMIT 1`,
    [carId],
  );
  return rows[0] ? mapDriveRow(rows[0]) : null;
}

async function lastCharge(carId: number): Promise<ChargeListItem | null> {
  const rows = await q<ChargeRow>(
    `${CHARGE_SELECT} WHERE cp.car_id = $1 AND cp.charge_energy_added > 0.1 ORDER BY cp.start_date DESC LIMIT 1`,
    [carId],
  );
  return rows[0] ? mapChargeRow(rows[0]) : null;
}

type TotalsRow = {
  distance: string | number | null;
  energy: string | number | null;
  cost: string | number | null;
  drive_count: string | number | null;
  charge_count: string | number | null;
};

async function periodTotals(carId: number, since: Date): Promise<PeriodTotals> {
  const rows = await q<TotalsRow>(
    `
    SELECT
      (SELECT coalesce(sum(distance), 0) FROM drives
        WHERE car_id = $1 AND distance > 0.1 AND start_date >= $2) AS distance,
      (SELECT coalesce(sum(charge_energy_added), 0) FROM charging_processes
        WHERE car_id = $1 AND charge_energy_added > 0.1 AND start_date >= $2) AS energy,
      (SELECT sum(cost) FROM charging_processes
        WHERE car_id = $1 AND start_date >= $2 AND cost IS NOT NULL) AS cost,
      (SELECT count(*)::int FROM drives
        WHERE car_id = $1 AND distance > 0.1 AND start_date >= $2) AS drive_count,
      (SELECT count(*)::int FROM charging_processes
        WHERE car_id = $1 AND charge_energy_added > 0.1 AND start_date >= $2) AS charge_count
    `,
    [carId, since],
  );
  const r = rows[0];
  return {
    distanceKm: num(r?.distance) ?? 0,
    energyAddedKwh: num(r?.energy) ?? 0,
    cost: num(r?.cost),
    driveCount: num(r?.drive_count) ?? 0,
    chargeCount: num(r?.charge_count) ?? 0,
  };
}

function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfLocalWeek(d = new Date()): Date {
  const x = startOfLocalDay(d);
  // Monday-start week
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

export async function getCarActivity(carId: number): Promise<CarActivity> {
  const [drive, charge, today, week] = await Promise.all([
    lastDrive(carId),
    lastCharge(carId),
    periodTotals(carId, startOfLocalDay()),
    periodTotals(carId, startOfLocalWeek()),
  ]);
  return { carId, lastDrive: drive, lastCharge: charge, today, week };
}

export async function getDashboardActivity(carIds: number[]): Promise<Record<number, CarActivity>> {
  const entries = await Promise.all(carIds.map(async (id) => [id, await getCarActivity(id)] as const));
  return Object.fromEntries(entries);
}
