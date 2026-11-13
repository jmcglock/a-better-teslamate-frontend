import BarPanel from "@/components/charts/BarPanel";
import DataUnavailable from "@/components/DataUnavailable";
import EmptyState from "@/components/EmptyState";
import FilterPills from "@/components/FilterPills";
import { getBatteryStress } from "@/lib/db/batteryStress";
import { historyHref, parseCarId } from "@/lib/db/range";
import { safe } from "@/lib/db/pool";
import {
  STATS_RANGES,
  getBatteryHealth,
  listCarIdentities,
  newCarRatedRangeKm,
  parseStatsRange,
  statsRangeMonths,
  summarizeBatteryHealth,
} from "@/lib/db/stats";

export const dynamic = "force-dynamic";

const fmtPct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);

export default async function StressPage({
  searchParams,
}: {
  searchParams: Promise<{ car?: string; range?: string }>;
}) {
  const sp = await searchParams;

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

  // Usable pack size comes from the same rated-range health series the battery page uses.
  const healthRes = await safe(getBatteryHealth(car.id, "all"));
  const health = summarizeBatteryHealth(healthRes.ok ? healthRes.data : [], {
    newKm: newCarRatedRangeKm({
      model: car.model,
      marketingName: car.marketingName,
      trimBadging: car.trimBadging,
      vin: car.vin,
    }),
    efficiency: car.efficiency,
  });
  const packKwh = health.currentKwh ?? health.newKwh;

  const res = await safe(getBatteryStress(car.id, months, packKwh));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const stress = res.data;

  const hasData = stress.totalHours > 0 || stress.dailyDod.days > 0 || stress.endSoc.sessions > 0;
  const histogramData = stress.histogram.map((bucket) => ({
    label: bucket.label.replace("%", ""),
    v: bucket.pct,
  }));
  const dodData = stress.dailyDod.series.slice(-90).map((point) => ({
    label: point.label,
    v: point.dodPct,
  }));
  const endSocData = stress.endSoc.buckets.map((bucket) => ({
    label: bucket.label.replace("%", ""),
    v: bucket.count,
  }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">
            Battery stress
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Time-weighted SoC exposure, daily depth of discharge, and where charging stops.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {cars.length > 1 && (
            <FilterPills
              options={cars.map((c) => ({ key: String(c.id), label: c.name }))}
              active={String(car.id)}
              hrefFor={(id) => historyHref("/stress", { car: Number(id), range })}
            />
          )}
          <FilterPills
            options={STATS_RANGES}
            active={range}
            hrefFor={(key) =>
              historyHref("/stress", { car: cars.length > 1 ? car.id : null, range: key })
            }
          />
        </div>
      </div>

      {!hasData ? (
        <EmptyState
          title="No battery history"
          detail="Drive and charge a little and TeslaMate will record state-of-charge samples here."
          icon="🔋"
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Time above 80%</div>
              <div className="text-lg font-semibold">{fmtPct(stress.pctAbove80)}</div>
              <div className="text-xs text-ink-2">
                of {stress.totalHours.toFixed(0)} observed hours
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Time below 20%</div>
              <div className="text-lg font-semibold">{fmtPct(stress.pctBelow20)}</div>
              <div className="text-xs text-ink-2">deep-discharge exposure</div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Equivalent cycles</div>
              <div className="text-lg font-semibold">
                {stress.equivalentCycles === null ? "—" : stress.equivalentCycles.toFixed(2)}
              </div>
              <div className="text-xs text-ink-2">
                {stress.energyThroughputKwh.toFixed(0)} kWh charged
                {stress.packKwh === null ? "" : ` · ${stress.packKwh.toFixed(1)} kWh pack`}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Hot &amp; full</div>
              <div className="text-lg font-semibold">{stress.highTempHighSoc.hours.toFixed(0)} h</div>
              <div className="text-xs text-ink-2">
                {fmtPct(stress.highTempHighSoc.pct)} of temp-tracked time
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BarPanel
              title="Time at state of charge"
              unit="% of time"
              data={histogramData}
              color="var(--chart-blue)"
              valueDecimals={1}
              valueSuffix="%"
            />
            <BarPanel
              title="Charge end SoC"
              unit="sessions"
              data={endSocData}
              color="var(--chart-green)"
              valueDecimals={0}
              valueSuffix=" sessions"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Daily depth of discharge</div>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-2">Average</dt>
                  <dd className="font-semibold">{fmtPct(stress.dailyDod.avgPct)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-2">Largest day</dt>
                  <dd className="font-semibold">{fmtPct(stress.dailyDod.maxPct)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-2">Days ≥ 60% DoD</dt>
                  <dd className="font-semibold">
                    {stress.dailyDod.deepDays} ({fmtPct(stress.dailyDod.deepPct)})
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-2">Charge end SoC median</dt>
                  <dd className="font-semibold">{fmtPct(stress.endSoc.median)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-2">Charges ending ≥ 80%</dt>
                  <dd className="font-semibold">{fmtPct(stress.endSoc.pctAtOrAbove80)}</dd>
                </div>
              </dl>
            </div>
            <BarPanel
              title="Daily depth of discharge · last 90 days"
              unit="% DoD"
              data={dodData}
              color="var(--chart-orange)"
              valueDecimals={1}
              valueSuffix="% DoD"
            />
          </div>

          <p className="mt-4 text-xs text-ink-2">
            Hot &amp; full exposure counts time at or above {stress.highTempHighSoc.socPct}% SoC with
            an outside temperature of at least {stress.highTempHighSoc.tempC} °C. SoC samples are
            time-weighted in 10-minute buckets with gaps capped at 6 hours.
          </p>
        </>
      )}
    </div>
  );
}
