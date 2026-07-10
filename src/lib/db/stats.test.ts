import { describe, expect, it } from "vitest";
import { drainPctPerDay, monthLabel } from "@/lib/db/stats";

describe("drainPctPerDay", () => {
  it("computes normalized drain", () => expect(drainPctPerDay(80, 75, 24)).toBeCloseTo(5));
  it("scales to 24h", () => expect(drainPctPerDay(80, 78, 12)).toBeCloseTo(4));
  it("null for short gaps", () => expect(drainPctPerDay(80, 79, 3)).toBeNull());
  it("null for negative drain", () => expect(drainPctPerDay(70, 75, 24)).toBeNull());
});

describe("monthLabel", () => {
  it("formats", () => expect(monthLabel(new Date("2026-07-01T00:00:00Z"))).toBe("Jul 26"));
});
