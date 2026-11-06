import type { ChargeListItem } from "@/lib/db/charges";

export type ChargeSummary = {
  sessions: number;
  energyKwh: number;
  cost: number;
  avgCostPerKwh: number | null;
  avgDurationMin: number | null;
};

/** Aggregate charge sessions for a summary panel. Null averages mean "no data". */
export function summarizeCharges(charges: readonly ChargeListItem[]): ChargeSummary {
  const sessions = charges.length;
  const energyKwh = charges.reduce((sum, charge) => sum + (charge.energyAddedKwh ?? 0), 0);
  const cost = charges.reduce((sum, charge) => sum + (charge.cost ?? 0), 0);
  const durationTotal = charges.reduce((sum, charge) => sum + (charge.durationMin ?? 0), 0);
  const durationCount = charges.filter((charge) => charge.durationMin !== null).length;
  return {
    sessions,
    energyKwh,
    cost,
    avgCostPerKwh: energyKwh > 0 ? cost / energyKwh : null,
    avgDurationMin: durationCount > 0 ? durationTotal / durationCount : null,
  };
}