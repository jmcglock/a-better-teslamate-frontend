import { describe, expect, it } from "vitest";
import { buildCostInsights } from "./costInsights";

describe("buildCostInsights", () => {
  it("reports cost coverage from priced sessions only", () => {
    const result = buildCostInsights(
      [
        { month: "2026-01", sessions: 4, sessionsWithCost: 2, energyKwh: 40, costEnergyKwh: 20, cost: 8 },
        { month: "2026-02", sessions: 2, sessionsWithCost: 0, energyKwh: 15, costEnergyKwh: 0, cost: 0 },
      ],
      [],
      [],
    );

    expect(result.summary.sessions).toBe(6);
    expect(result.summary.sessionsWithCost).toBe(2);
    expect(result.summary.costCoveragePct).toBe(33);
    expect(result.summary.avgCostPerKwh).toBe(0.4);
    expect(result.summary.costPer100Km).toBeNull();
  });

  it("aligns charge and drive months and computes cost per 100 km", () => {
    const result = buildCostInsights(
      [
        { month: "2026-01", sessions: 2, sessionsWithCost: 2, energyKwh: 20, costEnergyKwh: 20, cost: 10 },
        { month: "2026-02", sessions: 1, sessionsWithCost: 1, energyKwh: 10, costEnergyKwh: 10, cost: 4 },
      ],
      [
        { month: "2026-01", distanceKm: 120 },
        { month: "2026-02", distanceKm: 100 },
        { month: "2026-03", distanceKm: 50 },
      ],
      [],
    );

    expect(result.monthly.map((m) => m.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(result.monthly[0]).toMatchObject({
      month: "2026-01",
      cost: 10,
      energyKwh: 20,
      distanceKm: 120,
      avgCostPerKwh: 0.5,
      costPer100Km: 8.33,
    });
    expect(result.monthly[1].costPer100Km).toBe(4);
    expect(result.monthly[2].costPer100Km).toBeNull();
    expect(result.summary.distanceKm).toBe(270);
    expect(result.summary.costPer100Km).toBeCloseTo(5.19, 2);
  });

  it("extrapolates the priced rate over unpriced energy for cost per 100 km", () => {
    const result = buildCostInsights(
      [{ month: "2026-01", sessions: 2, sessionsWithCost: 1, energyKwh: 40, costEnergyKwh: 20, cost: 5 }],
      [{ month: "2026-01", distanceKm: 200 }],
      [],
    );
    // $0.25/kWh × 40 kWh over 200 km
    expect(result.monthly[0].costPer100Km).toBe(5);
    expect(result.summary.costPer100Km).toBe(5);
  });

  it("finds a savings opportunity from the cheapest priced location", () => {
    const result = buildCostInsights(
      [],
      [],
      [
        { location: "Home", sessions: 10, sessionsWithCost: 10, energyKwh: 100, costEnergyKwh: 100, cost: 30, lastVisit: null },
        { location: "Supercharger", sessions: 4, sessionsWithCost: 4, energyKwh: 40, costEnergyKwh: 40, cost: 24, lastVisit: null },
        { location: "Free", sessions: 2, sessionsWithCost: 0, energyKwh: 10, costEnergyKwh: 0, cost: 0, lastVisit: null },
      ],
    );

    expect(result.opportunity).not.toBeNull();
    expect(result.opportunity?.cheapest.location).toBe("Home");
    expect(result.opportunity?.cheapest.avgCostPerKwh).toBe(0.3);
    expect(result.opportunity?.priciest.location).toBe("Supercharger");
    expect(result.opportunity?.potentialSavings).toBeCloseTo(12, 5);
    expect(result.places[0].location).toBe("Home");
  });
});