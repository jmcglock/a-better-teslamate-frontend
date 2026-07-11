export type LengthUnit = "km" | "mi";
export type TempUnit = "C" | "F";
export type PressureUnit = "bar" | "psi";

export const KM_PER_MI = 1.609344;
export const PSI_PER_BAR = 14.503773773;
const DASH = "–";

export function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function kmToUnit(km: number, unit: LengthUnit): number {
  return unit === "mi" ? km / KM_PER_MI : km;
}

export function formatDistance(km: number | null, unit: LengthUnit, digits = 1): string {
  if (km === null) return DASH;
  return `${kmToUnit(km, unit).toFixed(digits)} ${unit}`;
}

export function formatSpeed(kmh: number | null, unit: LengthUnit): string {
  if (kmh === null) return DASH;
  return unit === "mi" ? `${Math.round(kmh / KM_PER_MI)} mph` : `${Math.round(kmh)} km/h`;
}

export function formatTemp(c: number | null, unit: TempUnit): string {
  if (c === null) return DASH;
  const v = unit === "F" ? c * 1.8 + 32 : c;
  return `${v.toFixed(1)} °${unit}`;
}

export function formatDuration(min: number | null): string {
  if (min === null) return DASH;
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

export function formatEnergy(kwh: number | null): string {
  return kwh === null ? DASH : `${kwh.toFixed(1)} kWh`;
}

/** whPerKm is always Wh/km; converts for mi display. */
export function formatEfficiency(whPerKm: number | null, unit: LengthUnit): string {
  if (whPerKm === null) return DASH;
  if (unit === "mi") return `${Math.round(whPerKm * KM_PER_MI)} Wh/mi`;
  return `${Math.round(whPerKm)} Wh/km`;
}

export function formatPower(kw: number | null): string {
  return kw === null ? DASH : `${Math.round(kw)} kW`;
}

export function formatPct(v: number | null): string {
  return v === null ? DASH : `${Math.round(v)}%`;
}

export function formatOdometer(km: number | null, unit: LengthUnit): string {
  if (km === null) return DASH;
  return `${Math.round(kmToUnit(km, unit)).toLocaleString("en-US")} ${unit}`;
}

/** TeslaMate stores tyre pressure in bar. */
export function formatPressure(bar: number | null, unit: PressureUnit): string {
  if (bar === null) return DASH;
  return unit === "psi" ? `${Math.round(bar * PSI_PER_BAR)} psi` : `${bar.toFixed(1)} bar`;
}

export function formatCost(v: number | null, symbol = "$"): string {
  return v === null ? DASH : `${symbol}${v.toFixed(2)}`;
}
