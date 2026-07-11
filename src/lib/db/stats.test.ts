import { describe, expect, it } from "vitest";
import {
  drainPctPerDay, monthLabel, newCarRatedRangeKm, summarizeBatteryHealth,
} from "@/lib/db/stats";

describe("drainPctPerDay", () => {
  it("computes normalized drain", () => expect(drainPctPerDay(80, 75, 24)).toBeCloseTo(5));
  it("scales to 24h", () => expect(drainPctPerDay(80, 78, 12)).toBeCloseTo(4));
  it("null for short gaps", () => expect(drainPctPerDay(80, 79, 3)).toBeNull());
  it("null for negative drain", () => expect(drainPctPerDay(70, 75, 24)).toBeNull());
});

describe("monthLabel", () => {
  it("formats", () => expect(monthLabel(new Date("2026-07-01T00:00:00Z"))).toBe("Jul 26"));
});

describe("newCarRatedRangeKm", () => {
  it("2020 Model 3 SR+", () => {
    expect(newCarRatedRangeKm({
      model: "3", marketingName: "SR+", trimBadging: "50", vin: "5YJ3E1EA9L0000001",
    })).toBe(402);
  });
});

describe("summarizeBatteryHealth", () => {
  it("uses new-car baseline for degradation", () => {
    const s = summarizeBatteryHealth(
      [{ t: 1, v: 400 }, { t: 2, v: 380 }, { t: 3, v: 317 }],
      { newKm: 402, efficiency: 0.13024 },
    );
    expect(s.currentKm).toBe(317);
    expect(s.peakKm).toBe(400);
    expect(s.newKm).toBe(402);
    expect(s.baseline).toBe("new");
    expect(s.healthPct).toBeCloseTo((317 / 402) * 100, 1);
    expect(s.degradationPct).toBeCloseTo(100 - (317 / 402) * 100, 1);
    expect(s.currentKwh).toBeCloseTo(317 * 0.13024, 1);
    expect(s.newKwh).toBeCloseTo(402 * 0.13024, 1);
  });
  it("falls back to peak when new unknown", () => {
    const s = summarizeBatteryHealth([{ t: 1, v: 400 }, { t: 2, v: 370 }]);
    expect(s.baseline).toBe("peak");
    expect(s.healthPct).toBeCloseTo(92.5);
  });
  it("empty series", () => {
    expect(summarizeBatteryHealth([])).toMatchObject({
      currentKm: null, peakKm: null, healthPct: null, degradationPct: null, baseline: null,
    });
  });
});
