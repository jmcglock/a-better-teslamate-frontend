import { describe, expect, it } from "vitest";
import { driveEfficiencyWhPerKm, mapDriveRow, mapDrivePoint } from "@/lib/db/drives";

describe("mapDriveRow", () => {
  it("converts decimals and labels", () => {
    const d = mapDriveRow({
      id: 9, start_date: new Date("2026-07-01T08:00:00Z"), end_date: new Date("2026-07-01T08:30:00Z"),
      distance: 21.7, duration_min: 30, speed_max: 118,
      range_used_km: "14.2", start_label: "Home", end_label: null, outside_temp_avg: "17.5",
      efficiency: "0.152",
    });
    expect(d.rangeUsedKm).toBeCloseTo(14.2);
    expect(d.endLabel).toBe("Unknown location");
    expect(d.startDate).toBe("2026-07-01T08:00:00.000Z");
    expect(d.efficiencyWhPerKm).toBeCloseTo((14.2 * 0.152 * 1000) / 21.7, 1);
  });
  it("null efficiency when incomplete", () => {
    const d = mapDriveRow({
      id: 9, start_date: new Date(), end_date: null, distance: 10, duration_min: 20, speed_max: 80,
      range_used_km: null, start_label: "A", end_label: "B", outside_temp_avg: null, efficiency: "0.15",
    });
    expect(d.efficiencyWhPerKm).toBeNull();
  });
});

describe("driveEfficiencyWhPerKm", () => {
  it("computes Wh/km", () => expect(driveEfficiencyWhPerKm(10, 20, 0.15)).toBeCloseTo(75));
  it("null on bad inputs", () => expect(driveEfficiencyWhPerKm(0, 20, 0.15)).toBeNull());
});

describe("mapDrivePoint", () => {
  it("epoch ms + numeric soc", () => {
    const p = mapDrivePoint({
      date: new Date("2026-07-01T08:10:00Z"), speed: 88, battery_level: 64,
      latitude: "37.4", longitude: "-122.1",
    });
    expect(p.t).toBe(Date.parse("2026-07-01T08:10:00Z"));
    expect(p.soc).toBe(64);
    expect(p.lat).toBeCloseTo(37.4);
  });
});
