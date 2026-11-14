import DataUnavailable from "@/components/DataUnavailable";
import EmptyState from "@/components/EmptyState";
import FilterPills from "@/components/FilterPills";
import BarPanel from "@/components/charts/BarPanel";
import { getUsageInsights } from "@/lib/db/usage";
import {
  STATS_RANGES,
  listCarIdentities,
  parseStatsRange,
  statsRangeLabel,
  statsRangeMonths,
} from "@/lib/db/stats";
import { historyHref, parseCarId } from "@/lib/db/range";
import { safe } from "@/lib/db/pool";
import { formatDuration, formatPct } from "@/lib/format";
import type { UsageState } from "@/lib/usage";

export const dynamic = "force-dynamic";

const STATE_META: Record<UsageState, { label: string; color: string }> = {
  driving: { label: "Driving", color: "var(--state-driving)" },
  charging: { label: "Charging", color: "var(--state-charging)" },
  asleep: { label: "Asleep", color: "var(--state-idle)" },
  online: {
    label: "Online",
    color: "color-mix(in oklab, var(--state-driving) 55%, var(--state-idle))",
  },
  offline: { label: "Offline", color: "var(--state-sentry)" },
  updating: { label: "Updating", color: "var(--state-updating)" },
};

const hoursLabel = (hours: number) => formatDuration(hours * 60);

export default async function UsagePage({
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

  const res = await safe(getUsageInsights(car.id, months));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const insights = res.data;

  const allocation = insights.allocation.filter((a) => a.seconds > 0);
  const asleep = insights.allocation.find((a) => a.state === "asleep");
  const driving = insights.allocation.find((a) => a.state === "driving");
  const carForLinks = cars.length > 1 ? car.id : null;

  const asleepData = insights.monthly.map((m) => ({ label: m.label, v: m.asleepHours }));
  const wakeupData = insights.monthly.map((m) => ({
    label: m.label,
    v: m.wakeupsPerDay ?? 0,
  }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">
            Usage &amp; sleep
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Where the car spends its time, how often it wakes, and how long it sleeps.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {cars.length > 1 && (
            <FilterPills
              options={cars.map((c) => ({ key: String(c.id), label: c.name }))}
              active={String(car.id)}
              hrefFor={(id) =>
                historyHref("/usage", { car: Number(id), range, defaultRange: "12m" })
              }
            />
          )}
          <FilterPills
            options={STATS_RANGES}
            active={range}
            hrefFor={(key) =>
              historyHref("/usage", { car: carForLinks, range: key, defaultRange: "12m" })
            }
          />
        </div>
      </div>

      {insights.totalHours <= 0 ? (
        <EmptyState
          title="No state history"
          detail="TeslaMate will log asleep, online, driving, and charging states here."
          icon="◷"
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-2">
            {car.name} · {statsRangeLabel(range)} · {insights.days.toFixed(0)} days logged
          </p>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Asleep</div>
              <div className="text-lg font-semibold">{hoursLabel(asleep?.hours ?? 0)}</div>
              <div className="text-xs text-ink-2">{formatPct(asleep?.pct ?? 0)} of logged time</div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Driving</div>
              <div className="text-lg font-semibold">{hoursLabel(driving?.hours ?? 0)}</div>
              <div className="text-xs text-ink-2">{formatPct(driving?.pct ?? 0)} of logged time</div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Awake, not driving</div>
              <div className="text-lg font-semibold">{hoursLabel(insights.awakeNotDrivingHours)}</div>
              <div className="text-xs text-ink-2">
                {insights.awakeNotDrivingPct === null
                  ? "no awake time"
                  : `${formatPct(insights.awakeNotDrivingPct)} of awake time`}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Wakeups / day</div>
              <div className="text-lg font-semibold">
                {insights.wakeupsPerDay === null ? "—" : insights.wakeupsPerDay.toFixed(2)}
              </div>
              <div className="text-xs text-ink-2">{insights.wakeups} wakeups total</div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Longest sleep</div>
              <div className="text-lg font-semibold">
                {insights.longestSleepHours === null ? "—" : hoursLabel(insights.longestSleepHours)}
              </div>
              <div className="text-xs text-ink-2">
                {insights.longestSleepStart
                  ? new Date(insights.longestSleepStart).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hourCycle: "h23",
                    })
                  : "no sleep recorded"}
              </div>
            </div>
          </div>

          <section className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-2">
              State-time allocation
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
              {allocation.map((entry) => {
                const meta = STATE_META[entry.state];
                return (
                  <li key={entry.state} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span
                          aria-hidden
                          className="h-2 w-2 rounded-full"
                          style={{ background: meta.color }}
                        />
                        {meta.label}
                      </span>
                      <span className="text-ink-2">{hoursLabel(entry.hours)}</span>
                      <span className="w-12 text-right font-semibold">{formatPct(entry.pct)}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(0, Math.min(100, entry.pct))}%`, background: meta.color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BarPanel
              title="Monthly asleep time"
              unit="h"
              data={asleepData}
              color="var(--state-idle)"
              valueMode="hours"
              valueSuffix=""
            />
            <BarPanel
              title="Monthly wakeups per day"
              unit="/day"
              data={wakeupData}
              color="var(--state-sentry)"
              valueDecimals={2}
              valueSuffix=""
            />
          </div>
        </>
      )}
    </div>
  );
}
