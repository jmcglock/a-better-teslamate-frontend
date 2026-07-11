import { num } from "@/lib/format";
import { q } from "./pool";

export type CarRow = {
  id: number; name: string | null; model: string | null; marketing_name: string | null;
  latitude: string | null; longitude: string | null;
  battery_level: number | null; usable_battery_level: number | null;
  rated_battery_range_km: string | null; ideal_battery_range_km: string | null;
  odometer: number | null; inside_temp: string | null; outside_temp: string | null;
  position_date: Date | null; db_state: string | null;
};

export type CarCard = {
  id: number; name: string; model: string | null; marketingName: string | null;
  state: string; batteryLevel: number | null; usableBatteryLevel: number | null;
  ratedRangeKm: number | null; idealRangeKm: number | null; odometerKm: number | null;
  insideTempC: number | null; outsideTempC: number | null;
  latitude: number | null; longitude: number | null; positionDate: string | null;
};

export function mapCarRow(r: CarRow): CarCard {
  return {
    id: r.id,
    name: r.name ?? `Car ${r.id}`,
    model: r.model,
    marketingName: r.marketing_name,
    state: r.db_state ?? "offline",
    batteryLevel: r.battery_level,
    usableBatteryLevel: r.usable_battery_level,
    ratedRangeKm: num(r.rated_battery_range_km),
    idealRangeKm: num(r.ideal_battery_range_km),
    odometerKm: r.odometer,
    insideTempC: num(r.inside_temp),
    outsideTempC: num(r.outside_temp),
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    positionDate: r.position_date ? r.position_date.toISOString() : null,
  };
}

export async function listCarCards(): Promise<CarCard[]> {
  const rows = await q<CarRow>(`
    SELECT c.id, c.name, c.model, c.marketing_name,
           p.latitude, p.longitude, p.battery_level, p.usable_battery_level,
           p.rated_battery_range_km, p.ideal_battery_range_km, p.odometer,
           p.inside_temp, p.outside_temp, p.date AS position_date,
           (SELECT s.state FROM states s WHERE s.car_id = c.id ORDER BY s.start_date DESC LIMIT 1) AS db_state
    FROM cars c
    LEFT JOIN LATERAL (
      SELECT * FROM positions p WHERE p.car_id = c.id ORDER BY p.date DESC LIMIT 1
    ) p ON true
    ORDER BY c.display_priority NULLS LAST, c.id
  `);
  return rows.map(mapCarRow);
}
