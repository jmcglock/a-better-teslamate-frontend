import { describe, expect, it } from "vitest";
import type { ChargeListItem } from "@/lib/db/charges";
import type { DriveListItem } from "@/lib/db/drives";
import { buildAllExport } from "@/lib/exportAll";

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
    startLabel: "Home",
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
    location: "Depot",
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

type ReadEntry = { name: string; body: string };

function readZip(bytes: Uint8Array): ReadEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = bytes.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("missing end of central directory");
  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const entries: ReadEntry[] = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(cursor, true)).toBe(0x02014b50);
    const size = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    entries.push({ name, body: new TextDecoder().decode(bytes.subarray(dataStart, dataStart + size)) });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

describe("all data export", () => {
  it("passes the car and time window to both datasets and names the bundle", async () => {
    const calls: { dataset: string; page: number; carId: number | null | undefined; months: number | null | undefined }[] = [];
    const result = await buildAllExport(
      new URL("http://localhost/api/export/all?car=2&range=3m"),
      {
        knownCarIds: [1, 2],
        listDrives: async (page, opts) => {
          calls.push({ dataset: "drives", page, carId: opts.carId, months: opts.months });
          return { items: [], hasMore: false };
        },
        listCharges: async (page, opts) => {
          calls.push({ dataset: "charges", page, carId: opts.carId, months: opts.months });
          return { items: [], hasMore: false };
        },
      },
    );

    expect(calls).toEqual([
      { dataset: "drives", page: 1, carId: 2, months: 3 },
      { dataset: "charges", page: 1, carId: 2, months: 3 },
    ]);
    expect(result.filename).toBe("teslamate-export-car-2-3m.zip");
    expect(result.headers.get("Content-Type")).toBe("application/zip");
    expect(result.headers.get("Content-Disposition")).toBe(
      'attachment; filename="teslamate-export-car-2-3m.zip"',
    );
  });

  it("falls back to all cars and all history for unknown params", async () => {
    const seen: { carId?: number | null; months?: number | null; pageSize?: number }[] = [];
    const result = await buildAllExport(
      new URL("http://localhost/api/export/all?car=9&range=24m"),
      {
        knownCarIds: [1, 2],
        listDrives: async (_page, opts) => {
          seen.push(opts);
          return { items: [], hasMore: false };
        },
        listCharges: async (_page, opts) => {
          seen.push(opts);
          return { items: [], hasMore: false };
        },
      },
    );

    expect(seen).toEqual([
      { carId: null, months: null, pageSize: 500 },
      { carId: null, months: null, pageSize: 500 },
    ]);
    expect(result.filename).toBe("teslamate-export-all.zip");
  });

  it("bundles drives.csv, charges.csv and summary.json", async () => {
    const result = await buildAllExport(
      new URL("http://localhost/api/export/all?range=12m"),
      {
        knownCarIds: [1],
        listDrives: async () => ({ items: [drive()], hasMore: false }),
        listCharges: async () => ({ items: [charge()], hasMore: false }),
        now: () => new Date("2026-11-04T12:00:00.000Z"),
      },
    );

    const entries = readZip(new Uint8Array(await result.arrayBuffer()));
    expect(entries.map((entry) => entry.name)).toEqual(["drives.csv", "charges.csv", "summary.json"]);
    expect(entries[0].body).toBe(
      `${DRIVE_HEADER}\r\n1,Red,2026-11-02T15:00:00.000Z,,Home,"Austin, TX",21.7,30,150,118\r\n`,
    );
    expect(entries[1].body).toBe(
      `${CHARGE_HEADER}\r\n3,Red,2026-11-01T02:00:00.000Z,2026-11-01T06:00:00.000Z,Depot,DC,41.2,22,80,240,6.18\r\n`,
    );
    const summary = JSON.parse(entries[2].body);
    expect(summary).toEqual({
      generatedAt: "2026-11-04T12:00:00.000Z",
      range: "12m",
      car: null,
      drives: { count: 1, distanceKm: 21.7, durationMin: 30 },
      charges: { count: 1, energyAddedKwh: 41.2, cost: 6.18 },
    });
  });

  it("still produces a valid bundle when there is no data", async () => {
    const result = await buildAllExport(
      new URL("http://localhost/api/export/all"),
      {
        knownCarIds: [],
        listDrives: async () => ({ items: [], hasMore: false }),
        listCharges: async () => ({ items: [], hasMore: false }),
      },
    );

    const entries = readZip(new Uint8Array(await result.arrayBuffer()));
    expect(entries.map((entry) => entry.name)).toEqual(["drives.csv", "charges.csv", "summary.json"]);
    expect(entries[0].body).toBe(`${DRIVE_HEADER}\r\n`);
    expect(entries[1].body).toBe(`${CHARGE_HEADER}\r\n`);
    expect(JSON.parse(entries[2].body)).toMatchObject({
      range: "all",
      car: null,
      drives: { count: 0, distanceKm: 0, durationMin: 0 },
      charges: { count: 0, energyAddedKwh: 0, cost: 0 },
    });
  });
});
