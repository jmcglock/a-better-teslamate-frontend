import { cached } from "@/lib/cache";
import { num } from "@/lib/format";
import {
  buildChargingPerformance,
  type ChargeLabSession,
  type SocBin,
} from "@/lib/chargingPerformance";
import { sinceMonthsSql } from "./range";
import { q } from "./pool";

const TTL_MS = 5 * 60_000;

type SocBinRow = {
  bin: string | number | null;
  avg_power: string | number | null;
  samples: string | number | null;
  sessions: string | number | null;
};

type SessionRow = {
  id: number;
  location: string | null;
  peak_power: string | number | null;
  first_80: Date | null;
  start_date: Date;
  energy_added: string | number | null;
  energy_used: string | number | null;
  duration_min: string | number | null;
};

export async function getChargingPerformanceInsights(carId: number, months: number | null) {
  const key = `chargeLab:${carId}:${months ?? "all"}`;
  return cached(key, TTL_MS, async () => {
    const params: unknown[] = [carId];
    const monthSql = sinceMonthsSql("cp.start_date", months, params);

    const binRows = await q<SocBinRow>(`
      SELECT floor(ch.battery_level / 5)::int * 5 AS bin,
             avg(ch.charger_power) AS avg_power,
             count(*)::int AS samples,
             count(DISTINCT ch.charging_process_id)::int AS sessions
      FROM charges ch
      JOIN charging_processes cp ON cp.id = ch.charging_process_id
      WHERE cp.car_id = $1
        AND ch.battery_level IS NOT NULL
        AND ch.charger_power IS NOT NULL
        AND ch.charger_power > 0${monthSql}
      GROUP BY 1 ORDER BY 1
    `, params);

    const params2: unknown[] = [carId];
    const monthSql2 = sinceMonthsSql("cp.start_date", months, params2);
    const sessionRows = await q<SessionRow>(`
      SELECT cp.id,
             COALESCE(g.name, a.city, a.display_name) AS location,
             max(ch.charger_power) AS peak_power,
             min(ch.date) FILTER (WHERE ch.battery_level >= 80) AS first_80,
             cp.start_date,
             cp.charge_energy_added AS energy_added,
             cp.charge_energy_used AS energy_used,
             cp.duration_min
      FROM charging_processes cp
      LEFT JOIN charges ch ON ch.charging_process_id = cp.id
      LEFT JOIN addresses a ON a.id = cp.address_id
      LEFT JOIN geofences g ON g.id = cp.geofence_id
      WHERE cp.car_id = $1 AND cp.charge_energy_added > 0.1${monthSql2}
      GROUP BY cp.id, location, cp.start_date, cp.charge_energy_added, cp.charge_energy_used, cp.duration_min
      ORDER BY cp.start_date DESC
    `, params2);

    const bins: SocBin[] = binRows.map((r) => ({
      binStart: Number(r.bin ?? 0),
      avgPowerKw: num(r.avg_power),
      samples: Number(r.samples ?? 0),
      sessions: Number(r.sessions ?? 0),
    }));

    const sessions: ChargeLabSession[] = sessionRows.map((r) => {
      const timeTo80 =
        r.first_80 && r.start_date
          ? Math.max(0, (r.first_80.getTime() - r.start_date.getTime()) / 60000)
          : null;
      return {
        id: r.id,
        location: r.location ?? "Unknown location",
        peakPowerKw: num(r.peak_power),
        timeTo80Min: timeTo80 === null ? null : Math.round(timeTo80 * 10) / 10,
        energyAddedKwh: num(r.energy_added) ?? 0,
        energyUsedKwh: num(r.energy_used) ?? num(r.energy_added) ?? 0,
        durationMin: num(r.duration_min),
      };
    });

    return buildChargingPerformance(sessions, bins);
  });
}