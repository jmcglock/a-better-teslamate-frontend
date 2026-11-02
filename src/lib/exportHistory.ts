import type { ChargeListItem } from "@/lib/db/charges";
import type { DriveListItem } from "@/lib/db/drives";
import {
  historyRangeMonths,
  parseCarId,
  parseHistoryRange,
  type HistoryRangeKey,
} from "@/lib/db/range";
import { serializeCsv, type CsvCell } from "@/lib/csv";

type ListOpts = { pageSize?: number; carId?: number | null; months?: number | null };
type Page<T> = { items: T[]; hasMore: boolean };

export type DrivesExportDeps = {
  knownCarIds: number[];
  listDrives: (page: number, opts: ListOpts) => Promise<Page<DriveListItem>>;
};

export type ChargesExportDeps = {
  knownCarIds: number[];
  listCharges: (page: number, opts: ListOpts) => Promise<Page<ChargeListItem>>;
};

const EXPORT_PAGE_SIZE = 500;
const MAX_EXPORT_PAGES = 10_000;

const DRIVE_HEADERS = [
  "id",
  "car",
  "started_at",
  "ended_at",
  "start_location",
  "end_location",
  "distance_km",
  "duration_min",
  "efficiency_wh_per_km",
  "speed_max_kmh",
] as const;

const CHARGE_HEADERS = [
  "id",
  "car",
  "started_at",
  "ended_at",
  "location",
  "kind",
  "energy_added_kwh",
  "soc_start_pct",
  "soc_end_pct",
  "duration_min",
  "cost",
] as const;

export async function buildDrivesExport(url: URL, deps: DrivesExportDeps): Promise<Response & { filename: string }> {
  const filters = filtersFromUrl(url, deps.knownCarIds);
  const items = await loadAll(deps.listDrives, filters);
  return csvAttachment(
    exportFilename("drives", filters.range, filters.carId),
    serializeCsv(DRIVE_HEADERS, items.map(driveRow)),
  );
}

export async function buildChargesExport(url: URL, deps: ChargesExportDeps): Promise<Response & { filename: string }> {
  const filters = filtersFromUrl(url, deps.knownCarIds);
  const items = await loadAll(deps.listCharges, filters);
  return csvAttachment(
    exportFilename("charges", filters.range, filters.carId),
    serializeCsv(CHARGE_HEADERS, items.map(chargeRow)),
  );
}

function filtersFromUrl(url: URL, knownCarIds: number[]) {
  const range = parseHistoryRange(url.searchParams.get("range"));
  const carId = parseCarId(url.searchParams.get("car") ?? undefined, knownCarIds);
  return { carId, range, months: historyRangeMonths(range) };
}

function exportFilename(resource: "drives" | "charges", range: HistoryRangeKey, carId: number | null): string {
  const car = carId === null ? "" : `-car-${carId}`;
  return `${resource}${car}-${range}.csv`;
}

async function loadAll<T>(
  list: (page: number, opts: ListOpts) => Promise<Page<T>>,
  filters: { carId: number | null; months: number | null },
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= MAX_EXPORT_PAGES; page++) {
    const res = await list(page, {
      carId: filters.carId,
      months: filters.months,
      pageSize: EXPORT_PAGE_SIZE,
    });
    items.push(...res.items);
    if (!res.hasMore || res.items.length === 0) return items;
  }
  throw new Error("export exceeded page limit");
}

function driveRow(drive: DriveListItem): CsvCell[] {
  return [
    drive.id,
    drive.carName,
    drive.startDate,
    drive.endDate,
    drive.startLabel,
    drive.endLabel,
    drive.distanceKm,
    drive.durationMin,
    drive.efficiencyWhPerKm,
    drive.speedMaxKmh,
  ];
}

function chargeRow(charge: ChargeListItem): CsvCell[] {
  return [
    charge.id,
    charge.carName,
    charge.startDate,
    charge.endDate,
    charge.location,
    charge.chargeKind,
    charge.energyAddedKwh,
    charge.socStart,
    charge.socEnd,
    charge.durationMin,
    charge.cost,
  ];
}

function csvAttachment(filename: string, body: string): Response & { filename: string } {
  const response = new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
  return Object.assign(response, { filename });
}
