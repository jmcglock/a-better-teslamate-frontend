import { describe, expect, it } from "vitest";
import { mapChargeRow, mapCurvePoint } from "@/lib/db/charges";

describe("mapChargeRow", () => {
  it("converts decimals", () => {
    const c = mapChargeRow({
      id: 3, start_date: new Date("2026-07-02T22:00:00Z"), end_date: new Date("2026-07-03T04:00:00Z"),
      charge_energy_added: "41.20", charge_energy_used: "43.05", cost: "6.18",
      duration_min: 360, start_battery_level: 22, end_battery_level: 80,
      location: "Home", max_power: 11,
    });
    expect(c.energyAddedKwh).toBeCloseTo(41.2);
    expect(c.cost).toBeCloseTo(6.18);
    expect(c.location).toBe("Home");
  });
  it("null location → label", () => {
    const c = mapChargeRow({
      id: 3, start_date: new Date(), end_date: null, charge_energy_added: null,
      charge_energy_used: null, cost: null, duration_min: null,
      start_battery_level: null, end_battery_level: null, location: null, max_power: null,
    });
    expect(c.location).toBe("Unknown location");
  });
});

describe("mapCurvePoint", () => {
  it("maps power and soc", () => {
    const p = mapCurvePoint({ date: new Date("2026-07-02T22:10:00Z"), charger_power: 11, battery_level: 25 });
    expect(p.power).toBe(11);
    expect(p.soc).toBe(25);
    expect(p.t).toBe(Date.parse("2026-07-02T22:10:00Z"));
  });
});
