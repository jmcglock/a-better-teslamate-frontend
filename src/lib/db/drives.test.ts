import { describe, expect, it } from "vitest";
import { mapDriveRow, mapDrivePoint } from "@/lib/db/drives";

describe("mapDriveRow", () => {
  it("converts decimals and labels", () => {
    const d = mapDriveRow({
      id: 9, start_date: new Date("2026-07-01T08:00:00Z"), end_date: new Date("2026-07-01T08:30:00Z"),
      distance: 21.7, duration_min: 30, speed_max: 118,
      range_used_km: "14.2", start_label: "Home", end_label: null, outside_temp_avg: "17.5",
    });
    expect(d.rangeUsedKm).toBeCloseTo(14.2);
    expect(d.endLabel).toBe("Unknown location");
    expect(d.startDate).toBe("2026-07-01T08:00:00.000Z");
  });
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
