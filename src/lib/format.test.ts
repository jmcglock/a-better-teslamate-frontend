import { describe, expect, it } from "vitest";
import {
  formatCost, formatDistance, formatDuration, formatEfficiency, formatEnergy, formatOdometer,
  formatPct, formatPower, formatPressure, formatSpeed, formatTemp, kmToUnit, num,
} from "@/lib/format";

describe("num", () => {
  it("parses pg decimal strings", () => expect(num("12.50")).toBe(12.5));
  it("passes numbers through", () => expect(num(7)).toBe(7));
  it("null for null/undefined/garbage", () => {
    expect(num(null)).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num("abc")).toBeNull();
  });
  it("null for empty/whitespace strings", () => {
    expect(num("")).toBeNull();
    expect(num("  ")).toBeNull();
  });
});

describe("units", () => {
  it("km→mi", () => expect(kmToUnit(160.9344, "mi")).toBeCloseTo(100, 4));
  it("km identity", () => expect(kmToUnit(42, "km")).toBe(42));
});

describe("formatters", () => {
  it("distance km", () => expect(formatDistance(12.34, "km")).toBe("12.3 km"));
  it("distance mi", () => expect(formatDistance(16.09344, "mi")).toBe("10.0 mi"));
  it("speed", () => expect(formatSpeed(110, "mi")).toBe("68 mph"));
  it("temp C", () => expect(formatTemp(21.5, "C")).toBe("21.5 °C"));
  it("temp F", () => expect(formatTemp(20, "F")).toBe("68.0 °F"));
  it("duration under an hour", () => expect(formatDuration(45)).toBe("45 min"));
  it("duration over an hour", () => expect(formatDuration(125)).toBe("2 h 05 min"));
  it("energy", () => expect(formatEnergy(12.44)).toBe("12.4 kWh"));
  it("efficiency km", () => expect(formatEfficiency(150, "km")).toBe("150 Wh/km"));
  it("efficiency mi", () => expect(formatEfficiency(150, "mi")).toBe("241 Wh/mi"));
  it("power", () => expect(formatPower(11.2)).toBe("11 kW"));
  it("pct", () => expect(formatPct(82)).toBe("82%"));
  it("odometer grouped", () => expect(formatOdometer(34567.2, "km")).toBe("34,567 km"));
  it("pressure bar", () => expect(formatPressure(2.9, "bar")).toBe("2.9 bar"));
  it("pressure psi", () => expect(formatPressure(2.9, "psi")).toBe("42 psi"));
  it("cost default symbol", () => expect(formatCost(6.184)).toBe("$6.18"));
  it("cost custom symbol", () => expect(formatCost(6.18, "€")).toBe("€6.18"));
  it("null → dash", () => {
    expect(formatDistance(null, "km")).toBe("–");
    expect(formatPressure(null, "bar")).toBe("–");
    expect(formatCost(null)).toBe("–");
  });
});
