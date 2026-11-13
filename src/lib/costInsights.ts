export type ChargeMonth = {
  /** YYYY-MM (UTC) */
  month: string;
  sessions: number;
  sessionsWithCost: number;
  energyKwh: number;
  /** Energy from sessions that have a cost — the denominator for avg rate. */
  costEnergyKwh: number;
  cost: number;
};

export type DriveMonth = {
  month: string;
  distanceKm: number;
};

export type PlaceCost = {
  location: string;
  sessions: number;
  sessionsWithCost: number;
  energyKwh: number;
  costEnergyKwh: number;
  cost: number;
  lastVisit: string | null;
};

export type CostMonthPoint = {
  month: string;
  label: string;
  cost: number;
  energyKwh: number;
  distanceKm: number;
  avgCostPerKwh: number | null;
  costPer100Km: number | null;
};

export type CostPlacePoint = PlaceCost & {
  avgCostPerKwh: number | null;
};

export type CostOpportunity = {
  cheapest: { location: string; avgCostPerKwh: number };
  priciest: { location: string; avgCostPerKwh: number };
  /** Spend above the cheapest known rate, across priced energy. */
  potentialSavings: number;
};

export type CostInsights = {
  summary: {
    sessions: number;
    sessionsWithCost: number;
    costCoveragePct: number | null;
    energyKwh: number;
    costEnergyKwh: number;
    cost: number;
    distanceKm: number;
    avgCostPerKwh: number | null;
    costPer100Km: number | null;
  };
  monthly: CostMonthPoint[];
  places: CostPlacePoint[];
  opportunity: CostOpportunity | null;
};

const round = (v: number, places: number) => {
  const p = 10 ** places;
  return Math.round(v * p) / p;
};

export function monthLabelFromKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${month} ${String(y).slice(-2)}`;
}

function avgRate(cost: number, costEnergyKwh: number): number | null {
  if (costEnergyKwh <= 0) return null;
  return round(cost / costEnergyKwh, 3);
}

function perDistance(cost: number, distanceKm: number, hasCost: boolean): number | null {
  if (!hasCost || distanceKm <= 0) return null;
  return round((cost / distanceKm) * 100, 2);
}

/** Pure roll-up so the page math is unit-testable without Postgres. */
export function buildCostInsights(
  chargeMonths: ChargeMonth[],
  driveMonths: DriveMonth[],
  places: PlaceCost[],
): CostInsights {
  const driveByMonth = new Map(driveMonths.map((d) => [d.month, d.distanceKm]));
  const chargeByMonth = new Map(chargeMonths.map((c) => [c.month, c]));
  const keys = [...new Set([...driveByMonth.keys(), ...chargeByMonth.keys()])].sort();

  const monthly: CostMonthPoint[] = keys.map((key) => {
    const charge = chargeByMonth.get(key);
    const distanceKm = round(driveByMonth.get(key) ?? 0, 1);
    const cost = round(charge?.cost ?? 0, 2);
    const energyKwh = round(charge?.energyKwh ?? 0, 1);
    const hasCost = (charge?.sessionsWithCost ?? 0) > 0;
    return {
      month: key,
      label: monthLabelFromKey(key),
      cost,
      energyKwh,
      distanceKm,
      avgCostPerKwh: hasCost ? avgRate(cost, charge?.costEnergyKwh ?? 0) : null,
      costPer100Km: perDistance(cost, distanceKm, hasCost),
    };
  });

  const sessions = chargeMonths.reduce((s, m) => s + m.sessions, 0);
  const sessionsWithCost = chargeMonths.reduce((s, m) => s + m.sessionsWithCost, 0);
  const energyKwh = round(chargeMonths.reduce((s, m) => s + m.energyKwh, 0), 1);
  const costEnergyKwh = round(chargeMonths.reduce((s, m) => s + m.costEnergyKwh, 0), 1);
  const cost = round(chargeMonths.reduce((s, m) => s + m.cost, 0), 2);
  const distanceKm = round(driveMonths.reduce((s, m) => s + m.distanceKm, 0), 1);

  const placePoints: CostPlacePoint[] = places
    .map((p) => ({
      ...p,
      energyKwh: round(p.energyKwh, 1),
      costEnergyKwh: round(p.costEnergyKwh, 1),
      cost: round(p.cost, 2),
      avgCostPerKwh: p.sessionsWithCost > 0 ? avgRate(p.cost, p.costEnergyKwh) : null,
    }))
    .sort((a, b) => {
      const byCost = b.cost - a.cost;
      return byCost !== 0 ? byCost : b.energyKwh - a.energyKwh;
    });

  const priced = placePoints.filter(
    (p): p is CostPlacePoint & { avgCostPerKwh: number } =>
      p.avgCostPerKwh !== null && p.costEnergyKwh > 0,
  );
  let opportunity: CostOpportunity | null = null;
  if (priced.length >= 2) {
    const byRate = [...priced].sort((a, b) => a.avgCostPerKwh - b.avgCostPerKwh);
    const cheapest = byRate[0];
    const priciest = byRate[byRate.length - 1];
    if (priciest.avgCostPerKwh > cheapest.avgCostPerKwh) {
      const potential = priced.reduce(
        (sum, p) => sum + Math.max(0, p.avgCostPerKwh - cheapest.avgCostPerKwh) * p.costEnergyKwh,
        0,
      );
      opportunity = {
        cheapest: { location: cheapest.location, avgCostPerKwh: cheapest.avgCostPerKwh },
        priciest: { location: priciest.location, avgCostPerKwh: priciest.avgCostPerKwh },
        potentialSavings: round(potential, 2),
      };
    }
  }

  return {
    summary: {
      sessions,
      sessionsWithCost,
      costCoveragePct: sessions > 0 ? round((sessionsWithCost / sessions) * 100, 0) : null,
      energyKwh,
      costEnergyKwh,
      cost,
      distanceKm,
      avgCostPerKwh: sessionsWithCost > 0 ? avgRate(cost, costEnergyKwh) : null,
      costPer100Km: perDistance(cost, distanceKm, sessionsWithCost > 0),
    },
    monthly,
    places: placePoints,
    opportunity,
  };
}
