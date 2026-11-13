import DataUnavailable from "@/components/DataUnavailable";
import EmptyState from "@/components/EmptyState";
import FilterPills from "@/components/FilterPills";
import { getRecurringRoutes } from "@/lib/db/recurringRoutes";
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
import {
  formatCost,
  formatDistance,
  formatDuration,
  formatEfficiency,
  formatPct,
  type LengthUnit,
} from "@/lib/format";
import type { RouteOutlier, RouteOutlierMetric } from "@/lib/recurringRoutes";

export const dynamic = "force-dynamic";

const METRIC_LABELS: Record<RouteOutlierMetric, string> = {
  distance: "Distance",
  duration: "Duration",
  efficiency: "Efficiency",
  cost: "Cost",
};

function formatMetric(
  metric: RouteOutlierMetric,
  value: number,
  unit: LengthUnit,
  currency: string,
): string {
  switch (metric) {
    case "distance":
      return formatDistance(value, unit);
    case "duration":
      return formatDuration(value);
    case "efficiency":
      return formatEfficiency(value, unit);
    case "cost":
      return formatCost(value, currency);
  }
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function OutlierRow({
  outlier,
  unit,
  currency,
}: {
  outlier: RouteOutlier;
  unit: LengthUnit;
  currency: string;
}) {
  const tone = outlier.direction === "high" ? "var(--state-sentry)" : "var(--state-charging)";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span
        className="rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ color: tone, background: `color-mix(in oklab, ${tone} 18%, transparent)` }}
      >
        {outlier.direction === "high" ? "▲" : "▼"} {outlier.deviationPct}%
      </span>
      <span className="font-medium">{METRIC_LABELS[outlier.metric]}</span>
      <span>{formatMetric(outlier.metric, outlier.value, unit, currency)}</span>
      <span className="text-ink-2">
        vs route median {formatMetric(outlier.metric, outlier.expected, unit, currency)}
      </span>
      <span className="ml-auto text-xs text-ink-2">{shortDate(outlier.startDate)}</span>
    </li>
  );
}

export default async function RecurringRoutesPage({
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

  const range = parseHistoryRange(sp.range);
  const carId = parseCarId(sp.car, cars.map((car) => car.id));
  const car = carId === null ? cars[0] : cars.find((c) => c.id === carId) ?? cars[0];
  const months = historyRangeMonths(range);

  const res = await safe(
    Promise.all([getRecurringRoutes(car.id, months), getSettings()]),
  );
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [routes, settings] = res.data;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">
            Recurring routes
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Repeated start/end pairs, commute candidates, and drives that break the pattern.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {cars.length > 1 && (
            <FilterPills
              options={cars.map((c) => ({ key: String(c.id), label: c.name }))}
              active={String(car.id)}
              hrefFor={(id) => historyHref("/routes", { car: Number(id), range })}
            />
          )}
          <FilterPills
            options={HISTORY_RANGES}
            active={range}
            hrefFor={(key) =>
              historyHref("/routes", { car: cars.length > 1 ? car.id : null, range: key })
            }
          />
        </div>
      </div>

      {routes.summary.routes === 0 ? (
        <EmptyState
          title="No recurring routes yet"
          detail={
            routes.summary.drives > 0
              ? "Routes need at least 3 drives on the same start/end pair. Widen the range or keep driving."
              : "Take a few trips between the same places and they will appear here."
          }
          icon="⇄"
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Recurring routes</div>
              <div className="text-lg font-semibold">{routes.summary.routes}</div>
              <div className="text-xs text-ink-2">
                {routes.summary.matchedDrives} of {routes.summary.drives} drives
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Commute candidates</div>
              <div className="text-lg font-semibold">{routes.summary.commuteRoutes}</div>
              <div className="text-xs text-ink-2">mostly weekday routes</div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Outlier drives</div>
              <div className="text-lg font-semibold">{routes.summary.outlierDrives}</div>
              <div className="text-xs text-ink-2">
                {formatPct(routes.summary.outlierSharePct ?? 0)} of recurring drives
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Cost basis</div>
              <div className="text-lg font-semibold">
                {routes.costRate === null ? "—" : formatCost(routes.costRate, currency)}
              </div>
              <div className="text-xs text-ink-2">
                {routes.costRate === null ? "no priced charging" : "avg charging rate / kWh"}
              </div>
            </div>
          </div>

          <ul className="space-y-4">
            {routes.routes.map((route) => (
              <li key={route.key} className="rounded-2xl border border-line bg-panel px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="min-w-0 flex-1 truncate text-base font-semibold">
                    {route.startLabel} → {route.endLabel}
                  </h2>
                  {route.isCommute && (
                    <span className="rounded-full bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] px-2 py-0.5 text-xs font-medium text-accent">
                      Commute
                    </span>
                  )}
                  <span className="text-sm text-ink-2">{route.count} drives</span>
                  <span className="text-xs text-ink-2">last {shortDate(route.lastDriveAt)}</span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-ink-2">Avg distance</dt>
                    <dd className="font-medium">{formatDistance(route.avgDistanceKm, settings.unitOfLength)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-ink-2">Avg duration</dt>
                    <dd className="font-medium">{formatDuration(route.avgDurationMin)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-ink-2">Avg efficiency</dt>
                    <dd className="font-medium">
                      {formatEfficiency(route.avgEfficiencyWhPerKm, settings.unitOfLength)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-ink-2">Avg cost / drive</dt>
                    <dd className="font-medium">
                      {route.avgCost === null ? "—" : formatCost(route.avgCost, currency)}
                    </dd>
                  </div>
                </dl>

                <p className="mt-2 text-xs text-ink-2">
                  {route.distinctDays} day{route.distinctDays === 1 ? "" : "s"} ·{" "}
                  {formatPct(route.weekdayShare * 100)} weekday ·{" "}
                  {formatDistance(route.totalDistanceKm, settings.unitOfLength)} total
                  {route.totalCost !== null && ` · ${formatCost(route.totalCost, currency)} total`}
                </p>

                <div className="mt-3 border-t border-line pt-3">
                  {route.outliers.length === 0 ? (
                    <p className="text-xs text-ink-2">No outliers — this route is consistent.</p>
                  ) : (
                    <>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-2">
                        Flagged drives ({route.outlierDrives})
                      </p>
                      <ul className="space-y-1.5">
                        {route.outliers.map((outlier) => (
                          <OutlierRow
                            key={`${outlier.driveId}-${outlier.metric}`}
                            outlier={outlier}
                            unit={settings.unitOfLength}
                            currency={currency}
                          />
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs text-ink-2">
            {routes.costRate === null
              ? "Cost comparison needs charging costs. Add them in TeslaMate to estimate route spend."
              : `Drive costs are estimated from energy used at the ${formatCost(routes.costRate, currency)}/kWh average charging rate for this window.`}
          </p>
        </>
      )}
    </div>
  );
}
