import type { ChargeListItem } from "@/lib/db/charges";
import type { DriveListItem } from "@/lib/db/drives";
import {
  chargesCsv,
  drivesCsv,
  loadChargesExport,
  loadDrivesExport,
  type ChargesExportDeps,
  type DrivesExportDeps,
  type ExportFilters,
} from "@/lib/exportHistory";

export type AllExportDeps = DrivesExportDeps & ChargesExportDeps & { now?: () => Date };

export type BundleSummary = {
  generatedAt: string;
  range: string;
  car: number | null;
  drives: { count: number; distanceKm: number; durationMin: number };
  charges: { count: number; energyAddedKwh: number; cost: number };
};

export const BUNDLE_ENTRIES = ["drives.csv", "charges.csv", "summary.json"] as const;

export async function buildAllExport(
  url: URL,
  deps: AllExportDeps,
): Promise<Response & { filename: string }> {
  const [drives, charges] = await Promise.all([
    loadDrivesExport(url, deps),
    loadChargesExport(url, deps),
  ]);
  const filters = drives.filters;
  const summary = summarize(filters, drives.items, charges.items, deps.now?.() ?? new Date());
  const zip = createZip([
    { name: BUNDLE_ENTRIES[0], data: utf8(drivesCsv(drives.items)) },
    { name: BUNDLE_ENTRIES[1], data: utf8(chargesCsv(charges.items)) },
    { name: BUNDLE_ENTRIES[2], data: utf8(`${JSON.stringify(summary, null, 2)}\n`) },
  ]);
  const filename = bundleFilename(filters);
  const response = new Response(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
  return Object.assign(response, { filename });
}

export function bundleFilename(filters: Pick<ExportFilters, "range" | "carId">): string {
  const car = filters.carId === null ? "" : `-car-${filters.carId}`;
  return `teslamate-export${car}-${filters.range}.zip`;
}

function summarize(
  filters: ExportFilters,
  drives: readonly DriveListItem[],
  charges: readonly ChargeListItem[],
  now: Date,
): BundleSummary {
  return {
    generatedAt: now.toISOString(),
    range: filters.range,
    car: filters.carId,
    drives: {
      count: drives.length,
      distanceKm: sum(drives.map((drive) => drive.distanceKm)),
      durationMin: sum(drives.map((drive) => drive.durationMin)),
    },
    charges: {
      count: charges.length,
      energyAddedKwh: sum(charges.map((charge) => charge.energyAddedKwh)),
      cost: sum(charges.map((charge) => charge.cost)),
    },
  };
}

function sum(values: readonly (number | null)[]): number {
  const total = values.reduce<number>((acc, value) => acc + (value ?? 0), 0);
  return Math.round(total * 100) / 100;
}

function dosTimestamp(date: Date): [time: number, day: number] {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day =
    ((Math.max(date.getFullYear(), 1980) - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return [time, day];
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

type ZipEntry = { name: string; data: Uint8Array };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Minimal ZIP writer. Entries are stored (no deflate) so the bundle works
 * without an extra dependency; CSV compresses well enough downstream anyway.
 */
export function createZip(entries: readonly ZipEntry[], now: Date = new Date()): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const [dosTime, dosDate] = dosTimestamp(now);
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    localParts.push(local, entry.data);
    centralParts.push(central);
    offset += local.length + size;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const parts = [...localParts, ...centralParts, end];
  const total = parts.reduce((size, part) => size + part.length, 0);
  const zip = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    zip.set(part, cursor);
    cursor += part.length;
  }
  return zip;
}
