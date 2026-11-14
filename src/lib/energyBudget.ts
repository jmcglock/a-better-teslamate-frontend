export type EnergyChargeMonth = {
  month: string;
  wallKwh: number;
  packKwh: number;
  cost: number;
};

export type EnergyDriveMonth = {
  month: string;
  distanceKm: number;
  rangeUsedKm: number;
};

export type EnergyMonth = {
  month: string;
  label: string;
  wallKwh: number;
  packKwh: number;
  chargingLossKwh: number;
  drivingKwh: number | null;
  unaccountedKwh: number | null;
  cost: number;
  costPerUsefulKwh: number | null;
};

export type EnergyBudgetInsights = {
  summary: {
    wallKwh: number;
    packKwh: number;
    chargingLossKwh: number;
    drivingKwh: number | null;
    unaccountedKwh: number | null;
    cost: number;
    costPerUsefulKwh: number | null;
    chargingLossPct: number | null;
  };
  monthly: EnergyMonth[];
};

const round = (v: number, places: number) => Math.round(v * 10 ** places) / 10 ** places;

function monthLabelFromKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
  return `${d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} ${String(y).slice(-2)}`;
}

export function buildEnergyBudget(
  chargeMonths: EnergyChargeMonth[],
  driveMonths: EnergyDriveMonth[],
  efficiencyWhPerKm: number | null,
): EnergyBudgetInsights {
  const driveByMonth = new Map(driveMonths.map((d) => [d.month, d]));
  const keys = [...new Set([...chargeMonths.map((c) => c.month), ...driveByMonth.keys()])].sort();

  const monthly: EnergyMonth[] = keys.map((key) => {
    const charge = chargeMonths.find((c) => c.month === key);
    const drive = driveByMonth.get(key);
    const wallKwh = round(charge?.wallKwh ?? 0, 1);
    const packKwh = round(charge?.packKwh ?? 0, 1);
    const chargingLossKwh = round(Math.max(0, wallKwh - packKwh), 1);
    const rangeUsedKm = drive?.rangeUsedKm ?? 0;
    const drivingKwh =
      efficiencyWhPerKm && rangeUsedKm > 0
        ? round((rangeUsedKm * efficiencyWhPerKm) / 1000, 1)
        : null;
    const unaccountedKwh =
      drivingKwh === null ? null : round(Math.max(0, packKwh - drivingKwh), 1);
    const cost = round(charge?.cost ?? 0, 2);
    return {
      month: key,
      label: monthLabelFromKey(key),
      wallKwh,
      packKwh,
      chargingLossKwh,
      drivingKwh,
      unaccountedKwh,
      cost,
      costPerUsefulKwh: drivingKwh && drivingKwh > 0 ? round(cost / drivingKwh, 3) : null,
    };
  });

  const wallKwh = round(monthly.reduce((s, m) => s + m.wallKwh, 0), 1);
  const packKwh = round(monthly.reduce((s, m) => s + m.packKwh, 0), 1);
  const chargingLossKwh = round(monthly.reduce((s, m) => s + m.chargingLossKwh, 0), 1);
  const drivingValues = monthly.map((m) => m.drivingKwh).filter((v): v is number => v !== null);
  const drivingKwh = drivingValues.length ? round(drivingValues.reduce((s, v) => s + v, 0), 1) : null;
  const unaccountedValues = monthly.map((m) => m.unaccountedKwh).filter((v): v is number => v !== null);
  const unaccountedKwh = unaccountedValues.length ? round(unaccountedValues.reduce((s, v) => s + v, 0), 1) : null;
  const cost = round(monthly.reduce((s, m) => s + m.cost, 0), 2);

  return {
    summary: {
      wallKwh,
      packKwh,
      chargingLossKwh,
      drivingKwh,
      unaccountedKwh,
      cost,
      costPerUsefulKwh: drivingKwh && drivingKwh > 0 ? round(cost / drivingKwh, 3) : null,
      chargingLossPct: wallKwh > 0 ? round((chargingLossKwh / wallKwh) * 100, 1) : null,
    },
    monthly,
  };
}