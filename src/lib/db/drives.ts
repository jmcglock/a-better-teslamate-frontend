import { cached } from "@/lib/cache";
import { num } from "@/lib/format";
import { sinceMonthsSql } from "./range";
import { q } from "./pool";

const DRIVE_TTL_MS = 30_000;

export type DriveRow = {
  id: number; start_date: Date; end_date: Date | null;
  distance: string | number | null; duration_min: string | number | null; speed_max: string | number | null;
  range_used_km: string | null; start_label: string | null; end_label: string | null;
  outside_temp_avg: string | null; inside_temp_avg: string | null;
  power_max: string | number | null; power_min: string | number | null;
  ascent: string | number | null; descent: string | number | null;
  start_rated_range_km: string | null; end_rated_range_km: string | null;
  efficiency: string | number | null;
  car_name: string | null;
};

export type DriveListItem = {
  id: number; startDate: string; endDate: string | null;
  distanceKm: number | null; durationMin: number | null; speedMaxKmh: number | null;
  rangeUsedKm: number | null; startLabel: string; endLabel: string;
  outsideTempAvgC: number | null; insideTempAvgC: number | null;
  powerMaxKw: number | null; powerMinKw: number | null;
  ascentM: number | null; descentM: number | null;
  startRatedRangeKm: number | null; endRatedRangeKm: number | null;
  /** Wh/km when computable, else null */
  efficiencyWhPerKm: number | null;
  carName: string;
};

export type PointRow = {
  date: Date; speed: string | number | null; battery_level: string | number | null;
  latitude: string; longitude: string;
  elevation: string | number | null; power: string | number | null;
};

export type DrivePoint = {
  t: number; speed: number | null; soc: number | null;
  lat: number; lon: number;
  elevation: number | null; power: number | null;
};

export type DriveDetail = DriveListItem & { points: DrivePoint[] };

/** Same cutoff as the drives list. Shorter hops stay off the list and out of the totals. */
export const MIN_LISTED_DRIVE_KM = 0.1;

export type DriveFilterInput = {
  carId: number;
  startDate: Date;
  distanceKm: number | null;
  durationMin: number | null;
};

export type DriveTotals = {
  count: number;
  distanceKm: number;
  durationMin: number;
};

export type DriveTotalsRow = {
  count: string | number | null;
  distance_km: string | number | null;
  duration_min: string | number | null;
};

/** Rows that pass the drives-list filters: distance, optional car, optional window start. */
export function drivesMatchingFilter<T extends DriveFilterInput>(
  drives: readonly T[],
  filter: { carId?: number | null; since?: Date | null },
): T[] {
  return drives.filter((drive) => {
    if (drive.distanceKm === null || !(drive.distanceKm > MIN_LISTED_DRIVE_KM)) return false;
    if (filter.carId != null && drive.carId !== filter.carId) return false;
    if (filter.since != null && drive.startDate < filter.since) return false;
    return true;
  });
}

export function summarizeDrives(drives: readonly DriveFilterInput[]): DriveTotals {
  let distanceKm = 0;
  let durationMin = 0;
  for (const drive of drives) {
    distanceKm += drive.distanceKm ?? 0;
    durationMin += drive.durationMin ?? 0;
  }
  return { count: drives.length, distanceKm, durationMin };
}

export function mapDriveTotals(row: DriveTotalsRow | undefined): DriveTotals {
  return {
    count: num(row?.count) ?? 0,
    distanceKm: num(row?.distance_km) ?? 0,
    durationMin: num(row?.duration_min) ?? 0,
  };
}

export function driveEfficiencyWhPerKm(
  rangeUsedKm: number | null,
  distanceKm: number | null,
  efficiency: number | null,
): number | null {
  if (rangeUsedKm === null || distanceKm === null || efficiency === null) return null;
  if (distanceKm <= 0 || rangeUsedKm <= 0 || efficiency <= 0) return null;
  return (rangeUsedKm * efficiency * 1000) / distanceKm;
}

