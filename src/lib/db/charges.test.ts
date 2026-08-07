import { describe, expect, it } from "vitest";
import { inferChargeKind, mapChargeRow, mapCurvePoint } from "@/lib/db/charges";

const baseRow = {
  id: 3,
  start_date: new Date("2026-07-02T22:00:00Z"),
  end_date: new Date("2026-07-03T04:00:00Z"),
  charge_energy_added: "41.20",
  charge_energy_used: "43.05",
  cost: "6.18",
  duration_min: 360,
  start_battery_level: 22,
  end_battery_level: 80,
  location: "Home",
  max_power: 11,
  start_rated_range_km: "80.0",
  end_rated_range_km: "280.0",
  outside_temp_avg: "12.5",
  max_voltage: 240,
  fast_charger: false,
  latitude: "37.4",
  longitude: "-122.1",
};

describe("mapChargeRow", () => {
  it("converts decimals", () => {
    const c = mapChargeRow(baseRow);
    expect(c.energyAddedKwh).toBeCloseTo(41.2);
    expect(c.energyUsedKwh).toBeCloseTo(43.05);
    expect(c.cost).toBeCloseTo(6.18);
    expect(c.location).toBe("Home");
    expect(c.chargeKind).toBe("AC");
    expect(c.outsideTempAvgC).toBeCloseTo(12.5);
  });
  it("null location → label", () => {
    const c = mapChargeRow({
      ...baseRow,
      end_date: null,
      charge_energy_added: null,
      charge_energy_used: null,
      cost: null,
      duration_min: null,
      start_battery_level: null,
      end_battery_level: null,
      location: null,
      max_power: null,
      start_rated_range_km: null,
      end_rated_range_km: null,
      outside_temp_avg: null,
      max_voltage: null,
      fast_charger: null,
      latitude: null,
      longitude: null,
    });
    expect(c.location).toBe("Unknown location");
    expect(c.chargeKind).toBeNull();
  });
  it("detects DC from fast charger / high voltage", () => {
    expect(mapChargeRow({ ...baseRow, fast_charger: true, max_power: 150 }).chargeKind).toBe("DC");
    expect(mapChargeRow({ ...baseRow, max_voltage: 400, max_power: 100 }).chargeKind).toBe("DC");
  });
});

describe("inferChargeKind", () => {
  it("DC heuristics", () => {
    expect(inferChargeKind({ fastCharger: true, maxVoltage: null, maxPowerKw: null })).toBe("DC");
    expect(inferChargeKind({ fastCharger: false, maxVoltage: 400, maxPowerKw: 50 })).toBe("DC");
    expect(inferChargeKind({ fastCharger: false, maxVoltage: 240, maxPowerKw: 11 })).toBe("AC");
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
