import { describe, expect, it } from "vitest";
import {
  buildRecurringRoutes,
  routeKey,
  type RouteDriveInput,
} from "./recurringRoutes";

function drive(overrides: Partial<RouteDriveInput> & { id: number; startDate: string }): RouteDriveInput {
  return {
    startLabel: "Home",
    endLabel: "Work",
    distanceKm: 20,
    durationMin: 30,
    efficiencyWhPerKm: 150,
    cost: 2,
    ...overrides,
  };
}

const commute = [
  drive({ id: 1, startDate: "2026-01-05T08:00:00.000Z", distanceKm: 20, durationMin: 30, efficiencyWhPerKm: 150, cost: 2 }),
  drive({ id: 2, startDate: "2026-01-06T08:10:00.000Z", distanceKm: 20.4, durationMin: 31, efficiencyWhPerKm: 152, cost: 2.1 }),
  drive({ id: 3, startDate: "2026-01-07T08:05:00.000Z", distanceKm: 20.2, durationMin: 29, efficiencyWhPerKm: 148, cost: 1.95 }),
  drive({ id: 4, startDate: "2026-01-08T08:00:00.000Z", distanceKm: 44, durationMin: 65, efficiencyWhPerKm: 210, cost: 5.5 }),
  drive({ id: 5, startDate: "2026-01-09T08:00:00.000Z", distanceKm: 20.1, durationMin: 30, efficiencyWhPerKm: 151, cost: 2.02 }),
];

describe("routeKey", () => {
  it("normalizes case and whitespace", () => {
    expect(routeKey("  Home ", "WORK")).toBe(routeKey("home", "work  "));
  });
});

