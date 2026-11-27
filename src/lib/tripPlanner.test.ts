import { describe, expect, it } from "vitest";
import { estimateEfficiency, parseBounded, planTrip, toCelsius, toKm } from "./tripPlanner";

const buckets = [
  { tempC: -5, whPerKm: 240, distanceKm: 100 },
  { tempC: 0, whPerKm: 200, distanceKm: 100 },
  { tempC: 1, whPerKm: 180, distanceKm: 100 },
  { tempC: 20, whPerKm: 150, distanceKm: 400 },
];

describe("estimateEfficiency", () => {
  it("uses the exact bucket when it has enough distance", () => {
    const e = estimateEfficiency(buckets, 20)!;
    expect(e.whPerKm).toBe(150);
    expect(e.windowC).toBe(0);
    expect(e.extrapolated).toBe(false);
  });

  it("widens the window and weights by distance", () => {
    const sparse = [
      { tempC: 10, whPerKm: 160, distanceKm: 20 },
      { tempC: 11, whPerKm: 170, distanceKm: 20 },
      { tempC: 9, whPerKm: 200, distanceKm: 60 },
    ];
    const e = estimateEfficiency(sparse, 10)!;
    expect(e.windowC).toBe(1);
    expect(e.sampleKm).toBe(100);
    expect(e.whPerKm).toBeCloseTo((160 * 20 + 170 * 20 + 200 * 60) / 100, 6);
  });

  it("clamps to the coldest data and flags extrapolation", () => {
    const e = estimateEfficiency(buckets, -20)!;
    expect(e.extrapolated).toBe(true);
    expect(e.whPerKm).toBe(240);
  });

  it("returns null without data", () => {
    expect(estimateEfficiency([], 10)).toBeNull();
  });
});

describe("planTrip", () => {
  it("predicts arrival SoC from capacity and efficiency", () => {
    const plan = planTrip(buckets, { distanceKm: 200, tempC: 20, startSocPct: 90, capacityKwh: 75 })!;
    expect(plan.energyKwh).toBeCloseTo(30, 6);
    expect(plan.usedPct).toBeCloseTo(40, 6);
    expect(plan.arrivalSocPct).toBeCloseTo(50, 6);
    expect(plan.feasible).toBe(true);
    expect(plan.rangeToReserveKm).toBeCloseTo(400, 6);
    expect(plan.requiredStartSocPct).toBeCloseTo(50, 6);
  });

  it("flags trips that dip below the reserve", () => {
    const plan = planTrip(buckets, { distanceKm: 300, tempC: 20, startSocPct: 60, capacityKwh: 75, reservePct: 15 })!;
    expect(plan.arrivalSocPct).toBeCloseTo(0, 6);
    expect(plan.feasible).toBe(false);
    expect(plan.requiredStartSocPct).toBeCloseTo(75, 6);
  });

  it("rejects invalid input", () => {
    expect(planTrip(buckets, { distanceKm: 0, tempC: 20, startSocPct: 80, capacityKwh: 75 })).toBeNull();
    expect(planTrip(buckets, { distanceKm: 10, tempC: 20, startSocPct: 80, capacityKwh: 0 })).toBeNull();
  });
});

describe("helpers", () => {
  it("parses bounded numbers", () => {
    expect(parseBounded("42", 0, 100)).toBe(42);
    expect(parseBounded("", 0, 100)).toBeNull();
    expect(parseBounded("abc", 0, 100)).toBeNull();
    expect(parseBounded("101", 0, 100)).toBeNull();
    expect(parseBounded(undefined, 0, 100)).toBeNull();
  });

  it("converts units", () => {
    expect(toKm(10, "mi")).toBeCloseTo(16.09344, 5);
    expect(toKm(10, "km")).toBe(10);
    expect(toCelsius(32, "F")).toBeCloseTo(0, 6);
    expect(toCelsius(5, "C")).toBe(5);
  });
});
