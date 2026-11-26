import BatteryHealthChart from "@/components/charts/BatteryHealthChart";
import DataUnavailable from "@/components/DataUnavailable";
import FilterPills from "@/components/FilterPills";
import { DEFAULT_FORECAST_TARGET, FORECAST_TARGETS, parseForecastTarget, type BatteryForecast } from "@/lib/batteryForecast";
import { batteryForecastFor, getBatteryHealth, listCarIdentities, newCarRatedRangeKm, summarizeBatteryHealth } from "@/lib/db/stats";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";
import { historyHref } from "@/lib/db/range";
import { kmToUnit } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BatteryPage({
  searchParams,
}: {
  searchParams: Promise<{ car?: string; target?: string }>;
}) {
  const sp = await searchParams;
  const requestedId = sp.car ? Number(sp.car) : null;
  const targetPct = parseForecastTarget(sp.target);

  const [carsRes, settingsRes] = await Promise.all([safe(listCarIdentities()), safe(getSettings())]);
  if (!carsRes.ok) return <DataUnavailable service="database" detail={carsRes.error} />;
  const cars = carsRes.data;
  if (cars.length === 0) return <DataUnavailable service="database" detail="No cars found." />;

  let car = cars[0];
  if (requestedId !== null && Number.isInteger(requestedId)) {
    const found = cars.find((c) => c.id === requestedId);
    if (found) car = found;
  }
  const unit = settingsRes.ok ? settingsRes.data.unitOfLength : "km";
  const distUnit = unit === "mi" ? "mi" : "km";
  const toDist = (km: number | null) => (km === null ? null : Math.round(kmToUnit(km, unit === "mi" ? "mi" : "km")));
  const toDistExact = (km: number) => kmToUnit(km, distUnit);

  // All cars' summaries for the comparison table.
  const summaries = await Promise.all(
    cars.map(async (c) => {
      const healthRes = await safe(getBatteryHealth(c.id, "all"));
      const series = healthRes.ok ? healthRes.data : [];
      const newKm = newCarRatedRangeKm({ model: c.model, marketingName: c.marketingName, trimBadging: c.trimBadging, vin: c.vin });
      const summary = summarizeBatteryHealth(series, { newKm, efficiency: c.efficiency });
      return { car: c, summary };
    }),
  );

  const trendRes = await safe(getBatteryHealth(car.id, "all"));
  const trend = trendRes.ok ? trendRes.data : [];
  const newKm = newCarRatedRangeKm({ model: car.model, marketingName: car.marketingName, trimBadging: car.trimBadging, vin: car.vin });
  const summary = summarizeBatteryHealth(trend, { newKm, efficiency: car.efficiency });
  const forecast = batteryForecastFor(trend, summary, targetPct, Date.now());

  const carForLinks = cars.length > 1 ? car.id : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">Battery health</h1>
        {cars.length > 1 && (
          <FilterPills
            options={cars.map((c) => ({ key: String(c.id), label: c.name }))}
            active={String(car.id)}
            hrefFor={(id) => forecastHref(Number(id), targetPct)}
          />
        )}
      </div>
      {cars.length === 1 && <p className="mb-3 text-sm text-ink-2">{car.name}</p>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Current full range" value={summary.currentKm === null ? "–" : `${Math.round(toDist(summary.currentKm) ?? 0)} ${distUnit}`} />
        <Stat label="Peak observed" value={summary.peakKm === null ? "–" : `${Math.round(toDist(summary.peakKm) ?? 0)} ${distUnit}`} />
        <Stat label="New-car baseline" value={summary.newKm === null ? "–" : `${Math.round(toDist(summary.newKm) ?? 0)} ${distUnit}`} />
        <Stat label="Health" value={summary.healthPct === null ? "–" : `${Math.round(summary.healthPct)}%`} sub={summary.degradationPct === null ? undefined : `${Math.round(summary.degradationPct)}% degradation`} />
      </div>

      <BatteryHealthChart
        title="Rated range · full-pack"
        unit={distUnit}
        color="#22c55e"
        data={trend.map((h) => ({ t: h.t, v: h.v === null ? null : toDist(h.v) }))}
        forecast={forecast.band.length > 0 && forecast.targetKm !== null ? {
          band: forecast.band.map((b) => ({ t: b.t, fit: toDistExact(b.fit), lo: toDistExact(b.lo), hi: toDistExact(b.hi) })),
          target: toDistExact(forecast.targetKm),
          targetLabel: `${forecast.targetPct}% target`,
          projectedAt: forecast.projectedAt,
        } : null}
      />

      <section className="mt-6 rounded-lg border border-line bg-panel p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-cond)] text-lg font-semibold tracking-tight">Capacity forecast</h2>
          <FilterPills
            options={FORECAST_TARGETS.map((p) => ({ key: String(p), label: `${p}%` }))}
            active={String(targetPct)}
            hrefFor={(p) => forecastHref(carForLinks, Number(p))}
          />
        </div>
        <ForecastSummary forecast={forecast} distUnit={distUnit} toDist={toDistExact} />
      </section>

      {cars.length > 1 && (
        <div className="mt-6">
          <h2 className="mb-2 font-[family-name:var(--font-cond)] text-lg font-semibold tracking-tight">All cars</h2>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-panel-2 text-ink-2">
                <tr>
                  <th className="px-3 py-2 text-left">Car</th>
                  <th className="px-3 py-2 text-right">Current</th>
                  <th className="px-3 py-2 text-right">Peak</th>
                  <th className="px-3 py-2 text-right">New</th>
                  <th className="px-3 py-2 text-right">Health</th>
                  <th className="px-3 py-2 text-right">Degradation</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map(({ car: c, summary: s }) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-3 py-2">{c.name}</td>
                    <td className="px-3 py-2 text-right font-mono">{s.currentKm === null ? "–" : Math.round(toDist(s.currentKm) ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-mono">{s.peakKm === null ? "–" : Math.round(toDist(s.peakKm) ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-mono">{s.newKm === null ? "–" : Math.round(toDist(s.newKm) ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-mono">{s.healthPct === null ? "–" : `${Math.round(s.healthPct)}%`}</td>
                    <td className="px-3 py-2 text-right font-mono">{s.degradationPct === null ? "–" : `${Math.round(s.degradationPct)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function forecastHref(car: number | null, targetPct: number): string {
  const base = historyHref("/battery", { car });
  if (targetPct === DEFAULT_FORECAST_TARGET) return base;
  return `${base}${base.includes("?") ? "&" : "?"}target=${targetPct}`;
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "numeric" });

function ForecastSummary({
  forecast: f, distUnit, toDist,
}: {
  forecast: BatteryForecast; distUnit: string; toDist: (km: number) => number;
}) {
  const target = f.targetKm === null ? null : `${Math.round(toDist(f.targetKm))} ${distUnit}`;
  const baseline = f.baselineKm === null ? "" : ` of ${Math.round(toDist(f.baselineKm))} ${distUnit}`;
  const rate = f.slopeKmPerYear === null || f.slopePctPerYear === null ? null
    : `${f.slopeKmPerYear < 0 ? "−" : "+"}${Math.abs(toDist(f.slopeKmPerYear)).toFixed(1)} ${distUnit}/yr (${Math.abs(f.slopePctPerYear).toFixed(1)}%/yr)`;

  let headline: string;
  let detail: string | null = null;
  switch (f.status) {
    case "insufficient-data":
      headline = "Not enough data yet";
      detail = "A forecast needs at least 4 months of full-pack range samples spanning 3+ months. Keep charging to 50%+ and check back.";
      break;
    case "already-below":
      headline = `Capacity is already at or below ${f.targetPct}%`;
      detail = target ? `The trend is below the ${target} target${baseline}. Pick a lower target to forecast further.` : null;
      break;
    case "not-declining":
      headline = "No measurable decline";
      detail = "The fitted trend is flat or rising, so there is no projected date. That's good news.";
      break;
    case "beyond-horizon":
      headline = `Not projected to reach ${f.targetPct}% within 25 years`;
      detail = f.earliestAt ? `Earliest plausible: ${fmtDate(f.earliestAt)}.` : null;
      break;
    case "ok":
      headline = `Projected to reach ${f.targetPct}% around ${fmtDate(f.projectedAt!)}`;
      detail = `95% range: ${f.earliestAt ? fmtDate(f.earliestAt) : "now"} – ${f.latestAt ? fmtDate(f.latestAt) : "beyond 25 years"}.`;
      break;
  }

  return (
    <div>
      <p className="font-[family-name:var(--font-cond)] text-xl font-semibold">{headline}</p>
      {detail && <p className="mt-1 text-sm text-ink-2">{detail}</p>}
      {f.status !== "insufficient-data" && (
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
          <ForecastStat label="Target" value={target ? `${target}${baseline}` : "–"} />
          <ForecastStat label="Trend" value={rate ?? "–"} />
          <ForecastStat label="Fit (R²)" value={f.r2 === null ? "–" : f.r2.toFixed(2)} />
          <ForecastStat label="Samples" value={`${f.points} months`} />
        </dl>
      )}
      <p className="mt-3 text-xs text-ink-2">
        Linear trend of monthly peak full-pack rated range. Degradation usually slows over time, so long projections tend to be conservative.
      </p>
    </div>
  );
}

function ForecastStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.16em] text-ink-2">{label}</dt>
      <dd className="mt-0.5 font-mono">{value}</dd>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-ink-2">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-cond)] text-2xl font-semibold">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-ink-2">{sub}</p> : null}
    </div>
  );
}
