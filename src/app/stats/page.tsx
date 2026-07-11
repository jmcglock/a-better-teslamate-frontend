import DataUnavailable from "@/components/DataUnavailable";
import StatsCharts from "@/components/charts/StatsCharts";
import {
  getBatteryHealth, getMonthlyEfficiency, getMonthlyMileage, getVampireDrain, summarizeBatteryHealth,
} from "@/lib/db/stats";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  // Sequential-ish via single Promise.all but each query reuses the tiny pool (max 2).
  const res = await safe(
    Promise.all([getMonthlyMileage(), getMonthlyEfficiency(), getBatteryHealth(), getVampireDrain(), getSettings()]),
  );
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [mileage, efficiency, health, drain, settings] = res.data;
  const healthSummary = summarizeBatteryHealth(health);

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
