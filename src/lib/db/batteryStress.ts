import { cached } from "@/lib/cache";
import { num } from "@/lib/format";
import {
  buildBatteryStress,
  type BatteryStress,
  type ChargeEndSoc,
  type DailySocRange,
  type SocSample,
} from "@/lib/batteryStress";
import { sinceMonthsSql } from "./range";
import { localTs, q } from "./pool";

const STRESS_TTL_MS = 5 * 60_000;

type SocSampleRow = {
  soc: string | number | null;
  hours: string | number | null;
  outside_temp: string | number | null;
};

type DailySocRow = {
  day: Date;
  min_soc: string | number | null;
  max_soc: string | number | null;
};

type EndSocRow = {
  end_soc: string | number | null;
  energy: string | number | null;
};

type EnergyRow = {
  energy: string | number | null;
};

export function mapSocSampleRow(row: SocSampleRow): SocSample | null {
  const soc = num(row.soc);
  const hours = num(row.hours);
  if (soc === null || hours === null || hours <= 0) return null;
  return { soc, hours, outsideTempC: num(row.outside_temp) };
}

export function mapDailySocRow(row: DailySocRow): DailySocRange | null {
  const minSoc = num(row.min_soc);
  const maxSoc = num(row.max_soc);
  if (minSoc === null || maxSoc === null) return null;
  return { date: row.day.toISOString().slice(0, 10), minSoc, maxSoc };
}

export function mapEndSocRow(row: EndSocRow): ChargeEndSoc | null {
  const endSoc = num(row.end_soc);
  if (endSoc === null) return null;
  return { endSoc, energyKwh: num(row.energy) };
}

type SocBucketRow = {
  day: Date;
  soc: string | number | null;
  min_soc: string | number | null;
  max_soc: string | number | null;
  outside_temp: string | number | null;
  hours: string | number | null;
};

type SocBuckets = { samples: SocSample[]; daily: DailySocRange[] };

/**
 * One pass over positions, hash-aggregated into 10-minute buckets. Each bucket
 * is weighted by the time until the next bucket (capped at 6 hours so long
 * offline periods do not dominate exposure) and also feeds the per-day SoC
 * range. Avoids sorting millions of raw rows.
 */
async function getSocBuckets(carId: number, months: number | null): Promise<SocBuckets> {
  const key = `socBuckets:${carId}:${months ?? "all"}`;
  return cached(key, STRESS_TTL_MS, async () => {
    const params: unknown[] = [carId];
    const rows = await q<SocBucketRow>(`
      WITH buckets AS (
        SELECT floor(extract(epoch FROM p.date) / 600) AS bucket,
               min(p.date) AS date,
               avg(p.battery_level) AS soc,
               min(p.battery_level) AS min_soc,
               max(p.battery_level) AS max_soc,
               avg(p.outside_temp) AS outside_temp
        FROM positions p
        WHERE p.car_id = $1 AND p.battery_level IS NOT NULL${sinceMonthsSql("p.date", months, params)}
        GROUP BY 1
      )
      SELECT date_trunc('day', ${localTs("date")}) AS day,
             soc, min_soc, max_soc, outside_temp,
             extract(epoch FROM LEAST(
               lead(date) OVER (ORDER BY date) - date,
               interval '6 hours'
             )) / 3600 AS hours
      FROM buckets
      ORDER BY date
    `, params);

    const samples: SocSample[] = [];
    const days = new Map<number, DailySocRow>();
    for (const row of rows) {
      const sample = mapSocSampleRow(row);
      if (sample) samples.push(sample);
      const minSoc = num(row.min_soc);
      const maxSoc = num(row.max_soc);
      if (minSoc === null || maxSoc === null) continue;
      const t = row.day.getTime();
      const prev = days.get(t);
      if (!prev) {
        days.set(t, { day: row.day, min_soc: minSoc, max_soc: maxSoc });
      } else {
        prev.min_soc = Math.min(num(prev.min_soc) ?? minSoc, minSoc);
        prev.max_soc = Math.max(num(prev.max_soc) ?? maxSoc, maxSoc);
      }
    }
    const daily = [...days.values()].flatMap((row) => {
      const range = mapDailySocRow(row);
      return range === null ? [] : [range];
    });
    return { samples, daily };
  });
}

/** SoC samples downsampled to 10-minute buckets, weighted by hours held. */
export async function getSocSamples(
  carId: number,
  months: number | null,
): Promise<SocSample[]> {
  return (await getSocBuckets(carId, months)).samples;
}

/** Per-day observed SoC range, used for depth-of-discharge. */
export async function getDailySocRanges(
  carId: number,
  months: number | null,
): Promise<DailySocRange[]> {
  return (await getSocBuckets(carId, months)).daily;
}

/** SoC at the end of each charging session, for the charge-target distribution. */
export async function getChargeEndSocs(
  carId: number,
  months: number | null,
): Promise<ChargeEndSoc[]> {
  const key = `chargeEndSocs:${carId}:${months ?? "all"}`;
  return cached(key, STRESS_TTL_MS, async () => {
    const params: unknown[] = [carId];
    const rows = await q<EndSocRow>(`
      SELECT end_battery_level AS end_soc, charge_energy_added AS energy
      FROM charging_processes
      WHERE car_id = $1 AND end_battery_level IS NOT NULL${sinceMonthsSql("start_date", months, params)}
    `, params);
    return rows.flatMap((row) => {
      const charge = mapEndSocRow(row);
      return charge === null ? [] : [charge];
    });
  });
}

/** Energy added across charging sessions; the numerator for equivalent cycles. */
export async function getEnergyThroughput(
  carId: number,
  months: number | null,
): Promise<number> {
  const key = `energyThroughput:${carId}:${months ?? "all"}`;
  return cached(key, STRESS_TTL_MS, async () => {
    const params: unknown[] = [carId];
    const rows = await q<EnergyRow>(`
      SELECT coalesce(sum(charge_energy_added), 0) AS energy
      FROM charging_processes
      WHERE car_id = $1 AND charge_energy_added > 0.1${sinceMonthsSql("start_date", months, params)}
    `, params);
    return num(rows[0]?.energy) ?? 0;
  });
}

/** Full battery-stress roll-up for one car and calendar window. */
export async function getBatteryStress(
  carId: number,
  months: number | null,
  packKwh: number | null,
): Promise<BatteryStress> {
  const packKey = packKwh === null ? "na" : packKwh.toFixed(2);
  return cached(`batteryStress:${carId}:${months ?? "all"}:${packKey}`, STRESS_TTL_MS, async () => {
    const [samples, daily, endSocs, energyThroughputKwh] = await Promise.all([
      getSocSamples(carId, months),
      getDailySocRanges(carId, months),
      getChargeEndSocs(carId, months),
      getEnergyThroughput(carId, months),
    ]);
    return buildBatteryStress({ samples, daily, endSocs, energyThroughputKwh, packKwh });
  });
}

/** Aliases kept for callers that prefer a "load" verb. */
export const loadBatteryStress = getBatteryStress;
export const fetchBatteryStress = getBatteryStress;
