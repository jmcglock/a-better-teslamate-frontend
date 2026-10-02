import Link from "next/link";
import DataUnavailable from "@/components/DataUnavailable";
import StatsCharts from "@/components/charts/StatsCharts";
import {
  STATS_RANGES,
  getBatteryHealth,
  getCarIdentity,
  getMonthlyChargeCost,
  getMonthlyEfficiency,
  getMonthlyMileage,
  getPrimaryCarIdentity,
  getVampireDrain,
  listCarIdentities,
  newCarRatedRangeKm,
  parseStatsRange,
  summarizeBatteryHealth,
} from "@/lib/db/stats";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ car?: string; range?: string }>;
}) {
  const sp = await searchParams;
  const requestedId = sp.car ? Number(sp.car) : null;
  const range = parseStatsRange(sp.range);

  const carsRes = await safe(listCarIdentities());
  if (!carsRes.ok) return <DataUnavailable service="database" detail={carsRes.error} />;
  const cars = carsRes.data;
  if (cars.length === 0) {
    return <DataUnavailable service="database" detail="No cars found. Sign in to TeslaMate first." />;
  }

  let car =
    requestedId !== null && Number.isInteger(requestedId)
      ? await getCarIdentity(requestedId)
      : null;
  if (!car) car = (await getPrimaryCarIdentity()) ?? cars[0];

  const res = await safe(
    Promise.all([
      getMonthlyMileage(car.id, range),
      getMonthlyEfficiency(car.id, range),
      getBatteryHealth(car.id, range),
      getVampireDrain(car.id),
      getMonthlyChargeCost(car.id, range),
      getSettings(),
    ]),
  );
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [mileage, efficiency, health, drain, chargeCost, settings] = res.data;
  const newKm = newCarRatedRangeKm({
    model: car.model,
    marketingName: car.marketingName,
    trimBadging: car.trimBadging,
    vin: car.vin,
  });
  const healthSummary = summarizeBatteryHealth(health, {
    newKm,
    efficiency: car.efficiency,
  });
  const currency = process.env.CURRENCY ?? "$";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">Stats</h1>
        <div className="flex flex-wrap items-center gap-4">
          {cars.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {cars.map((c) => {
                const active = c.id === car.id;
                return (
                  <Link
                    key={c.id}
                    href={`/stats?car=${c.id}&range=${range}`}
                    className={`rounded-full px-3 py-1 text-sm ${
                      active
                        ? "bg-accent text-white"
                        : "border border-line text-ink-2 hover:text-ink"
                    }`}
                  >
                    {c.name}
                  </Link>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {STATS_RANGES.map((r) => {
              const active = r.key === range;
              return (
                <Link
                  key={r.key}
                  href={`/stats?car=${car.id}&range=${r.key}`}
                  className={`rounded-full px-3 py-1 text-sm ${
                    active
                      ? "bg-accent text-white"
                      : "border border-line text-ink-2 hover:text-ink"
                  }`}
                >
                  {r.key}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      {cars.length === 1 && (
        <p className="mb-3 text-sm text-ink-2">{car.name}</p>
      )}
      <StatsCharts
        unit={settings.unitOfLength}
        mileage={mileage}
        efficiency={efficiency}
        health={health}
        drain={drain}
        chargeCost={chargeCost}
        currency={currency}
        healthSummary={healthSummary}
      />
    </div>
  );
}
