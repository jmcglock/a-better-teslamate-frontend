import DataUnavailable from "@/components/DataUnavailable";
import StatsCharts from "@/components/charts/StatsCharts";
import { getBatteryHealth, getMonthlyEfficiency, getMonthlyMileage, getVampireDrain } from "@/lib/db/stats";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const res = await safe(
    Promise.all([getMonthlyMileage(), getMonthlyEfficiency(), getBatteryHealth(), getVampireDrain(), getSettings()]),
  );
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [mileage, efficiency, health, drain, settings] = res.data;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Stats</h1>
      <StatsCharts unit={settings.unitOfLength} mileage={mileage} efficiency={efficiency} health={health} drain={drain} />
    </div>
  );
}
