import { cached } from "@/lib/cache";
import { num } from "@/lib/format";
import {
  buildUpdateImpact,
  type ImpactSamples,
  type UpdateEvent,
  type VersionImpact,
} from "@/lib/updateImpact";
import { q } from "./pool";

const TTL_MS = 5 * 60_000;

type UpdateRow = { id: number; version: string | null; start_date: Date; end_date: Date | null };
type DriveRow = { start_date: Date; distance: string | number | null; start_rated_range_km: string | number | null; end_rated_range_km: string | number | null; outside_temp_avg: string | number | null; efficiency: string | number | null };
type ChargeProcessRow = { id: number; start_date: Date; end_rated_range_km: string | number | null; end_battery_level: string | number | null; outside_temp_avg: string | number | null; peak_power: string | number | null };

export async function getUpdateImpact(carId: number): Promise<VersionImpact[]> {
  const key = `updateImpact:${carId}`;
  return cached(key, TTL_MS, async () => {
    const updates = await q<UpdateRow>(
      `SELECT u.id, u.version, u.start_date, u.end_date
       FROM updates u
       WHERE u.car_id = $1
       ORDER BY u.start_date ASC`,
      [carId],
    );

    const events: UpdateEvent[] = updates.map((u) => ({
      id: u.id,
      version: u.version ?? "unknown",
      installedAt: (u.end_date ?? u.start_date).toISOString(),
    }));

    const drives = await q<DriveRow>(
      `SELECT d.start_date, d.distance, d.start_rated_range_km, d.end_rated_range_km, d.outside_temp_avg, c.efficiency
       FROM drives d JOIN cars c ON c.id = d.car_id
       WHERE d.car_id = $1 AND d.distance > 0.1
         AND d.start_rated_range_km IS NOT NULL AND d.end_rated_range_km IS NOT NULL`,
      [carId],
    );

    const processes = await q<ChargeProcessRow>(
      `SELECT cp.id, cp.start_date, cp.end_rated_range_km, cp.end_battery_level, cp.outside_temp_avg,
              (SELECT max(ch.charger_power) FROM charges ch WHERE ch.charging_process_id = cp.id) AS peak_power
       FROM charging_processes cp
       WHERE cp.car_id = $1 AND cp.charge_energy_added > 0.1`,
      [carId],
    );

    const efficiencySamples = drives.flatMap((d) => {
      const distance = num(d.distance);
      const start = num(d.start_rated_range_km);
      const end = num(d.end_rated_range_km);
      const eff = num(d.efficiency);
      const temp = num(d.outside_temp_avg);
      if (!distance || distance <= 0 || start === null || end === null || eff === null) return [];
      const rangeUsed = Math.max(0, start - end);
      const whPerKm = (rangeUsed * eff * 1000) / distance;
      return [{ at: d.start_date.toISOString(), tempC: temp, value: whPerKm, weight: distance }];
    });

    const rangeSamples = processes.flatMap((p) => {
      const endRange = num(p.end_rated_range_km);
      const endSoc = num(p.end_battery_level);
      const temp = num(p.outside_temp_avg);
      if (endRange === null || endSoc === null || endSoc <= 0) return [];
      return [{ at: p.start_date.toISOString(), tempC: temp, value: (endRange / endSoc) * 100, weight: 1 }];
    });

    const dcSpeedSamples = processes.flatMap((p) => {
      const peak = num(p.peak_power);
      const temp = num(p.outside_temp_avg);
      if (peak === null || peak < 20) return [];
      return [{ at: p.start_date.toISOString(), tempC: temp, value: peak, weight: 1 }];
    });

    const samples: ImpactSamples = {
      efficiency: efficiencySamples,
      range: rangeSamples,
      dcSpeed: dcSpeedSamples,
      standbyDrain: [],
    };

    return buildUpdateImpact(events, samples);
  });
}