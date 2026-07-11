import DataUnavailable from "@/components/DataUnavailable";
import StatsCharts from "@/components/charts/StatsCharts";
import {
  getBatteryHealth,
  getMonthlyEfficiency,
  getMonthlyMileage,
  getPrimaryCarIdentity,
  getVampireDrain,
  newCarRatedRangeKm,
  summarizeBatteryHealth,
} from "@/lib/db/stats";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const carRes = await safe(getPrimaryCarIdentity());
  if (!carRes.ok) return <DataUnavailable service="database" detail={carRes.error} />;
  const car = carRes.data;
  if (!car) {
    return <DataUnavailable service="database" detail="No cars found. Sign in to TeslaMate first." />;
  }

  const res = await safe(
    Promise.all([
      getMonthlyMileage(car.id),
      getMonthlyEfficiency(car.id),
      getBatteryHealth(car.id),
      getVampireDrain(car.id),
      getSettings(),
    ]),
  );
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [mileage, efficiency, health, drain, settings] = res.data;
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

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">Stats</h1>
      <StatsCharts
        unit={settings.unitOfLength}
        mileage={mileage}
        efficiency={efficiency}
        health={health}
        drain={drain}
        healthSummary={healthSummary}
      />
    </div>
  );
}
