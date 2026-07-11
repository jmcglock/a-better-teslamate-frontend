import { num } from "@/lib/format";
import { q } from "./pool";

export type ChargeRow = {
  id: number; start_date: Date; end_date: Date | null;
  charge_energy_added: string | null; charge_energy_used: string | null; cost: string | null;
  duration_min: number | null; start_battery_level: number | null; end_battery_level: number | null;
  location: string | null; max_power: number | null;
};

export type ChargeListItem = {
  id: number; startDate: string; endDate: string | null; location: string;
  energyAddedKwh: number | null; energyUsedKwh: number | null; cost: number | null;
  durationMin: number | null; socStart: number | null; socEnd: number | null; maxPowerKw: number | null;
};

export type CurveRow = { date: Date; charger_power: number | null; battery_level: number | null };
export type CurvePoint = { t: number; power: number | null; soc: number | null };
export type ChargeDetail = ChargeListItem & { points: CurvePoint[] };

export function mapChargeRow(r: ChargeRow): ChargeListItem {
  return {
    id: r.id,
    startDate: r.start_date.toISOString(),
    endDate: r.end_date ? r.end_date.toISOString() : null,
    location: r.location ?? "Unknown location",
    energyAddedKwh: num(r.charge_energy_added),
    energyUsedKwh: num(r.charge_energy_used),
    cost: num(r.cost),
    durationMin: r.duration_min,
    socStart: r.start_battery_level,
    socEnd: r.end_battery_level,
    maxPowerKw: r.max_power,
  };
}

export function mapCurvePoint(r: CurveRow): CurvePoint {
  return { t: r.date.getTime(), power: r.charger_power, soc: r.battery_level };
}

const CHARGE_SELECT = `
  SELECT cp.id, cp.start_date, cp.end_date, cp.charge_energy_added, cp.charge_energy_used,
         cp.cost, cp.duration_min, cp.start_battery_level, cp.end_battery_level,
         COALESCE(g.name, a.city, a.display_name) AS location,
         (SELECT max(ch.charger_power) FROM charges ch WHERE ch.charging_process_id = cp.id) AS max_power
  FROM charging_processes cp
  LEFT JOIN addresses a ON a.id = cp.address_id
  LEFT JOIN geofences g ON g.id = cp.geofence_id
`;

export async function listCharges(
  page: number,
  pageSize = 50,
): Promise<{ items: ChargeListItem[]; hasMore: boolean }> {
  const rows = await q<ChargeRow>(
    `${CHARGE_SELECT} WHERE cp.charge_energy_added > 0.1 ORDER BY cp.start_date DESC LIMIT $1 OFFSET $2`,
    [pageSize + 1, (page - 1) * pageSize],
  );
  return { items: rows.slice(0, pageSize).map(mapChargeRow), hasMore: rows.length > pageSize };
}

export async function getCharge(id: number): Promise<ChargeDetail | null> {
  const rows = await q<ChargeRow>(`${CHARGE_SELECT} WHERE cp.id = $1`, [id]);
  if (rows.length === 0) return null;
  const points = await q<CurveRow>(
    `SELECT date, charger_power, battery_level FROM (
       SELECT ch.date, ch.charger_power, ch.battery_level,
              row_number() OVER (ORDER BY ch.date) AS rn,
              count(*) OVER () AS total
       FROM charges ch WHERE ch.charging_process_id = $1
     ) t
     WHERE rn % greatest(1, ceil(total::numeric / 500)::int) = 0 OR rn = 1 OR rn = total
     ORDER BY date`,
    [id],
  );
  return { ...mapChargeRow(rows[0]), points: points.map(mapCurvePoint) };
}
