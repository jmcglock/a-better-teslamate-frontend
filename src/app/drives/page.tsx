import Link from "next/link";
import DataUnavailable from "@/components/DataUnavailable";
import EmptyState from "@/components/EmptyState";
import FilterPills from "@/components/FilterPills";
import { listDrives } from "@/lib/db/drives";
import { listCarIdentities } from "@/lib/db/stats";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";
import {
  HISTORY_RANGES,
  historyHref,
  historyRangeMonths,
  parseCarId,
  parseHistoryRange,
} from "@/lib/db/range";
import { formatDistance, formatDuration, formatEfficiency, formatSpeed } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DrivesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; car?: string; range?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const range = parseHistoryRange(sp.range);

  const carsRes = await safe(listCarIdentities());
  if (!carsRes.ok) return <DataUnavailable service="database" detail={carsRes.error} />;
  const cars = carsRes.data;
  const carId = parseCarId(sp.car, cars.map((car) => car.id));

  const res = await safe(Promise.all([
    listDrives(page, { carId, months: historyRangeMonths(range) }),
    getSettings(),
  ]));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [{ items: drives, hasMore }, settings] = res.data;
  const filtered = carId !== null || range !== "all";
  const href = (nextPage: number) => historyHref("/drives", { car: carId, range, page: nextPage });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">Drives</h1>
        <div className="flex flex-wrap items-center gap-4">
          {cars.length > 1 && (
            <FilterPills
              options={[{ key: "all", label: "All cars" }, ...cars.map((car) => ({ key: String(car.id), label: car.name }))]}
              active={carId === null ? "all" : String(carId)}
              hrefFor={(key) => historyHref("/drives", { car: key === "all" ? null : Number(key), range })}
            />
          )}
          <FilterPills
            options={HISTORY_RANGES}
            active={range}
            hrefFor={(key) => historyHref("/drives", { car: carId, range: key })}
          />
        </div>
      </div>
      {drives.length === 0 ? (
        <EmptyState
          title={filtered ? "No drives in this view" : "No drives on this page"}
          detail={filtered ? "Widen the range or pick another car." : "Take a trip and TeslaMate will log it here."}
          icon="→"
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
          {drives.map((d) => (
            <li key={d.id}>
              <Link href={`/drives/${d.id}`} className="list-row">
                <span className="w-40 font-[family-name:var(--font-mono)] text-xs text-ink-2">
                  {new Date(d.startDate).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
                {cars.length > 1 && <span className="text-xs text-ink-2">{d.carName}</span>}
                <span className="min-w-0 flex-1 truncate text-sm">{d.startLabel} → {d.endLabel}</span>
                <span className="text-sm">{formatDistance(d.distanceKm, settings.unitOfLength)}</span>
                <span className="text-sm text-ink-2">{formatDuration(d.durationMin)}</span>
                <span className="text-sm text-ink-2">{formatEfficiency(d.efficiencyWhPerKm, settings.unitOfLength)}</span>
                <span className="text-sm text-ink-2">max {formatSpeed(d.speedMaxKmh, settings.unitOfLength)}</span>
                <span className="list-row-chevron text-sm" aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <nav className="mt-4 flex gap-3 text-sm">
        {page > 1 && <Link className="pressable text-ink-2 hover:text-ink" href={href(page - 1)}>← Newer</Link>}
        {hasMore && <Link className="pressable text-ink-2 hover:text-ink" href={href(page + 1)}>Older →</Link>}
      </nav>
    </div>
  );
}
