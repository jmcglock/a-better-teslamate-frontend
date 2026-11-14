import DataUnavailable from "@/components/DataUnavailable";
import EmptyState from "@/components/EmptyState";
import FilterPills from "@/components/FilterPills";
import BarPanel from "@/components/charts/BarPanel";
import { buildEnergyBudget } from "@/lib/energyBudget";
import { getEnergyChargeMonths, getEnergyDriveMonths } from "@/lib/db/energyBudget";
import { listCarIdentities } from "@/lib/db/stats";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";
import { HISTORY_RANGES, historyHref, historyRangeMonths, parseCarId, parseHistoryRange } from "@/lib/db/range";
import { formatCost, formatEnergy } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EnergyPage({
  searchParams,
}: {
  searchParams: Promise<{ car?: string; range?: string }>;
}) {
  const sp = await searchParams;
  const currency = process.env.CURRENCY ?? "$";

  const carsRes = await safe(listCarIdentities());
  if (!carsRes.ok) return <DataUnavailable service="database" detail={carsRes.error} />;
  const cars = carsRes.data;
  if (cars.length === 0) return <DataUnavailable service="database" detail="No cars found. Sign in to TeslaMate first." />;

  const range = parseHistoryRange(sp.range);
  const carId = parseCarId(sp.car, cars.map((c) => c.id));
  const car = carId === null ? cars[0] : cars.find((c) => c.id === carId) ?? cars[0];
  const months = historyRangeMonths(range);

  const res = await safe(Promise.all([getEnergyChargeMonths(car.id, months), getEnergyDriveMonths(car.id, months), getSettings()]));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [chargeMonths, driveMonths, settings] = res.data;
  if (!settings) return <DataUnavailable service="database" detail="No settings" />;

  const insights = buildEnergyBudget(chargeMonths, driveMonths, car.efficiency === null ? null : car.efficiency * 1000);
  const hasData = insights.summary.wallKwh > 0;

  const wallData = insights.monthly.map((m) => ({ label: m.label, v: m.wallKwh }));
  const lossData = insights.monthly.map((m) => ({ label: m.label, v: m.chargingLossKwh }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">Energy budget</h1>
          <p className="mt-1 text-sm text-ink-2">Where your charging energy goes: wall, pack, driving, losses, and unaccounted.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {cars.length > 1 && (
            <FilterPills
              options={cars.map((c) => ({ key: String(c.id), label: c.name }))}
              active={String(car.id)}
              hrefFor={(id) => historyHref("/energy", { car: Number(id), range })}
            />
          )}
          <FilterPills
            options={HISTORY_RANGES}
            active={range}
            hrefFor={(key) => historyHref("/energy", { car: cars.length > 1 ? car.id : null, range: key })}
          />
        </div>
      </div>

      {!hasData ? (
        <EmptyState title="No charging sessions" detail="Plug in and TeslaMate will record sessions here." icon="⚡" />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Wall energy</div>
              <div className="text-lg font-semibold">{formatEnergy(insights.summary.wallKwh)}</div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Pack added</div>
              <div className="text-lg font-semibold">{formatEnergy(insights.summary.packKwh)}</div>
              <div className="text-xs text-ink-2">{insights.summary.chargingLossPct === null ? "—" : `${insights.summary.chargingLossPct}%`} charging loss</div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Driving energy</div>
              <div className="text-lg font-semibold">{insights.summary.drivingKwh === null ? "—" : formatEnergy(insights.summary.drivingKwh)}</div>
              <div className="text-xs text-ink-2">rated-range based</div>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-2">Cost / useful kWh</div>
              <div className="text-lg font-semibold">
                {insights.summary.costPerUsefulKwh === null ? "—" : formatCost(insights.summary.costPerUsefulKwh, currency)}
              </div>
              <div className="text-xs text-ink-2">total {formatCost(insights.summary.cost, currency)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BarPanel title="Monthly wall energy" unit="kWh" data={wallData} color="var(--accent)" valueDecimals={0} valueSuffix=" kWh" />
            <BarPanel title="Charging losses" unit="kWh" data={lossData} color="var(--bad)" valueDecimals={1} valueSuffix=" kWh" />
          </div>

          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-2">Monthly balance</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
              {insights.monthly.map((m) => (
                <li key={m.month} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">{m.label}</span>
                  <span>wall {formatEnergy(m.wallKwh)}</span>
                  <span>pack {formatEnergy(m.packKwh)}</span>
                  <span>drive {m.drivingKwh === null ? "—" : formatEnergy(m.drivingKwh)}</span>
                  <span className="text-ink-2">unaccounted {m.unaccountedKwh === null ? "—" : formatEnergy(m.unaccountedKwh)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}