describe("buildRecurringRoutes", () => {
  it("groups repeated start/end pairs and ranks by frequency", () => {
    const result = buildRecurringRoutes([
      ...commute,
      drive({ id: 6, startDate: "2026-01-05T17:00:00.000Z", startLabel: "Work", endLabel: "Home" }),
      drive({ id: 7, startDate: "2026-01-06T17:00:00.000Z", startLabel: "Work", endLabel: "Home" }),
      drive({ id: 8, startDate: "2026-01-07T17:00:00.000Z", startLabel: "Work", endLabel: "Home" }),
    ]);

    expect(result.routes).toHaveLength(2);
    expect(result.routes[0]).toMatchObject({ startLabel: "Home", endLabel: "Work", count: 5 });
    expect(result.routes[1]).toMatchObject({ startLabel: "Work", endLabel: "Home", count: 3 });
    expect(result.summary).toMatchObject({
      drives: 8,
      matchedDrives: 8,
      routes: 2,
      commuteRoutes: 1,
      outlierDrives: 1,
      outlierSharePct: 13,
    });
  });

  it("drops one-off routes below the minimum count", () => {
    const result = buildRecurringRoutes([
      drive({ id: 1, startDate: "2026-01-05T08:00:00.000Z" }),
      drive({ id: 2, startDate: "2026-01-06T08:00:00.000Z" }),
    ]);

    expect(result.routes).toEqual([]);
    expect(result.summary.routes).toBe(0);
    expect(result.summary.matchedDrives).toBe(0);
    expect(result.summary.outlierSharePct).toBeNull();
  });

  it("honors a lower minimum count", () => {
    const result = buildRecurringRoutes(
      [
        drive({ id: 1, startDate: "2026-01-05T08:00:00.000Z" }),
        drive({ id: 2, startDate: "2026-01-06T08:00:00.000Z" }),
      ],
      { minCount: 2 },
    );
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].count).toBe(2);
  });

  it("skips unknown labels and implausibly short drives", () => {
    const result = buildRecurringRoutes(
      [
        drive({ id: 1, startDate: "2026-01-05T08:00:00.000Z", startLabel: "Unknown location" }),
        drive({ id: 2, startDate: "2026-01-06T08:00:00.000Z", endLabel: null }),
        drive({ id: 3, startDate: "2026-01-07T08:00:00.000Z", distanceKm: 0.05 }),
        drive({ id: 4, startDate: "2026-01-08T08:00:00.000Z", distanceKm: null }),
      ],
      { minCount: 2 },
    );
    expect(result.routes).toEqual([]);
    expect(result.summary.drives).toBe(4);
  });

  it("computes averages, totals, and distance-weighted efficiency", () => {
    const result = buildRecurringRoutes(
      [
        drive({ id: 1, startDate: "2026-02-02T08:00:00.000Z", distanceKm: 10, durationMin: 20, efficiencyWhPerKm: 100, cost: 1 }),
        drive({ id: 2, startDate: "2026-02-03T08:00:00.000Z", distanceKm: 30, durationMin: 40, efficiencyWhPerKm: 200, cost: null }),
        drive({ id: 3, startDate: "2026-02-04T08:00:00.000Z", distanceKm: 20, durationMin: 30, efficiencyWhPerKm: null, cost: 3 }),
      ],
    );

    const route = result.routes[0];
    expect(route.count).toBe(3);
    expect(route.totalDistanceKm).toBe(60);
    expect(route.avgDistanceKm).toBe(20);
    expect(route.avgDurationMin).toBe(30);
    expect(route.avgEfficiencyWhPerKm).toBe(175);
    expect(route.avgCost).toBe(2);
    expect(route.totalCost).toBe(4);
    expect(route.distinctDays).toBe(3);
  });

  it("flags drives that deviate from the route median", () => {
    const result = buildRecurringRoutes(commute);
    const route = result.routes[0];

    expect(route.outliers.map((o) => o.metric).sort()).toEqual([
      "cost",
      "distance",
      "duration",
      "efficiency",
    ]);
    expect(route.outliers.every((o) => o.driveId === 4)).toBe(true);
    expect(route.outlierDrives).toBe(1);

    const distance = route.outliers.find((o) => o.metric === "distance");
    expect(distance).toMatchObject({
      expected: 20.2,
      value: 44,
      direction: "high",
    });
    expect(distance?.deviationPct).toBe(118);
  });

  it("flags slow or expensive drives as high and cheap ones as low", () => {
    const result = buildRecurringRoutes(
      [
        drive({ id: 1, startDate: "2026-03-02T08:00:00.000Z", durationMin: 30, cost: 2 }),
        drive({ id: 2, startDate: "2026-03-03T08:00:00.000Z", durationMin: 30, cost: 2 }),
        drive({ id: 3, startDate: "2026-03-04T08:00:00.000Z", durationMin: 30, cost: 2 }),
        drive({ id: 4, startDate: "2026-03-05T08:00:00.000Z", durationMin: 60, cost: 5 }),
        drive({ id: 5, startDate: "2026-03-06T08:00:00.000Z", durationMin: 30, cost: 0.2 }),
      ],
      { minCount: 3 },
    );

    const route = result.routes[0];
    const duration = route.outliers.find((o) => o.metric === "duration");
    const cheap = route.outliers.find((o) => o.metric === "cost" && o.driveId === 5);
    const pricey = route.outliers.find((o) => o.metric === "cost" && o.driveId === 4);
    expect(duration).toMatchObject({ driveId: 4, direction: "high", expected: 30 });
    expect(cheap).toMatchObject({ driveId: 5, direction: "low", expected: 2 });
    expect(pricey).toMatchObject({ driveId: 4, direction: "high", expected: 2 });
  });

  it("detects commute routes from weekday spread", () => {
    const result = buildRecurringRoutes(commute);
    expect(result.routes[0].isCommute).toBe(true);
    expect(result.routes[0].weekdayShare).toBe(1);

    const weekendDays = ["03", "04", "10", "11", "17"];
    const weekend = commute.map((d, i) =>
      drive({
        ...d,
        id: i + 10,
        startDate: `2026-01-${weekendDays[i]}T08:00:00.000Z`,
      }),
    );
    const weekendResult = buildRecurringRoutes(weekend);
    expect(weekendResult.routes[0].isCommute).toBe(false);
  });

  it("respects the route limit", () => {
    const result = buildRecurringRoutes(
      [
        ...commute,
        drive({ id: 6, startDate: "2026-01-05T17:00:00.000Z", startLabel: "Work", endLabel: "Home" }),
        drive({ id: 7, startDate: "2026-01-06T17:00:00.000Z", startLabel: "Work", endLabel: "Home" }),
        drive({ id: 8, startDate: "2026-01-07T17:00:00.000Z", startLabel: "Work", endLabel: "Home" }),
      ],
      { maxRoutes: 1 },
    );
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].count).toBe(5);
  });

  it("can loosen the outlier threshold", () => {
    const drives = [
      drive({ id: 1, startDate: "2026-04-06T08:00:00.000Z", distanceKm: 20 }),
      drive({ id: 2, startDate: "2026-04-07T08:00:00.000Z", distanceKm: 20 }),
      drive({ id: 3, startDate: "2026-04-08T08:00:00.000Z", distanceKm: 24 }),
    ];
    expect(buildRecurringRoutes(drives, { minCount: 3 }).routes[0].outliers).toEqual([]);
    expect(
      buildRecurringRoutes(drives, { minCount: 3, outlierPct: 10 }).routes[0].outliers,
    ).toHaveLength(1);
  });
});
