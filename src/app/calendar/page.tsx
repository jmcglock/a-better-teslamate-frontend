import DataUnavailable from "@/components/DataUnavailable";
import FilterPills from "@/components/FilterPills";
import { calendarLevel, calendarWeeks, parseCalendarMetric, CALENDAR_METRICS } from "@/lib/calendar";
import { getChargeDays, getDriveDays, statsRangeMonths } from "@/lib/db/stats";
import { listCarIdentities } from "@/lib/db/stats";
import { safe } from "@/lib/db/pool";
import { localToday } from "@/lib/db/localTz";
import { historyHref } from "@/lib/db/range";
import { STATS_RANGES, parseStatsRange, statsRangeLabel } from "@/lib/db/stats";
import { formatEnergy } from "@/lib/format";

export const dynamic = "force-dynamic";

const DRIVE_SHADES = ["var(--line)", "#1e3a5f", "#2563eb", "#60a5fa", "#93c5fd"];
const CHARGE_SHADES = ["var(--line)", "#064e3b", "#0a9d52", "#12c96a", "#6ee7a8"];

type CalendarDay = { date: string; count: number; energyKwh: number | null };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ car?: string; range?: string; metric?: string }>;
}) {
  const sp = await searchParams;
  const requestedId = sp.car ? Number(sp.car) : null;
  const range = parseStatsRange(sp.range);
  const metric = parseCalendarMetric(sp.metric);

  const carsRes = await safe(listCarIdentities());
  if (!carsRes.ok) return <DataUnavailable service="database" detail={carsRes.error} />;
  const cars = carsRes.data;
  if (cars.length === 0) return <DataUnavailable service="database" detail="No cars found." />;

  let car = cars[0];
  if (requestedId !== null && Number.isInteger(requestedId)) {
    const found = cars.find((c) => c.id === requestedId);
    if (found) car = found;
  }

  const daysPromise: Promise<CalendarDay[]> =
    metric === "charges"
      ? getChargeDays(car.id, range)
      : getDriveDays(car.id, range).then((rows) =>
          rows.map((row) => ({ date: row.date, count: row.count, energyKwh: null })),
        );
  const res = await safe(daysPromise);
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const days = res.data;
  const max = days.reduce((m, d) => Math.max(m, d.count), 1);
  const carForLinks = cars.length > 1 ? car.id : null;

  // Build a set for quick lookup.
  const byDate = new Map(days.map((d) => [d.date, d]));

  // Generate all days in range (last N months) for the grid.
  const months = statsRangeMonths(range);
  // Grid matches the SQL window: whole local calendar months up to local today.
  const end = localToday();
  let start: Date;
  if (months === null) {
    const earliest = days.length ? days[0].date : null;
    start = earliest
      ? new Date(earliest + "T00:00:00Z")
      : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 36, 1));
  } else {
    start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (months - 1), 1));
  }
  const weeks = calendarWeeks(start, end);

  const shades = metric === "drives" ? DRIVE_SHADES : CHARGE_SHADES;
  const color = (count: number) => shades[calendarLevel(count, max)];

  const totalSessions = days.reduce((s, d) => s + d.count, 0);
  const totalEnergy = days.reduce((s, d) => s + (d.energyKwh ?? 0), 0);
  const metricForLinks = metric === "drives" ? undefined : metric;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">
          {metric === "drives" ? "Drive calendar" : "Charging calendar"}
        </h1>
        <div className="flex flex-wrap items-center gap-4">
          {cars.length > 1 && (
            <FilterPills
              options={cars.map((c) => ({ key: String(c.id), label: c.name }))}
              active={String(car.id)}
              hrefFor={(id) => historyHref("/calendar", { defaultRange: "12m", car: Number(id), range, metric: metricForLinks })}
            />
          )}
          <FilterPills
            options={CALENDAR_METRICS}
            active={metric}
            hrefFor={(key) =>
              historyHref("/calendar", {
                car: carForLinks,
                range,
                metric: key === "drives" ? undefined : key,
              })
            }
          />
          <FilterPills
            options={STATS_RANGES}
            active={range}
            hrefFor={(key) => historyHref("/calendar", { defaultRange: "12m", car: carForLinks, range: key, metric: metricForLinks })}
          />
        </div>
      </div>
      {cars.length === 1 && (
        <p className="mb-3 text-sm text-ink-2">
          {car.name} · {statsRangeLabel(range)} · {totalSessions}{" "}
          {metric === "drives" ? (totalSessions === 1 ? "drive" : "drives") : totalSessions === 1 ? "session" : "sessions"}
          {metric === "charges" ? ` · ${formatEnergy(totalEnergy)}` : ""}
        </p>
      )}
      <div className="overflow-x-auto">
        <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks.length}, 12px)` }}>
          {weeks.map((w, wi) => (
            <div key={wi} className="grid gap-[3px]" style={{ gridTemplateRows: "repeat(7, 12px)" }}>
              {Array.from({ length: 7 }).map((_, di) => {
                const date = w.find((d) => new Date(d + "T00:00:00Z").getUTCDay() === di);
                if (!date) return <div key={di} className="h-3 w-3" />;
                const info = byDate.get(date);
                const count = info?.count ?? 0;
                const detail =
                  info?.energyKwh != null && count > 0 ? ` · ${formatEnergy(info.energyKwh)}` : "";
                const noun = metric === "drives" ? "drive" : "charge";
                return (
                  <div
                    key={di}
                    title={`${date}: ${count} ${noun}${count === 1 ? "" : "s"}${detail}`}
                    className="h-3 w-3 rounded-sm"
                    style={{ background: color(count) }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
