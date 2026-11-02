import { describe, expect, it } from "vitest";
import type { ChargeListItem } from "@/lib/db/charges";
import type { DriveListItem } from "@/lib/db/drives";
import { buildChargesExport, buildDrivesExport } from "@/lib/exportHistory";

const DRIVE_HEADER = "id,car,started_at,ended_at,start_location,end_location,distance_km,duration_min,efficiency_wh_per_km,speed_max_kmh";
const CHARGE_HEADER = "id,car,started_at,ended_at,location,kind,energy_added_kwh,soc_start_pct,soc_end_pct,duration_min,cost";

function drive(overrides: Partial<DriveListItem> = {}): DriveListItem {
  return {
    id: 1,
    startDate: "2026-11-02T15:00:00.000Z",
    endDate: null,
    distanceKm: 21.7,
    durationMin: 30,
    speedMaxKmh: 118,
    rangeUsedKm: 14,
    startLabel: "=Home",
    endLabel: "Austin, TX",
    outsideTempAvgC: null,
    insideTempAvgC: null,
    powerMaxKw: null,
    powerMinKw: null,
    ascentM: null,
    descentM: null,
    startRatedRangeKm: null,
    endRatedRangeKm: null,
    efficiencyWhPerKm: 150,
    carName: "Red",
    ...overrides,
  };
}

function charge(overrides: Partial<ChargeListItem> = {}): ChargeListItem {
  return {
    id: 3,
    startDate: "2026-11-01T02:00:00.000Z",
    endDate: "2026-11-01T06:00:00.000Z",
    location: "@Depot, Inc",
    energyAddedKwh: 41.2,
    energyUsedKwh: 43,
    cost: 6.18,
    durationMin: 240,
    socStart: 22,
    socEnd: 80,
    maxPowerKw: 150,
    startRatedRangeKm: 80,
    endRatedRangeKm: 280,
    outsideTempAvgC: 12,
    maxVoltage: 400,
    fastCharger: true,
    latitude: 37.4,
    longitude: -122.1,
    chargeKind: "DC",
    carName: "Red",
    ...overrides,
  };
}

describe("drives export", () => {
  it("passes the car and time window to the drives query and ignores the list page", async () => {
    const calls: { page: number; carId: number | null | undefined; months: number | null | undefined }[] = [];
    const result = await buildDrivesExport(
      new URL("http://localhost/api/drives/export?car=2&range=3m&page=4"),
      {
        knownCarIds: [1, 2],
        listDrives: async (page, opts) => {
          calls.push({ page, carId: opts.carId, months: opts.months });
          return { items: [], hasMore: false };
        },
      },
    );

    expect(calls).toEqual([{ page: 1, carId: 2, months: 3 }]);
    expect(result.filename).toBe("drives-car-2-3m.csv");
    expect(result.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(result.headers.get("Content-Disposition")).toBe('attachment; filename="drives-car-2-3m.csv"');
  });

  it("returns a header-only CSV when the window has no drives", async () => {
    const result = await buildDrivesExport(
      new URL("http://localhost/api/drives/export?range=1m"),
      {
        knownCarIds: [1],
        listDrives: async () => ({ items: [], hasMore: false }),
      },
    );
    expect(result.filename).toBe("drives-1m.csv");
    expect(await result.text()).toBe(`${DRIVE_HEADER}\r\n`);
  });

  it("includes every page in the window and guards formula text", async () => {
    const result = await buildDrivesExport(
      new URL("http://localhost/api/drives/export?range=12m"),
      {
        knownCarIds: [1, 2],
        listDrives: async (page) => {
          if (page === 1) return { items: [drive()], hasMore: true };
          if (page === 2) {
            return {
              items: [drive({
                id: 2,
                carName: "Blue",
                startDate: "2026-06-15T12:00:00.000Z",
                endDate: "2026-06-15T12:40:00.000Z",
                startLabel: "Work",
                endLabel: "Park",
                distanceKm: 10,
                durationMin: 40,
                efficiencyWhPerKm: null,
                speedMaxKmh: null,
              })],
              hasMore: false,
            };
          }
          throw new Error(`unexpected page ${page}`);
        },
      },
    );

    expect(result.filename).toBe("drives-12m.csv");
    expect(await result.text()).toBe(
      `${DRIVE_HEADER}\r\n` +
      `1,Red,2026-11-02T15:00:00.000Z,,'=Home,"Austin, TX",21.7,30,150,118\r\n` +
      "2,Blue,2026-06-15T12:00:00.000Z,2026-06-15T12:40:00.000Z,Work,Park,10,40,,\r\n",
    );
  });

  it("treats an unknown car or range as all cars and all history", async () => {
    const calls: { carId: number | null | undefined; months: number | null | undefined }[] = [];
    const result = await buildDrivesExport(
      new URL("http://localhost/api/drives/export?car=9&range=24m"),
      {
        knownCarIds: [1, 2],
        listDrives: async (_page, opts) => {
          calls.push({ carId: opts.carId, months: opts.months });
          return { items: [], hasMore: false };
        },
      },
    );
    expect(calls).toEqual([{ carId: null, months: null }]);
    expect(result.filename).toBe("drives-all.csv");
  });
});

describe("charges export", () => {
  it("passes the car and time window to the charges query and ignores the list page", async () => {
    const calls: { page: number; carId: number | null | undefined; months: number | null | undefined }[] = [];
    const result = await buildChargesExport(
      new URL("http://localhost/api/charges/export?car=1&range=12m&page=2"),
      {
        knownCarIds: [1],
        listCharges: async (page, opts) => {
          calls.push({ page, carId: opts.carId, months: opts.months });
          return { items: [], hasMore: false };
        },
      },
    );

    expect(calls).toEqual([{ page: 1, carId: 1, months: 12 }]);
    expect(result.filename).toBe("charges-car-1-12m.csv");
    expect(result.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(result.headers.get("Content-Disposition")).toBe('attachment; filename="charges-car-1-12m.csv"');
  });

  it("returns a header-only CSV when the window has no charges", async () => {
    const result = await buildChargesExport(
      new URL("http://localhost/api/charges/export"),
      {
        knownCarIds: [],
        listCharges: async () => ({ items: [], hasMore: false }),
      },
    );
    expect(result.filename).toBe("charges-all.csv");
    expect(await result.text()).toBe(`${CHARGE_HEADER}\r\n`);
  });

  it("includes every page in the window and guards formula text", async () => {
    const result = await buildChargesExport(
      new URL("http://localhost/api/charges/export?car=2&range=1m"),
      {
        knownCarIds: [2],
        listCharges: async (page, opts) => {
          expect(opts.carId).toBe(2);
          expect(opts.months).toBe(1);
          if (page === 1) return { items: [charge()], hasMore: true };
          return { items: [charge({ id: 4, location: "Home", chargeKind: "AC", cost: null })], hasMore: false };
        },
      },
    );

    expect(result.filename).toBe("charges-car-2-1m.csv");
    const body = await result.text();
    expect(body).toBe(
      `${CHARGE_HEADER}\r\n` +
      `3,Red,2026-11-01T02:00:00.000Z,2026-11-01T06:00:00.000Z,"'@Depot, Inc",DC,41.2,22,80,240,6.18\r\n` +
      "4,Red,2026-11-01T02:00:00.000Z,2026-11-01T06:00:00.000Z,Home,AC,41.2,22,80,240,\r\n",
    );
  });
});
