import CarCard from "@/components/CarCard";
import DataUnavailable from "@/components/DataUnavailable";
import { listCarCards } from "@/lib/db/cars";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const res = await safe(Promise.all([listCarCards(), getSettings()]));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [cars, settings] = res.data;

  if (cars.length === 0) {
    return <DataUnavailable service="database" detail="No cars found. Sign in to TeslaMate first." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink-2">Vehicle status</p>
          <h1 className="mt-1 font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight sm:text-3xl">
            Live dashboard
          </h1>
        </div>
        <p className="hidden text-xs text-ink-2 sm:block">Read-only · TeslaMate companion</p>
      </div>
      <div className="grid gap-6">
        {cars.map((car) => (
          <CarCard key={car.id} initial={car} settings={settings} />
        ))}
      </div>
    </div>
  );
}
