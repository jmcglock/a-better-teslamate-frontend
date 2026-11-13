import DataUnavailable from "@/components/DataUnavailable";
import EmptyState from "@/components/EmptyState";
import FilterPills from "@/components/FilterPills";
import BarPanel from "@/components/charts/BarPanel";
import { getChargingPerformanceInsights } from "@/lib/db/chargingPerformance";
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
import { formatCost, formatEnergy } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ChargeLabPage({
  searchParams,
}: {
  searchParams: Promise<{ car?: string; range?: string }>;
}) {
  const sp = await searchParams;
  const currency = process.env.CURRENCY ?? "$";

  const carsRes = await safe(listCarIdentities());
  if (!carsRes.ok) return <DataUnavailable service="database" detail={carsRes.error} />;
  const cars = carsRes.data;
  if (cars.length === 0) return <DataUnavailable service="database" detail="No cars found. Sign in to TeslaMate first." />;

  const range = parseHistoryRange(sp.range);
  const carId = parseCarId(sp.car, cars.map((c) => c.id));
  const car = carId === null ? cars[0] : cars.find((c) => c.id === carId) ?? cars[0];
  const months = historyRangeMonths(range);

  const res = await safe(Promise.all([getChargingPerformanceInsights(car.id, months), getSettings()]));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [insights, settings] = res.data;
  if (!settings) return <DataUnavailable service="database" detail="No settings" />;

  const hasData = insights.summary.sessions > 0;
  const taperData = insights.socBins.map((b) => ({ label: `${b.binStart}%`, v: b.avgPowerKw ?? 0 }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">Charging performance lab</h1>
          <p className="mt-1 text-sm text-ink-2">DC taper, time-to-80%, site scorecard, and charging losses.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {cars.length > 1 && (
            <FilterPills
              options={cars.map((c) => ({ key: String(c.id), label: c.name }))}
              active={String(car.id)}
              hrefFor={(id) => historyHref("/charge-lab", { car: Number(id), range })}
            />
          )}
          <FilterPills
            options={HISTORY_RANGES}
            active={range}
            hrefFor={(key) => historyHref("/charge-lab", { car: cars.length > 1 ? car.id : null, range: key })}
          />
        </div>
      </div>

      {!hasData ? (
        <EmptyState title="No charging sessions" detail="Plug in and TeslaMate will record sessions here." icon="⚡" />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Sessions</div>
              <div className="text-lg font-semibold">{insights.summary.sessions}</div>
              <div className="text-xs text-ink-2">{insights.summary.dcSessions} DC fast</div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Avg peak power</div>
              <div className="text-lg font-semibold">{insights.summary.avgPeakPowerKw ?? "—"} kW</div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Median time to 80%</div>
              <div className="text-lg font-semibold">{insights.summary.medianTimeTo80Min ?? "—"} min</div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Charging losses</div>
              <div className="text-lg font-semibold">{insights.summary.lossPct ?? "—"}%</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BarPanel title="DC taper by SoC" unit="kW" data={taperData} color="var(--accent)" formatValue={(v) => `${Math.round(v)} kW`} />
            <div className="rounded-2xl border border-line bg-panel p-4">
              <div className="mb-2 text-sm font-medium">Site scorecard</div>
              <ul className="divide-y divide-line">
                {insights.sites.map((site) => (
                  <li key={site.location} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{site.location}</span>
                    <span className="text-ink-2">{site.sessions} sessions</span>
                    <span>{site.avgPeakPowerKw ?? "—"} kW peak</span>
                    <span className="text-ink-2">{site.avgTimeTo80Min ?? "—"} min to 80%</span>
                    <span>{formatEnergy(site.energyAddedKwh)}</span>
                    <span className="text-ink-2">{site.lossPct ?? "—"}% loss</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}