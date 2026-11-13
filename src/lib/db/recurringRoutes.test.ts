import { describe, expect, it } from "vitest";
import {
  estimateDriveCost,
  mapRouteDriveRow,
  type RecurringDriveRow,
} from "./recurringRoutes";

const baseRow: RecurringDriveRow = {
  id: 12,
  start_date: new Date("2026-05-04T08:00:00Z"),
  distance: "20.0",
  duration_min: "30",
  range_used_km: "13.0",
  efficiency: "0.15",
  start_label: "Home",
  end_label: "Work",
};

describe("estimateDriveCost", () => {
  it("multiplies consumed energy by the average price", () => {
    // 150 Wh/km × 20 km = 3 kWh × $0.30
    expect(estimateDriveCost(150, 20, 0.3)).toBe(0.9);
  });

  it("returns null when inputs are missing or non-positive", () => {
    expect(estimateDriveCost(null, 20, 0.3)).toBeNull();
    expect(estimateDriveCost(150, null, 0.3)).toBeNull();
    expect(estimateDriveCost(150, 20, null)).toBeNull();
    expect(estimateDriveCost(0, 20, 0.3)).toBeNull();
    expect(estimateDriveCost(150, 0, 0.3)).toBeNull();
    expect(estimateDriveCost(150, 20, 0)).toBeNull();
  });
});

describe("mapRouteDriveRow", () => {
  it("maps TeslaMate decimals and estimates cost", () => {
    const drive = mapRouteDriveRow(baseRow, 0.3);

    expect(drive).toMatchObject({
      id: 12,
      startDate: "2026-05-04T08:00:00.000Z",
      startLabel: "Home",
      endLabel: "Work",
      distanceKm: 20,
      durationMin: 30,
    });
    expect(drive.efficiencyWhPerKm).toBeCloseTo(97.5, 1);
    expect(drive.cost).toBe(0.59);
  });

  it("keeps the drive without cost when no price is known", () => {
    const drive = mapRouteDriveRow(baseRow, null);

    expect(drive.efficiencyWhPerKm).toBeCloseTo(97.5, 1);
    expect(drive.cost).toBeNull();
  });

  it("leaves efficiency null when range data is incomplete", () => {
    const drive = mapRouteDriveRow({ ...baseRow, range_used_km: null }, 0.3);

    expect(drive.efficiencyWhPerKm).toBeNull();
    expect(drive.cost).toBeNull();
  });

  it("passes through missing labels for the aggregator to filter", () => {
    const drive = mapRouteDriveRow({ ...baseRow, start_label: null }, 0.3);
    expect(drive.startLabel).toBeNull();
  });
});
