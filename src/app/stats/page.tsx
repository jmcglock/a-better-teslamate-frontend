import Link from "next/link";
import DataUnavailable from "@/components/DataUnavailable";
import StatsCharts from "@/components/charts/StatsCharts";
import {
  getBatteryHealth,
  getCarIdentity,
  getMonthlyChargeCost,
  getMonthlyEfficiency,
  getMonthlyMileage,
  getPrimaryCarIdentity,
  getVampireDrain,
  listCarIdentities,
  newCarRatedRangeKm,
  summarizeBatteryHealth,
} from "@/lib/db/stats";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ car?: string }>;
}) {
  const sp = await searchParams;
  const requestedId = sp.car ? Number(sp.car) : null;

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
      getMonthlyMileage(car.id),
      getMonthlyEfficiency(car.id),
      getBatteryHealth(car.id),
      getVampireDrain(car.id),
      getMonthlyChargeCost(car.id),
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
        {cars.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {cars.map((c) => {
              const active = c.id === car.id;
              return (
                <Link
                  key={c.id}
                  href={`/stats?car=${c.id}`}
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
