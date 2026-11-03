import { describe, expect, it } from "vitest";
import { formatDistance } from "@/lib/format";
import {
  driveEfficiencyWhPerKm,
  drivesMatchingFilter,
  mapDrivePoint,
  mapDriveRow,
  mapDriveTotals,
  summarizeDrives,
} from "@/lib/db/drives";

const baseRow = {
  id: 9,
  start_date: new Date("2026-07-01T08:00:00Z"),
  end_date: new Date("2026-07-01T08:30:00Z"),
  distance: 21.7,
  duration_min: 30,
  speed_max: 118,
  range_used_km: "14.2",
  start_label: "Home",
  end_label: null as string | null,
  outside_temp_avg: "17.5",
  inside_temp_avg: "21.0",
  power_max: 120,
  power_min: -45,
  ascent: 80,
  descent: 40,
  start_rated_range_km: "250.0",
  end_rated_range_km: "235.8",
  efficiency: "0.152",
  car_name: "Test",
};

describe("mapDriveRow", () => {
  it("converts decimals and labels", () => {
    const d = mapDriveRow(baseRow);
    expect(d.rangeUsedKm).toBeCloseTo(14.2);
    expect(d.endLabel).toBe("Unknown location");
    expect(d.startDate).toBe("2026-07-01T08:00:00.000Z");
    expect(d.efficiencyWhPerKm).toBeCloseTo((14.2 * 0.152 * 1000) / 21.7, 1);
    expect(d.powerMaxKw).toBe(120);
    expect(d.powerMinKw).toBe(-45);
    expect(d.ascentM).toBe(80);
    expect(d.insideTempAvgC).toBeCloseTo(21);
    expect(d.carName).toBe("Test");
  });
  it("null efficiency when incomplete", () => {
    const d = mapDriveRow({
      ...baseRow,
      end_date: null,
      distance: 10,
      duration_min: 20,
      speed_max: 80,
      range_used_km: null,
      start_label: "A",
      end_label: "B",
      outside_temp_avg: null,
      inside_temp_avg: null,
      power_max: null,
      power_min: null,
      ascent: null,
      descent: null,
      start_rated_range_km: null,
      end_rated_range_km: null,
      efficiency: "0.15",
    });
    expect(d.efficiencyWhPerKm).toBeNull();
  });

  it("coerces numeric strings from node-pg and formats km and miles", () => {
    const d = mapDriveRow({
      ...baseRow,
      distance: "10.0",
      duration_min: "0",
      speed_max: "88",
      power_max: "120",
      power_min: "-45",
      ascent: "12",
      descent: null,
      outside_temp_avg: null,
      inside_temp_avg: null,
      range_used_km: null,
      start_rated_range_km: null,
      end_rated_range_km: null,
    });
    expect(formatDistance(d.distanceKm, "km")).toBe("10.0 km");
    expect(formatDistance(d.distanceKm, "mi")).toBe("6.2 mi");
    expect(d.distanceKm).toBe(10);
    expect(d.durationMin).toBe(0);
    expect(d.speedMaxKmh).toBe(88);
    expect(d.powerMaxKw).toBe(120);
    expect(d.powerMinKw).toBe(-45);
    expect(d.ascentM).toBe(12);
    expect(d.descentM).toBeNull();
    expect(d.outsideTempAvgC).toBeNull();
    expect(d.insideTempAvgC).toBeNull();
  });
});

describe("driveEfficiencyWhPerKm", () => {
  it("computes Wh/km", () => expect(driveEfficiencyWhPerKm(10, 20, 0.15)).toBeCloseTo(75));
  it("null on bad inputs", () => expect(driveEfficiencyWhPerKm(0, 20, 0.15)).toBeNull());
});

const filterRows = [
  { id: 1, carId: 1, startDate: new Date("2026-10-02T08:00:00Z"), distanceKm: 12.5, durationMin: 20 },
  { id: 2, carId: 1, startDate: new Date("2026-10-03T08:00:00Z"), distanceKm: 7.5, durationMin: 15 },
  { id: 3, carId: 1, startDate: new Date("2026-09-01T08:00:00Z"), distanceKm: 100, durationMin: 80 },
  { id: 4, carId: 2, startDate: new Date("2026-10-02T08:00:00Z"), distanceKm: 40, durationMin: 30 },
  { id: 5, carId: 1, startDate: new Date("2026-10-04T08:00:00Z"), distanceKm: 0.1, durationMin: 5 },
  { id: 6, carId: 1, startDate: new Date("2026-10-04T09:00:00Z"), distanceKm: 3, durationMin: null },
  { id: 7, carId: 1, startDate: new Date("2026-10-05T09:00:00Z"), distanceKm: null, durationMin: 10 },
];

describe("drive totals", () => {
  it("matches the rows inside the selected car and time window", () => {
    const since = new Date("2026-10-01T00:00:00Z");
    const filtered = drivesMatchingFilter(filterRows, { carId: 1, since });
    expect(filtered.map((row) => row.id)).toEqual([1, 2, 6]);
    expect(summarizeDrives(filtered)).toEqual({ count: 3, distanceKm: 23, durationMin: 35 });
  });

  it("matches every listed row when no car or window is selected", () => {
    const filtered = drivesMatchingFilter(filterRows, { carId: null, since: null });
    expect(filtered.map((row) => row.id)).toEqual([1, 2, 3, 4, 6]);
    expect(summarizeDrives(filtered)).toEqual({ count: 5, distanceKm: 163, durationMin: 145 });
  });

  it("includes a drive that starts on the window boundary", () => {
    const since = new Date("2026-10-01T00:00:00Z");
    const filtered = drivesMatchingFilter(
      [{ id: 8, carId: 1, startDate: since, distanceKm: 5, durationMin: 9 }],
      { carId: 1, since },
    );
    expect(summarizeDrives(filtered)).toEqual({ count: 1, distanceKm: 5, durationMin: 9 });
  });

  it("reads postgres aggregate values", () => {
    expect(mapDriveTotals({ count: "3", distance_km: "23.0", duration_min: "35" })).toEqual({
      count: 3,
      distanceKm: 23,
      durationMin: 35,
    });
    expect(mapDriveTotals(undefined)).toEqual({ count: 0, distanceKm: 0, durationMin: 0 });
  });
});

describe("mapDrivePoint", () => {
  it("epoch ms + numeric soc + elevation/power", () => {
    const p = mapDrivePoint({
      date: new Date("2026-07-01T08:10:00Z"),
      speed: 88,
      battery_level: 64,
      latitude: "37.4",
      longitude: "-122.1",
      elevation: 42,
      power: -12,
    });
    expect(p.t).toBe(Date.parse("2026-07-01T08:10:00Z"));
    expect(p.soc).toBe(64);
    expect(p.lat).toBeCloseTo(37.4);
    expect(p.elevation).toBe(42);
    expect(p.power).toBe(-12);
  });

  it("coerces numeric strings from node-pg", () => {
    const p = mapDrivePoint({
      date: new Date("2026-07-01T08:10:00Z"),
      speed: "0",
      battery_level: "64",
      latitude: "37.4",
      longitude: "-122.1",
      elevation: null,
      power: "-12",
    });
    expect(p.speed).toBe(0);
    expect(p.soc).toBe(64);
    expect(p.elevation).toBeNull();
    expect(p.power).toBe(-12);
  });
});
