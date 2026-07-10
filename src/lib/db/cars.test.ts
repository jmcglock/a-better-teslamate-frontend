import { describe, expect, it } from "vitest";
import { mapCarRow, type CarRow } from "@/lib/db/cars";

const row: CarRow = {
  id: 1, name: "Panther", model: "3", marketing_name: "LR AWD",
  latitude: "37.4", longitude: "-122.1", battery_level: 72, usable_battery_level: 71,
  rated_battery_range_km: "312.5", ideal_battery_range_km: "330.1", odometer: 34567.2,
  inside_temp: "21.5", outside_temp: "18.0",
  position_date: new Date("2026-07-10T15:00:00Z"), db_state: "online",
};

describe("mapCarRow", () => {
  it("converts decimal strings and dates", () => {
    const c = mapCarRow(row);
    expect(c.ratedRangeKm).toBeCloseTo(312.5);
    expect(c.latitude).toBeCloseTo(37.4);
    expect(c.positionDate).toBe("2026-07-10T15:00:00.000Z");
    expect(c.state).toBe("online");
  });
  it("nulls survive", () => {
    const c = mapCarRow({ ...row, inside_temp: null, position_date: null, db_state: null });
    expect(c.insideTempC).toBeNull();
    expect(c.positionDate).toBeNull();
    expect(c.state).toBe("offline");
  });
});
