import { describe, expect, it } from "vitest";
import { isHomeLocation, summarizePlaceSpend, type PlaceItem } from "@/lib/db/locations";

function place(location: string, cost: number, energyKwh: number, visits = 1): PlaceItem {
  return { location, cost, energyKwh, visits, lastVisit: null };
}

describe("isHomeLocation", () => {
  it("matches the geofence name Home only", () => {
    expect(isHomeLocation("Home")).toBe(true);
    expect(isHomeLocation(" home ")).toBe(true);
    expect(isHomeLocation("Home Depot")).toBe(false);
  });
});

describe("summarizePlaceSpend", () => {
  it("ranks by cost and rolls the tail into Other", () => {
    const places = [
      place("Home", 10, 40, 8),
      place("Supercharger", 80, 30, 2),
      place("Work", 5, 12, 4),
      place("Mall", 1, 3, 1),
    ];
    const rollup = summarizePlaceSpend(places, 2);
    expect(rollup.ranked.map((p) => p.location)).toEqual(["Supercharger", "Home"]);
    expect(rollup.other?.location).toBe("Other");
    expect(rollup.other?.cost).toBe(6);
    expect(rollup.home?.cost).toBe(10);
    expect(rollup.away.cost).toBe(86);
    expect(rollup.away.visits).toBe(7);
  });

  it("keeps Home visible when it falls outside the top ranks", () => {
    const places = [
      place("A", 50, 1),
      place("B", 40, 1),
      place("Home", 1, 20, 9),
    ];
    const rollup = summarizePlaceSpend(places, 2);
    expect(rollup.ranked.map((p) => p.location)).toEqual(["A", "Home"]);
    expect(rollup.other?.location).toBe("Other");
    expect(rollup.other?.cost).toBe(40);
  });
});
