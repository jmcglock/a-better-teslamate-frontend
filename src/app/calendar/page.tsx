import DataUnavailable from "@/components/DataUnavailable";
import FilterPills from "@/components/FilterPills";
import { getCarIdentity, getPrimaryCarIdentity, listCarIdentities } from "@/lib/db/stats";
import { getDriveDays } from "@/lib/db/stats";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";
import { historyHref } from "@/lib/db/range";
import { STATS_RANGES, parseStatsRange, statsRangeLabel } from "@/lib/db/stats";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ car?: string; range?: string }> }) {
  const sp = await searchParams;
  const requestedId = sp.car ? Number(sp.car) : null;
  const range = parseStatsRange(sp.range);

  const carsRes = await safe(listCarIdentities());
  if (!carsRes.ok) return <DataUnavailable service="database" detail={carsRes.error} />;
  const cars = carsRes.data;
  if (cars.length === 0) return <DataUnavailable service="database" detail="No cars found." />;

  let car = requestedId !== null && Number.isInteger(requestedId) ? await getCarIdentity(requestedId) : null;
  if (!car) car = (await getPrimaryCarIdentity()) ?? cars[0];

  const res = await safe(getDriveDays(car.id, range));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const days = res.data;
  const max = days.reduce((m, d) => Math.max(m, d.count), 1);
  const carForLinks = cars.length > 1 ? car.id : null;

  // Build a set for quick lookup.
  const byDate = new Map(days.map((d) => [d.date, d]));

  // Generate all days in range (last N months) for the grid.
  const months = range === "all" ? 12 : range === "36m" ? 36 : 12;
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  const allDays: string[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    allDays.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  // Group into weeks (Sun-Sat).
  const weeks: string[][] = [];
  let week: string[] = [];
  for (const d of allDays) {
    const dow = new Date(d + "T00:00:00").getDay();
    if (dow === 0 && week.length) { weeks.push(week); week = []; }
    week.push(d);
  }
  if (week.length) weeks.push(week);

  const color = (count: number) => {
    if (count === 0) return "var(--line)";
    const t = count / max;
    if (t < 0.25) return "#1e3a5f";
    if (t < 0.5) return "#2563eb";
    if (t < 0.75) return "#60a5fa";
    return "#93c5fd";
  };

  const totalDrives = days.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">Drive calendar</h1>
        <div className="flex flex-wrap items-center gap-4">
          {cars.length > 1 && (
            <FilterPills options={cars.map((c) => ({ key: String(c.id), label: c.name }))} active={String(car.id)} hrefFor={(id) => historyHref("/calendar", { car: Number(id), range })} />
          )}
          <FilterPills options={STATS_RANGES} active={range} hrefFor={(key) => historyHref("/calendar", { car: carForLinks, range: key })} />
        </div>
      </div>
      {cars.length === 1 && <p className="mb-3 text-sm text-ink-2">{car.name} · {statsRangeLabel(range)} · {totalDrives} drives</p>}
      <div className="overflow-x-auto">
        <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks.length}, 12px)` }}>
          {weeks.map((w, wi) => (
            <div key={wi} className="grid gap-[3px]" style={{ gridTemplateRows: "repeat(7, 12px)" }}>
              {Array.from({ length: 7 }).map((_, di) => {
                const date = w.find((d) => new Date(d + "T00:00:00").getDay() === di);
                if (!date) return <div key={di} className="h-3 w-3" />;
                const info = byDate.get(date);
                const count = info?.count ?? 0;
                return (
                  <div
                    key={di}
                    title={`${date}: ${count} drive${count === 1 ? "" : "s"}${info ? ` · ${info.distanceKm} km` : ""}`}
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
