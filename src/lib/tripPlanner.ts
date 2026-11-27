import { KM_PER_MI, type LengthUnit, type TempUnit } from "@/lib/format";

export type TempBucket = { tempC: number; whPerKm: number; distanceKm: number };

export type TripInput = {
  distanceKm: number;
  tempC: number;
  startSocPct: number;
  /** Usable pack energy at 100% SoC. */
  capacityKwh: number;
  reservePct?: number;
};

export type EfficiencyEstimate = {
  whPerKm: number;
  /** Logged distance behind the estimate. */
  sampleKm: number;
  /** Temperature window actually used, in °C either side of the target. */
  windowC: number;
  /** Target sits outside the temperatures this car has been driven in. */
  extrapolated: boolean;
};

export type TripPlan = {
  efficiency: EfficiencyEstimate;
  energyKwh: number;
  usedPct: number;
  arrivalSocPct: number;
  reservePct: number;
  /** Arrival SoC is at or above the reserve. */
  feasible: boolean;
  /** Distance that can be driven from start SoC down to the reserve at this temperature. */
  rangeToReserveKm: number;
  /** Minimum start SoC to arrive with the reserve left (may exceed 100). */
  requiredStartSocPct: number;
};

export const DEFAULT_RESERVE_PCT = 10;
const MIN_SAMPLE_KM = 50;
const MAX_WINDOW_C = 10;

/**
 * Distance-weighted Wh/km near a target temperature. Widens the window one
 * degree at a time until enough driving is behind the number; outside the
 * observed range it falls back to the nearest edge of the data.
 */
export function estimateEfficiency(buckets: TempBucket[], tempC: number): EfficiencyEstimate | null {
  const usable = buckets.filter((b) => b.whPerKm > 0 && b.distanceKm > 0);
  if (usable.length === 0) return null;

  const temps = usable.map((b) => b.tempC);
  const minT = Math.min(...temps);
  const maxT = Math.max(...temps);
  const extrapolated = tempC < minT || tempC > maxT;
  const target = Math.min(maxT, Math.max(minT, tempC));
  const totalKm = usable.reduce((s, b) => s + b.distanceKm, 0);
  const needKm = Math.min(MIN_SAMPLE_KM, totalKm);

  for (let w = 0; w <= MAX_WINDOW_C; w++) {
    const near = usable.filter((b) => Math.abs(b.tempC - target) <= w);
    const km = near.reduce((s, b) => s + b.distanceKm, 0);
    if (km >= needKm || w === MAX_WINDOW_C) {
      if (km <= 0) break;
      const wh = near.reduce((s, b) => s + b.whPerKm * b.distanceKm, 0) / km;
      return { whPerKm: wh, sampleKm: km, windowC: w, extrapolated };
    }
  }

  const wh = usable.reduce((s, b) => s + b.whPerKm * b.distanceKm, 0) / totalKm;
  return { whPerKm: wh, sampleKm: totalKm, windowC: Infinity, extrapolated };
}

export function planTrip(buckets: TempBucket[], input: TripInput): TripPlan | null {
  const { distanceKm, tempC, startSocPct, capacityKwh } = input;
  const reservePct = input.reservePct ?? DEFAULT_RESERVE_PCT;
  if (!(distanceKm > 0) || !(capacityKwh > 0) || !Number.isFinite(tempC)) return null;
  const efficiency = estimateEfficiency(buckets, tempC);
  if (!efficiency) return null;

  const energyKwh = (distanceKm * efficiency.whPerKm) / 1000;
  const usedPct = (energyKwh / capacityKwh) * 100;
  const arrivalSocPct = startSocPct - usedPct;
  const pctPerKm = usedPct / distanceKm;
  return {
    efficiency,
    energyKwh,
    usedPct,
    arrivalSocPct,
    reservePct,
    feasible: arrivalSocPct >= reservePct,
    rangeToReserveKm: Math.max(0, (startSocPct - reservePct) / pctPerKm),
    requiredStartSocPct: reservePct + usedPct,
  };
}

/** Parses a numeric query value, returning null when missing or out of bounds. */
export function parseBounded(v: string | undefined, min: number, max: number): number | null {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export function toKm(v: number, unit: LengthUnit): number {
  return unit === "mi" ? v * KM_PER_MI : v;
}

export function toCelsius(v: number, unit: TempUnit): number {
  return unit === "F" ? (v - 32) / 1.8 : v;
}