export function mapDriveRow(r: DriveRow): DriveListItem {
  const rangeUsedKm = num(r.range_used_km);
  const distanceKm = num(r.distance);
  const carEff = num(r.efficiency);
  return {
    id: r.id,
    startDate: r.start_date.toISOString(),
    endDate: r.end_date ? r.end_date.toISOString() : null,
    distanceKm,
    durationMin: num(r.duration_min),
    speedMaxKmh: num(r.speed_max),
    rangeUsedKm,
    startLabel: r.start_label ?? "Unknown location",
    endLabel: r.end_label ?? "Unknown location",
    outsideTempAvgC: num(r.outside_temp_avg),
    insideTempAvgC: num(r.inside_temp_avg),
    powerMaxKw: num(r.power_max),
    powerMinKw: num(r.power_min),
    ascentM: num(r.ascent),
    descentM: num(r.descent),
    startRatedRangeKm: num(r.start_rated_range_km),
    endRatedRangeKm: num(r.end_rated_range_km),
    efficiencyWhPerKm: driveEfficiencyWhPerKm(rangeUsedKm, distanceKm, carEff),
    carName: r.car_name ?? "Car",
  };
}

export function mapDrivePoint(r: PointRow): DrivePoint {
  return {
    t: r.date.getTime(),
    speed: num(r.speed),
    soc: num(r.battery_level),
    lat: num(r.latitude) ?? 0,
    lon: num(r.longitude) ?? 0,
    elevation: num(r.elevation),
    power: num(r.power),
  };
}

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

type DriveListOpts = { carId?: number | null; months?: number | null };

function driveListWhere(opts: DriveListOpts, params: unknown[]): string {
  const where = [`d.distance > ${MIN_LISTED_DRIVE_KM}`];
  if (opts.carId != null) {
    params.push(opts.carId);
    where.push(`d.car_id = $${params.length}`);
  }
  return `${where.join(" AND ")}${sinceMonthsSql("d.start_date", opts.months ?? null, params)}`;
}

export async function listDrives(
  page: number,
  opts: DriveListOpts & { pageSize?: number } = {},
): Promise<{ items: DriveListItem[]; hasMore: boolean }> {
  const pageSize = opts.pageSize ?? 50;
  const key = `drives:${page}:${pageSize}:${opts.carId ?? "all"}:${opts.months ?? "all"}`;
  return cached(key, DRIVE_TTL_MS, async () => {
    const params: unknown[] = [pageSize + 1, (page - 1) * pageSize];
    const rows = await q<DriveRow>(
      `${DRIVE_SELECT} WHERE ${driveListWhere(opts, params)} ORDER BY d.start_date DESC LIMIT $1 OFFSET $2`,
      params,
    );
    return { items: rows.slice(0, pageSize).map(mapDriveRow), hasMore: rows.length > pageSize };
  });
}

/** Count, distance, and driving time for the same car and calendar window as the drives list. */
export async function getDriveTotals(opts: DriveListOpts = {}): Promise<DriveTotals> {
  const key = `driveTotals:${opts.carId ?? "all"}:${opts.months ?? "all"}`;
  return cached(key, DRIVE_TTL_MS, async () => {
    const params: unknown[] = [];
    const rows = await q<DriveTotalsRow>(
      `SELECT count(*)::int AS count,
              coalesce(sum(d.distance), 0) AS distance_km,
              coalesce(sum(d.duration_min), 0) AS duration_min
       FROM drives d
       WHERE ${driveListWhere(opts, params)}`,
      params,
    );
    return mapDriveTotals(rows[0]);
  });
}

export async function getDrive(id: number): Promise<DriveDetail | null> {
  return cached(`drive:${id}`, DRIVE_TTL_MS, async () => {
    const rows = await q<DriveRow>(`${DRIVE_SELECT} WHERE d.id = $1`, [id]);
    if (rows.length === 0) return null;
    const points = await q<PointRow>(
      `SELECT date, speed, battery_level, latitude, longitude, elevation, power FROM (
         SELECT p.date, p.speed, p.battery_level, p.latitude, p.longitude, p.elevation, p.power,
                row_number() OVER (ORDER BY p.date) AS rn,
                count(*) OVER () AS total
         FROM positions p WHERE p.drive_id = $1
       ) t
       WHERE rn % greatest(1, ceil(total::numeric / 500)::int) = 0 OR rn = 1 OR rn = total
       ORDER BY date`,
      [id],
    );
    return { ...mapDriveRow(rows[0]), points: points.map(mapDrivePoint) };
  });
}
