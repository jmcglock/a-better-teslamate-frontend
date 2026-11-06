import ChargePlaceSpend from "@/components/ChargePlaceSpend";
import DataUnavailable from "@/components/DataUnavailable";
import FilterPills from "@/components/FilterPills";
import StatsCharts from "@/components/charts/StatsCharts";
import { chargeSpendByPlace, summarizePlaceSpend } from "@/lib/db/locations";
import { historyHref } from "@/lib/db/range";
import {
  STATS_RANGES,
  getBatteryHealth,
  getMonthlyChargeCost,
  getMonthlyEfficiency,
  getMonthlyMileage,
  getVampireDrain,
  listCarIdentities,
  newCarRatedRangeKm,
  parseStatsRange,
  statsRangeLabel,
  statsRangeMonths,
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

  const [carsRes, settingsRes] = await Promise.all([safe(listCarIdentities()), safe(getSettings())]);
  if (!carsRes.ok) return <DataUnavailable service="database" detail={carsRes.error} />;
  const cars = carsRes.data;
  if (cars.length === 0) {
    return <DataUnavailable service="database" detail="No cars found. Sign in to TeslaMate first." />;
  }

  let car = cars[0];
  if (requestedId !== null && Number.isInteger(requestedId)) {
    const found = cars.find((c) => c.id === requestedId);
    if (found) car = found;
  }

  const res = await safe(
    Promise.all([
      getMonthlyMileage(car.id, range),
      getMonthlyEfficiency(car.id, range),
      getBatteryHealth(car.id, range),
      getBatteryHealth(car.id, "all"),
      getVampireDrain(car.id),
      getMonthlyChargeCost(car.id, range),
      chargeSpendByPlace(car.id, statsRangeMonths(range)),
    ]),
  );
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [mileage, efficiency, health, healthAll, drain, chargeCost, places] = res.data;
  const settings = settingsRes.ok ? settingsRes.data : null;
  if (!settings) return <DataUnavailable service="database" detail={settingsRes.ok ? "No settings" : settingsRes.error} />;
  const newKm = newCarRatedRangeKm({
    model: car.model,
    marketingName: car.marketingName,
    trimBadging: car.trimBadging,
    vin: car.vin,
  });
  const healthSummary = summarizeBatteryHealth(healthAll, {
    newKm,
    efficiency: car.efficiency,
  });
  const currency = process.env.CURRENCY ?? "$";
  const carForLinks = cars.length > 1 ? car.id : null;
  const exportRange = range === "12m" ? "12m" : "all";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">Stats</h1>
          <a
            href={historyHref("/api/export/all", { car: carForLinks, range: exportRange })}
            className="pressable rounded-full border border-line px-3 py-1 text-sm text-ink-2 hover:text-ink"
          >
            Export all
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {cars.length > 1 && (
            <FilterPills
              options={cars.map((c) => ({ key: String(c.id), label: c.name }))}
              active={String(car.id)}
              hrefFor={(id) => historyHref("/stats", { car: Number(id), range, defaultRange: "12m" })}
            />
          )}
          <FilterPills
            options={STATS_RANGES}
            active={range}
            hrefFor={(key) => historyHref("/stats", { car: carForLinks, range: key, defaultRange: "12m" })}
          />
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
        spendLabel={statsRangeLabel(range).toLowerCase()}
        drainNote={range === "36m" || range === "all"}
      />
      <ChargePlaceSpend rollup={summarizePlaceSpend(places)} currency={currency} />
    </div>
  );
}
