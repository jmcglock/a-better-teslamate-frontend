import { describe, expect, it } from "vitest";
import { mapActivityWindows } from "./activity";

describe("mapActivityWindows", () => {
  it("splits today out of the week and keeps a missing cost as null", () => {
    const totals = mapActivityWindows(
      { today_distance: "12.5", today_drives: 1, week_distance: "40", week_drives: "3" },
      { today_energy: "8", today_cost: null, today_charges: 1, week_energy: "30.2", week_cost: "4.5", week_charges: 2 },
    );
    expect(totals.today).toEqual({
      distanceKm: 12.5,
      energyAddedKwh: 8,
      cost: null,
      driveCount: 1,
      chargeCount: 1,
    });
    expect(totals.week.distanceKm).toBe(40);
    expect(totals.week.cost).toBe(4.5);
    expect(totals.week.chargeCount).toBe(2);
  });

  it("zeroes an empty window", () => {
    const totals = mapActivityWindows(undefined, undefined);
    expect(totals.today.driveCount).toBe(0);
    expect(totals.week.cost).toBeNull();
    expect(totals.week.energyAddedKwh).toBe(0);
  });
});
