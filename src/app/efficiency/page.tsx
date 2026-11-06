import DataUnavailable from "@/components/DataUnavailable";
import FilterPills from "@/components/FilterPills";
import EfficiencyTempChart from "@/components/charts/EfficiencyTempChart";
import { getCarIdentity, getPrimaryCarIdentity, listCarIdentities } from "@/lib/db/stats";
import { getEfficiencyByTemp } from "@/lib/db/stats";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";
import { historyHref } from "@/lib/db/range";
import { STATS_RANGES, parseStatsRange, statsRangeLabel } from "@/lib/db/stats";

export const dynamic = "force-dynamic";

export default async function EfficiencyPage({ searchParams }: { searchParams: Promise<{ car?: string; range?: string }> }) {
  const sp = await searchParams;
  const requestedId = sp.car ? Number(sp.car) : null;
  const range = parseStatsRange(sp.range);

  const carsRes = await safe(listCarIdentities());
  if (!carsRes.ok) return <DataUnavailable service="database" detail={carsRes.error} />;
  const cars = carsRes.data;
  if (cars.length === 0) return <DataUnavailable service="database" detail="No cars found." />;

  let car = requestedId !== null && Number.isInteger(requestedId) ? await getCarIdentity(requestedId) : null;
  if (!car) car = (await getPrimaryCarIdentity()) ?? cars[0];

  const res = await safe(Promise.all([getEfficiencyByTemp(car.id, range), getSettings()]));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [data, settings] = res.data;
  const carForLinks = cars.length > 1 ? car.id : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">Efficiency vs temperature</h1>
        <div className="flex flex-wrap items-center gap-4">
          {cars.length > 1 && (
            <FilterPills options={cars.map((c) => ({ key: String(c.id), label: c.name }))} active={String(car.id)} hrefFor={(id) => historyHref("/efficiency", { car: Number(id), range })} />
          )}
          <FilterPills options={STATS_RANGES} active={range} hrefFor={(key) => historyHref("/efficiency", { car: carForLinks, range: key })} />
        </div>
      </div>
      {cars.length === 1 && <p className="mb-3 text-sm text-ink-2">{car.name} · {statsRangeLabel(range)}</p>}
      {data.length === 0 ? <DataUnavailable service="database" detail="No drives with temperature data in this range." /> : (
        <>
          <p className="mb-3 text-sm text-ink-2">{data.length} drives</p>
          <EfficiencyTempChart data={data} unit={settings.unitOfLength} />
        </>
      )}
    </div>
  );
}
