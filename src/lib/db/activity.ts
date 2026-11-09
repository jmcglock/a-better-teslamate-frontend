import { cached } from "@/lib/cache";
import { num } from "@/lib/format";
import { CHARGE_SELECT, mapChargeRow, type ChargeListItem, type ChargeRow } from "./charges";
import { mapDriveRow, type DriveListItem, type DriveRow } from "./drives";
import { q } from "./pool";

const ACTIVITY_TTL_MS = 30_000;

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
         c.efficiency, c.name AS car_name,
         COALESCE(gs.name, sa.city, sa.display_name) AS start_label,
         COALESCE(ge.name, ea.city, ea.display_name) AS end_label
  FROM drives d
  JOIN cars c ON c.id = d.car_id
  LEFT JOIN addresses sa ON sa.id = d.start_address_id
  LEFT JOIN addresses ea ON ea.id = d.end_address_id
  LEFT JOIN geofences gs ON gs.id = d.start_geofence_id
  LEFT JOIN geofences ge ON ge.id = d.end_geofence_id
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

type DriveWindowRow = {
  today_distance: string | number | null;
  today_drives: string | number | null;
  week_distance: string | number | null;
  week_drives: string | number | null;
};

type ChargeWindowRow = {
  today_energy: string | number | null;
  today_cost: string | number | null;
  today_charges: string | number | null;
  week_energy: string | number | null;
  week_cost: string | number | null;
  week_charges: string | number | null;
};

/** Today is a subset of the Monday-start week, so one scan covers both. */
export function mapActivityWindows(
  drive: DriveWindowRow | undefined,
  charge: ChargeWindowRow | undefined,
): { today: PeriodTotals; week: PeriodTotals } {
  return {
    today: {
      distanceKm: num(drive?.today_distance) ?? 0,
      energyAddedKwh: num(charge?.today_energy) ?? 0,
      cost: num(charge?.today_cost),
      driveCount: num(drive?.today_drives) ?? 0,
      chargeCount: num(charge?.today_charges) ?? 0,
    },
    week: {
      distanceKm: num(drive?.week_distance) ?? 0,
      energyAddedKwh: num(charge?.week_energy) ?? 0,
      cost: num(charge?.week_cost),
      driveCount: num(drive?.week_drives) ?? 0,
      chargeCount: num(charge?.week_charges) ?? 0,
    },
  };
}

async function windowTotals(carId: number, today: Date, week: Date): Promise<{ today: PeriodTotals; week: PeriodTotals }> {
  const [drives, charges] = await Promise.all([
    q<DriveWindowRow>(
      `
      SELECT
        coalesce(sum(distance) FILTER (WHERE start_date >= $2), 0) AS today_distance,
        (count(*) FILTER (WHERE start_date >= $2))::int AS today_drives,
        coalesce(sum(distance), 0) AS week_distance,
        count(*)::int AS week_drives
      FROM drives
      WHERE car_id = $1 AND distance > 0.1 AND start_date >= $3
      `,
      [carId, today, week],
    ),
    q<ChargeWindowRow>(
      `
      SELECT
        coalesce(sum(charge_energy_added) FILTER (WHERE start_date >= $2 AND charge_energy_added > 0.1), 0) AS today_energy,
        sum(cost) FILTER (WHERE start_date >= $2 AND cost IS NOT NULL) AS today_cost,
        (count(*) FILTER (WHERE start_date >= $2 AND charge_energy_added > 0.1))::int AS today_charges,
        coalesce(sum(charge_energy_added) FILTER (WHERE charge_energy_added > 0.1), 0) AS week_energy,
        sum(cost) FILTER (WHERE cost IS NOT NULL) AS week_cost,
        (count(*) FILTER (WHERE charge_energy_added > 0.1))::int AS week_charges
      FROM charging_processes
      WHERE car_id = $1 AND start_date >= $3
      `,
      [carId, today, week],
    ),
  ]);
  return mapActivityWindows(drives[0], charges[0]);
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
  return cached(`activity:${carId}`, ACTIVITY_TTL_MS, async () => {
    const [drive, charge, totals] = await Promise.all([
      lastDrive(carId),
      lastCharge(carId),
      windowTotals(carId, startOfLocalDay(), startOfLocalWeek()),
    ]);
    return { carId, lastDrive: drive, lastCharge: charge, today: totals.today, week: totals.week };
  });
}

export async function getDashboardActivity(carIds: number[]): Promise<Record<number, CarActivity>> {
  const entries = await Promise.all(carIds.map(async (id) => [id, await getCarActivity(id)] as const));
  return Object.fromEntries(entries);
}
