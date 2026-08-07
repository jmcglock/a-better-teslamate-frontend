import { num } from "@/lib/format";
import { q } from "./pool";

export type DriveRow = {
  id: number; start_date: Date; end_date: Date | null;
  distance: number | null; duration_min: number | null; speed_max: number | null;
  range_used_km: string | null; start_label: string | null; end_label: string | null;
  outside_temp_avg: string | null; inside_temp_avg: string | null;
  power_max: number | null; power_min: number | null;
  ascent: number | null; descent: number | null;
  start_rated_range_km: string | null; end_rated_range_km: string | null;
  efficiency: string | number | null;
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
};

export type PointRow = {
  date: Date; speed: number | null; battery_level: number | null;
  latitude: string; longitude: string;
  elevation: number | null; power: number | null;
};

export type DrivePoint = {
  t: number; speed: number | null; soc: number | null;
  lat: number; lon: number;
  elevation: number | null; power: number | null;
};

export type DriveDetail = DriveListItem & { points: DrivePoint[] };

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
  const distanceKm = r.distance;
  const carEff = num(r.efficiency);
  return {
    id: r.id,
    startDate: r.start_date.toISOString(),
    endDate: r.end_date ? r.end_date.toISOString() : null,
    distanceKm,
    durationMin: r.duration_min,
    speedMaxKmh: r.speed_max,
    rangeUsedKm,
    startLabel: r.start_label ?? "Unknown location",
    endLabel: r.end_label ?? "Unknown location",
    outsideTempAvgC: num(r.outside_temp_avg),
    insideTempAvgC: num(r.inside_temp_avg),
    powerMaxKw: r.power_max,
    powerMinKw: r.power_min,
    ascentM: r.ascent,
    descentM: r.descent,
    startRatedRangeKm: num(r.start_rated_range_km),
    endRatedRangeKm: num(r.end_rated_range_km),
    efficiencyWhPerKm: driveEfficiencyWhPerKm(rangeUsedKm, distanceKm, carEff),
  };
}

export function mapDrivePoint(r: PointRow): DrivePoint {
  return {
    t: r.date.getTime(),
    speed: r.speed,
    soc: r.battery_level,
    lat: num(r.latitude) ?? 0,
    lon: num(r.longitude) ?? 0,
    elevation: r.elevation,
    power: r.power,
  };
}

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

export async function listDrives(
  page: number,
  pageSize = 50,
): Promise<{ items: DriveListItem[]; hasMore: boolean }> {
  const rows = await q<DriveRow>(
    `${DRIVE_SELECT} WHERE d.distance > 0.1 ORDER BY d.start_date DESC LIMIT $1 OFFSET $2`,
    [pageSize + 1, (page - 1) * pageSize],
  );
  return { items: rows.slice(0, pageSize).map(mapDriveRow), hasMore: rows.length > pageSize };
}

export async function getDrive(id: number): Promise<DriveDetail | null> {
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
}
