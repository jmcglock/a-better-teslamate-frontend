import { describe, expect, it } from "vitest";
import {
  buildBatteryStress,
  buildDailyDod,
  buildEndSocDistribution,
  buildSocHistogram,
  equivalentFullCycles,
} from "./batteryStress";

describe("buildSocHistogram", () => {
  it("weights SoC buckets by time and reports both tails", () => {
    const result = buildSocHistogram([
      { soc: 95, hours: 2, outsideTempC: 35 },
      { soc: 85, hours: 2, outsideTempC: 20 },
      { soc: 10, hours: 4, outsideTempC: 35 },
      { soc: 50, hours: 2, outsideTempC: null },
    ]);

    expect(result.totalHours).toBe(10);
    expect(result.pctAbove80).toBe(40);
    expect(result.pctBelow20).toBe(40);
    expect(result.buckets.find((b) => b.label === "90-100%")).toMatchObject({ hours: 2, pct: 20 });
    expect(result.buckets.find((b) => b.label === "10-20%")).toMatchObject({ hours: 4, pct: 40 });
    expect(result.buckets.find((b) => b.label === "50-60%")).toMatchObject({ hours: 2, pct: 20 });
  });

  it("counts hot-and-full exposure against time with temperature data", () => {
    const result = buildSocHistogram([
      { soc: 95, hours: 2, outsideTempC: 35 },
      { soc: 85, hours: 2, outsideTempC: 20 },
      { soc: 10, hours: 4, outsideTempC: 35 },
      { soc: 50, hours: 2, outsideTempC: null },
    ]);

    expect(result.highTempHighSocHours).toBe(2);
    // 2 h hot+full / 8 h with a temperature reading; the null-temp sample is excluded.
    expect(result.highTempHighSocPct).toBe(25);
  });

  it("clamps out-of-range samples and ignores zero-duration rows", () => {
    const result = buildSocHistogram([
      { soc: 120, hours: 1, outsideTempC: null },
      { soc: -5, hours: 1, outsideTempC: null },
      { soc: 50, hours: 0, outsideTempC: null },
    ]);

    expect(result.totalHours).toBe(2);
    expect(result.buckets[9].hours).toBe(1);
    expect(result.buckets[0].hours).toBe(1);
  });

  it("returns null percentages when no usable samples exist", () => {
    const result = buildSocHistogram([]);
    expect(result.totalHours).toBe(0);
    expect(result.pctAbove80).toBeNull();
    expect(result.pctBelow20).toBeNull();
    expect(result.highTempHighSocPct).toBeNull();
  });
});

describe("buildDailyDod", () => {
  it("computes average, max, and deep-discharge days from daily ranges", () => {
    const result = buildDailyDod([
      { date: "2026-01-02", minSoc: 50, maxSoc: 70 },
      { date: "2026-01-01", minSoc: 20, maxSoc: 90 },
      { date: "2026-01-03", minSoc: 60, maxSoc: 100 },
    ]);

    expect(result.days).toBe(3);
    expect(result.avgPct).toBe(43.3);
    expect(result.maxPct).toBe(70);
    expect(result.deepDays).toBe(1);
    expect(result.deepPct).toBe(33.3);
    expect(result.series.map((point) => point.label)).toEqual(["01-01", "01-02", "01-03"]);
  });

  it("returns empty aggregates without daily rows", () => {
    const result = buildDailyDod([]);
    expect(result.days).toBe(0);
    expect(result.avgPct).toBeNull();
    expect(result.maxPct).toBeNull();
    expect(result.deepPct).toBeNull();
  });
});

describe("buildEndSocDistribution", () => {
  it("buckets charge end SoC, counts sessions, and finds the median", () => {
    const result = buildEndSocDistribution([
      { endSoc: 80, energyKwh: 30 },
      { endSoc: 90, energyKwh: 20 },
      { endSoc: 100, energyKwh: 10 },
      { endSoc: 55, energyKwh: 15 },
    ]);

    expect(result.sessions).toBe(4);
    expect(result.median).toBe(85);
    expect(result.pctAtOrAbove80).toBe(75);
    expect(result.buckets.find((b) => b.label === "50-60%")).toMatchObject({
      count: 1,
      pct: 25,
      energyKwh: 15,
    });
    expect(result.buckets.find((b) => b.label === "90-100%")).toMatchObject({
      count: 2,
      pct: 50,
      energyKwh: 30,
    });
  });

  it("handles an odd number of sessions and missing energy", () => {
    const result = buildEndSocDistribution([
      { endSoc: 70, energyKwh: null },
      { endSoc: 90, energyKwh: 12 },
      { endSoc: 80, energyKwh: 8 },
    ]);

    expect(result.median).toBe(80);
    expect(result.pctAtOrAbove80).toBe(66.7);
    expect(result.buckets.find((b) => b.label === "70-80%")?.energyKwh).toBe(0);
  });
});

describe("equivalentFullCycles", () => {
  it("divides throughput by usable pack size", () => {
    expect(equivalentFullCycles(1000, 75)).toBe(13.33);
  });

  it("returns zero for no throughput and null for an unknown pack", () => {
    expect(equivalentFullCycles(0, 75)).toBe(0);
    expect(equivalentFullCycles(100, null)).toBeNull();
    expect(equivalentFullCycles(100, 0)).toBeNull();
  });
});

describe("buildBatteryStress", () => {
  it("wires histogram, daily DoD, end SoC, and cycles into one roll-up", () => {
    const result = buildBatteryStress({
      samples: [{ soc: 90, hours: 10, outsideTempC: 31 }],
      daily: [{ date: "2026-01-01", minSoc: 10, maxSoc: 90 }],
      endSocs: [{ endSoc: 90, energyKwh: 50 }],
      energyThroughputKwh: 500,
      packKwh: 50,
    });

    expect(result.totalHours).toBe(10);
    expect(result.pctAbove80).toBe(100);
    expect(result.pctBelow20).toBe(0);
    expect(result.highTempHighSoc.hours).toBe(10);
    expect(result.dailyDod.maxPct).toBe(80);
    expect(result.endSoc.sessions).toBe(1);
    expect(result.equivalentCycles).toBe(10);
    expect(result.highTempHighSoc.tempC).toBe(30);
    expect(result.highTempHighSoc.socPct).toBe(80);
  });
});
