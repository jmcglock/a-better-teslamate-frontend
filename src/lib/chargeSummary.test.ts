import { describe, expect, it } from "vitest";
import { summarizeCharges } from "./chargeSummary";

describe("summarizeCharges", () => {
  it("returns zeros and null averages for no charges", () => {
    expect(summarizeCharges([])).toEqual({
      sessions: 0,
      energyKwh: 0,
      cost: 0,
      avgCostPerKwh: null,
      avgDurationMin: null,
    });
  });

  it("aggregates energy, cost, and averages", () => {
    const charges = [
      { energyAddedKwh: 10, cost: 4, durationMin: 30 },
      { energyAddedKwh: 20, cost: 6, durationMin: 60 },
    ] as any;
    expect(summarizeCharges(charges)).toMatchObject({
      sessions: 2,
      energyKwh: 30,
      cost: 10,
      avgCostPerKwh: 1 / 3,
      avgDurationMin: 45,
    });
  });
});