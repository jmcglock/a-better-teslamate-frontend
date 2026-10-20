import Link from "next/link";
import DataUnavailable from "@/components/DataUnavailable";
import EmptyState from "@/components/EmptyState";
import FilterPills from "@/components/FilterPills";
import { listCharges } from "@/lib/db/charges";
import { listCarIdentities } from "@/lib/db/stats";
import { safe } from "@/lib/db/pool";
import {
  HISTORY_RANGES,
  historyHref,
  historyRangeMonths,
  parseCarId,
  parseHistoryRange,
} from "@/lib/db/range";
import { formatCost, formatDuration, formatEnergy, formatPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; car?: string; range?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const range = parseHistoryRange(sp.range);
  const currency = process.env.CURRENCY ?? "$";

  const carsRes = await safe(listCarIdentities());
  if (!carsRes.ok) return <DataUnavailable service="database" detail={carsRes.error} />;
  const cars = carsRes.data;
  const carId = parseCarId(sp.car, cars.map((car) => car.id));

  const res = await safe(listCharges(page, { carId, months: historyRangeMonths(range) }));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const { items: charges, hasMore } = res.data;
  const filtered = carId !== null || range !== "all";
  const href = (nextPage: number) => historyHref("/charges", { car: carId, range, page: nextPage });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">Charges</h1>
        <div className="flex flex-wrap items-center gap-4">
          {cars.length > 1 && (
            <FilterPills
              options={[{ key: "all", label: "All cars" }, ...cars.map((car) => ({ key: String(car.id), label: car.name }))]}
              active={carId === null ? "all" : String(carId)}
              hrefFor={(key) => historyHref("/charges", { car: key === "all" ? null : Number(key), range })}
            />
          )}
          <FilterPills
            options={HISTORY_RANGES}
            active={range}
            hrefFor={(key) => historyHref("/charges", { car: carId, range: key })}
          />
        </div>
      </div>
      {charges.length === 0 ? (
        <EmptyState
          title={filtered ? "No charges in this view" : "No charging sessions"}
          detail={filtered ? "Widen the range or pick another car." : "Plug in and TeslaMate will record sessions here."}
          icon="⚡"
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
          {charges.map((c) => (
            <li key={c.id}>
              <Link href={`/charges/${c.id}`} className="list-row">
                <span className="w-40 font-[family-name:var(--font-mono)] text-xs text-ink-2">
                  {new Date(c.startDate).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
                {cars.length > 1 && <span className="text-xs text-ink-2">{c.carName}</span>}
                <span className="min-w-0 flex-1 truncate text-sm">
                  {c.location}
                  {c.chargeKind ? (
                    <span className="ml-2 text-xs text-ink-2">{c.chargeKind}</span>
                  ) : null}
                </span>
                <span className="text-sm">{formatEnergy(c.energyAddedKwh)}</span>
                <span className="text-sm text-ink-2">{formatPct(c.socStart)} → {formatPct(c.socEnd)}</span>
                <span className="text-sm text-ink-2">{formatDuration(c.durationMin)}</span>
                <span className="text-sm">{formatCost(c.cost, currency)}</span>
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
