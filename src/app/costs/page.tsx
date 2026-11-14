import DataUnavailable from "@/components/DataUnavailable";
import EmptyState from "@/components/EmptyState";
import FilterPills from "@/components/FilterPills";
import BarPanel from "@/components/charts/BarPanel";
import { getCostInsights } from "@/lib/db/costs";
import { listCarIdentities } from "@/lib/db/stats";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";
import {
  historyHref,
  parseCarId,
} from "@/lib/db/range";
import { KM_PER_MI, formatCost, formatDistance, formatEnergy, formatPct } from "@/lib/format";
import { STATS_RANGES, parseStatsRange, statsRangeMonths } from "@/lib/db/stats";

export const dynamic = "force-dynamic";

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ car?: string; range?: string }>;
}) {
  const sp = await searchParams;
  const currency = process.env.CURRENCY ?? "$";

  const carsRes = await safe(listCarIdentities());
  if (!carsRes.ok) return <DataUnavailable service="database" detail={carsRes.error} />;
  const cars = carsRes.data;
  if (cars.length === 0) {
    return <DataUnavailable service="database" detail="No cars found. Sign in to TeslaMate first." />;
  }

  const range = parseStatsRange(sp.range);
  const carId = parseCarId(sp.car, cars.map((car) => car.id));
  const car = carId === null ? cars[0] : cars.find((c) => c.id === carId) ?? cars[0];
  const months = statsRangeMonths(range);

  const res = await safe(
    Promise.all([
      getCostInsights(car.id, months),
      getSettings(),
    ]),
  );
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [insights, settings] = res.data;
  if (!settings) return <DataUnavailable service="database" detail="No settings" />;

  const hasData = insights.summary.sessions > 0;
  const unit = settings.unitOfLength;
  const perDist = (perKm: number | null) => (perKm === null ? null : unit === "mi" ? perKm * KM_PER_MI : perKm);
  const costPer100Summary = perDist(insights.summary.costPer100Km);
  const costPer100KmData = insights.monthly.map((m) => ({
    label: m.label,
    v: perDist(m.costPer100Km) ?? 0,
  }));
  const costData = insights.monthly.map((m) => ({ label: m.label, v: m.cost }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">
            Charging costs
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Cost per distance, cost coverage, and where your charging money goes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {cars.length > 1 && (
            <FilterPills
              options={cars.map((c) => ({ key: String(c.id), label: c.name }))}
              active={String(car.id)}
              hrefFor={(id) => historyHref("/costs", { defaultRange: "12m", car: Number(id), range })}
            />
          )}
          <FilterPills
            options={STATS_RANGES}
            active={range}
            hrefFor={(key) => historyHref("/costs", { defaultRange: "12m", car: cars.length > 1 ? car.id : null, range: key })}
          />
        </div>
      </div>

      {!hasData ? (
        <EmptyState
          title="No charging sessions"
          detail="Plug in and TeslaMate will record sessions here."
          icon="⚡"
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Sessions</div>
              <div className="text-lg font-semibold">{insights.summary.sessions}</div>
              <div className="text-xs text-ink-2">
                {insights.summary.sessionsWithCost} with cost ({formatPct(insights.summary.costCoveragePct ?? 0)})
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Total cost</div>
              <div className="text-lg font-semibold">{formatCost(insights.summary.cost, currency)}</div>
              <div className="text-xs text-ink-2">{formatEnergy(insights.summary.energyKwh)} added</div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Avg cost/kWh</div>
              <div className="text-lg font-semibold">
                {insights.summary.avgCostPerKwh === null ? "—" : formatCost(insights.summary.avgCostPerKwh, currency)}
              </div>
              <div className="text-xs text-ink-2">priced energy only</div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Cost / 100 {unit}</div>
              <div className="text-lg font-semibold">
                {costPer100Summary === null ? "—" : formatCost(costPer100Summary, currency)}
              </div>
              <div className="text-xs text-ink-2">{formatDistance(insights.summary.distanceKm, unit, 0)} driven</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BarPanel
              title="Monthly charging cost"
              unit={currency}
              data={costData}
              color="var(--accent)"
              valuePrefix={currency}
              valueDecimals={2}
              valueSuffix=""
            />
            <BarPanel
              title={`Cost per 100 ${unit}`}
              unit={`${currency}/100${unit}`}
              data={costPer100KmData}
              color="var(--good)"
              valuePrefix={currency}
              valueDecimals={2}
              valueSuffix=""
            />
          </div>

          {insights.opportunity && (
            <div className="mt-4 rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Savings opportunity</div>
              <p className="mt-1 text-sm">
                Charging at <span className="font-semibold">{insights.opportunity.priciest.location}</span> costs{" "}
                {formatCost(insights.opportunity.priciest.avgCostPerKwh, currency)}/kWh vs{" "}
                {formatCost(insights.opportunity.cheapest.avgCostPerKwh, currency)}/kWh at{" "}
                <span className="font-semibold">{insights.opportunity.cheapest.location}</span>. Aligning priced sessions to the cheapest rate could save{" "}
                <span className="font-semibold">{formatCost(insights.opportunity.potentialSavings, currency)}</span>.
              </p>
            </div>
          )}

          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-2">Cost by charging location</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
              {insights.places.map((place) => (
                <li key={place.location} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{place.location}</span>
                  <span className="text-ink-2">{place.sessions} sessions</span>
                  <span className="text-ink-2">{place.sessionsWithCost} priced</span>
                  <span>{formatEnergy(place.energyKwh)}</span>
                  <span>{formatCost(place.cost, currency)}</span>
                  <span className="text-ink-2">
                    {place.avgCostPerKwh === null ? "—" : `${formatCost(place.avgCostPerKwh, currency)}/kWh`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}