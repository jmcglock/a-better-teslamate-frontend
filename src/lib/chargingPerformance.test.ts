import { describe, expect, it } from "vitest";
import { buildChargingPerformance } from "./chargingPerformance";

describe("buildChargingPerformance", () => {
  it("summarizes peak power, time to 80, and losses", () => {
    const result = buildChargingPerformance(
      [
        { id: 1, location: "Home", peakPowerKw: 11, timeTo80Min: 35, energyAddedKwh: 20, energyUsedKwh: 22, durationMin: 45 },
        { id: 2, location: "Supercharger", peakPowerKw: 120, timeTo80Min: 18, energyAddedKwh: 40, energyUsedKwh: 42, durationMin: 25 },
      ],
      [{ binStart: 10, avgPowerKw: 8, samples: 4, sessions: 2 }],
    );

    expect(result.summary.sessions).toBe(2);
    expect(result.summary.avgPeakPowerKw).toBe(65.5);
    expect(result.summary.medianTimeTo80Min).toBe(26.5);
    expect(result.summary.lossPct).toBeCloseTo(6.3, 1);
    expect(result.summary.dcSessions).toBe(1);
    expect(result.sites[0].location).toBe("Supercharger");
  });

  it("ignores sessions without metered wall energy when computing loss", () => {
    const result = buildChargingPerformance(
      [
        { id: 1, location: "Home", peakPowerKw: 11, timeTo80Min: null, energyAddedKwh: 18, energyUsedKwh: 20, durationMin: 45 },
        { id: 2, location: "Home", peakPowerKw: 11, timeTo80Min: null, energyAddedKwh: 30, energyUsedKwh: null, durationMin: 60 },
      ],
      [],
    );

    expect(result.summary.lossPct).toBe(10);
    expect(result.sites[0].lossPct).toBe(10);
    expect(result.sites[0].energyAddedKwh).toBe(48);
  });

  it("handles empty input", () => {
    const result = buildChargingPerformance([], []);
    expect(result.summary.sessions).toBe(0);
    expect(result.summary.avgPeakPowerKw).toBeNull();
    expect(result.summary.medianTimeTo80Min).toBeNull();
    expect(result.socBins).toEqual([]);
    expect(result.sites).toEqual([]);
  });
});