import { describe, expect, it } from "vitest";
import { buildEnergyBudget } from "./energyBudget";

describe("buildEnergyBudget", () => {
  it("reconciles wall, pack, driving, and losses", () => {
    const result = buildEnergyBudget(
      [{ month: "2026-01", wallKwh: 110, packKwh: 100, cost: 40 }],
      [{ month: "2026-01", distanceKm: 200, rangeUsedKm: 100 }],
      150,
    );
    expect(result.monthly[0].chargingLossKwh).toBe(10);
    expect(result.monthly[0].drivingKwh).toBe(15);
    expect(result.monthly[0].unaccountedKwh).toBe(75);
    expect(result.summary.costPerUsefulKwh).toBeCloseTo(2.667, 3);
  });

  it("handles missing drive data", () => {
    const result = buildEnergyBudget(
      [{ month: "2026-01", wallKwh: 50, packKwh: 45, cost: 10 }],
      [],
      150,
    );
    expect(result.monthly[0].drivingKwh).toBeNull();
    expect(result.monthly[0].unaccountedKwh).toBeNull();
    expect(result.summary.chargingLossPct).toBe(10);
  });
});