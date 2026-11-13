import { describe, expect, it } from "vitest";
import {
  buildUsageInsights,
  normalizeUsageState,
  usageMonthLabel,
  type UsageInterval,
} from "./usage";

const WINDOW = { start: "2026-01-01T00:00:00Z", end: "2026-03-01T00:00:00Z" };

function hours(insights: ReturnType<typeof buildUsageInsights>, state: string): number {
  return insights.allocation.find((a) => a.state === state)?.hours ?? 0;
}

describe("normalizeUsageState", () => {
  it("maps TeslaMate variants into the six analytics buckets", () => {
    expect(normalizeUsageState("suspended")).toBe("asleep");
    expect(normalizeUsageState("idle")).toBe("online");
    expect(normalizeUsageState("supercharging")).toBe("charging");
    expect(normalizeUsageState("offline")).toBe("offline");
    expect(normalizeUsageState("updating")).toBe("updating");
    expect(normalizeUsageState("driving")).toBe("driving");
    expect(normalizeUsageState("something-new")).toBe("online");
  });
});

describe("usageMonthLabel", () => {
  it("formats YYYY-MM", () => {
    expect(usageMonthLabel("2026-07")).toBe("Jul 26");
  });
});

describe("buildUsageInsights", () => {
  it("allocates clipped state time and derives sleep metrics", () => {
    const intervals: UsageInterval[] = [
      { state: "driving", start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" },
      { state: "charging", start: "2026-01-01T11:00:00Z", end: "2026-01-01T12:00:00Z" },
      { state: "asleep", start: "2026-01-01T12:00:00Z", end: "2026-01-01T20:00:00Z" },
      { state: "online", start: "2026-01-01T20:00:00Z", end: "2026-01-01T21:00:00Z" },
      { state: "offline", start: "2026-01-01T21:00:00Z", end: "2026-01-01T22:00:00Z" },
      { state: "updating", start: "2026-01-01T22:00:00Z", end: "2026-01-01T23:00:00Z" },
    ];

    const result = buildUsageInsights(intervals, WINDOW);

    expect(result.intervalCount).toBe(6);
    expect(result.totalHours).toBe(13);
    expect(hours(result, "driving")).toBe(1);
    expect(hours(result, "charging")).toBe(1);
    expect(hours(result, "asleep")).toBe(8);
    expect(hours(result, "online")).toBe(1);
    expect(hours(result, "offline")).toBe(1);
    expect(hours(result, "updating")).toBe(1);

    expect(result.allocation.find((a) => a.state === "asleep")?.pct).toBeCloseTo(61.5, 1);

    // asleep → online and offline → updating are wakeups.
    expect(result.wakeups).toBe(2);
    expect(result.days).toBeCloseTo(59, 0);
    expect(result.wakeupsPerDay).toBeCloseTo(2 / 59, 2);

    // Offline is its own bucket, so it is not awake time in the monthly trend.
    expect(result.monthly[0]).toMatchObject({
      month: "2026-01",
      asleepHours: 8,
      awakeHours: 4,
      drivingHours: 1,
      chargingHours: 1,
      wakeups: 2,
    });
    expect(result.monthly[1]).toMatchObject({ month: "2026-02", asleepHours: 0, awakeHours: 0 });

    expect(result.longestSleepHours).toBe(8);
    expect(result.longestSleepStart).toBe("2026-01-01T12:00:00.000Z");

    // charging + online + updating out of all awake time.
    expect(result.awakeNotDrivingHours).toBe(3);
    expect(result.awakeNotDrivingPct).toBe(75);
  });

  it("clips to the window and splits state time across months", () => {
    const intervals: UsageInterval[] = [
      { state: "asleep", start: "2026-01-31T20:00:00Z", end: "2026-02-01T04:00:00Z" },
      { state: "online", start: "2026-02-01T04:00:00Z", end: "2026-02-01T05:00:00Z" },
    ];

    const result = buildUsageInsights(intervals, WINDOW);

    expect(result.monthly.map((m) => m.month)).toEqual(["2026-01", "2026-02"]);
    expect(result.monthly[0]).toMatchObject({
      label: "Jan 26",
      asleepHours: 4,
      awakeHours: 0,
      wakeups: 0,
    });
    expect(result.monthly[0].wakeupsPerDay).toBe(0);
    expect(result.monthly[1]).toMatchObject({
      label: "Feb 26",
      asleepHours: 4,
      awakeHours: 1,
      wakeups: 1,
    });
    expect(result.monthly[1].wakeupsPerDay).toBeCloseTo(1 / 28, 2);
    expect(result.longestSleepHours).toBe(8);
    expect(result.wakeups).toBe(1);
  });

  it("merges back-to-back sleep rows into one sleep run", () => {
    const result = buildUsageInsights(
      [
        { state: "asleep", start: "2026-01-01T01:00:00Z", end: "2026-01-01T03:00:00Z" },
        { state: "asleep", start: "2026-01-01T03:00:00Z", end: "2026-01-01T05:00:00Z" },
        { state: "asleep", start: "2026-01-01T07:00:00Z", end: "2026-01-01T09:00:00Z" },
      ],
      WINDOW,
    );

    expect(result.intervalCount).toBe(2);
    expect(result.longestSleepHours).toBe(4);
    expect(result.longestSleepStart).toBe("2026-01-01T01:00:00.000Z");
    expect(hours(result, "asleep")).toBe(6);
  });

  it("closes open states at the window end", () => {
    const result = buildUsageInsights(
      [
        { state: "suspended", start: "2026-01-01T00:00:00Z", end: "2026-01-01T01:00:00Z" },
        { state: "idle", start: "2026-01-01T01:00:00Z", end: "2026-01-01T02:00:00Z" },
        { state: "online", start: "2026-01-01T02:00:00Z", end: null },
      ],
      { start: "2026-01-01T00:00:00Z", end: "2026-01-01T03:00:00Z" },
    );

    expect(hours(result, "asleep")).toBe(1);
    expect(hours(result, "online")).toBe(2);
    expect(result.wakeups).toBe(1);
    expect(result.totalHours).toBe(3);
  });

  it("ignores intervals outside the window and handles an empty history", () => {
    const result = buildUsageInsights(
      [
        { state: "driving", start: "2025-12-01T00:00:00Z", end: "2025-12-01T01:00:00Z" },
        { state: "charging", start: "2026-04-01T00:00:00Z", end: "2026-04-01T01:00:00Z" },
      ],
      WINDOW,
    );

    expect(result.intervalCount).toBe(0);
    expect(result.totalHours).toBe(0);
    expect(result.wakeups).toBe(0);
    expect(result.wakeupsPerDay).toBe(0);
    expect(result.longestSleepHours).toBeNull();
    expect(result.longestSleepStart).toBeNull();
    expect(result.awakeNotDrivingPct).toBeNull();
    expect(result.monthly).toEqual([]);
    expect(result.allocation).toHaveLength(6);
    expect(result.allocation.every((a) => a.seconds === 0 && a.pct === 0)).toBe(true);
  });

  it("returns a safe empty result for an invalid window", () => {
    const result = buildUsageInsights([], { start: "2026-03-01T00:00:00Z", end: "2026-01-01T00:00:00Z" });
    expect(result.totalHours).toBe(0);
    expect(result.wakeupsPerDay).toBeNull();
    expect(result.monthly).toEqual([]);
  });
});
