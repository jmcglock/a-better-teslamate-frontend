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
    <div className="grid gap-6 md:grid-cols-2">
      {cars.map((car) => (
        <CarCard key={car.id} initial={car} settings={settings} />
      ))}
    </div>
  );
}
