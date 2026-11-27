import DataUnavailable from "@/components/DataUnavailable";
import { getBatteryHealth, getEfficiencyByTemp, listCarIdentities, newCarRatedRangeKm, summarizeBatteryHealth } from "@/lib/db/stats";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";
import { parseCarId } from "@/lib/db/range";
import { formatDistance, formatEfficiency, formatEnergy, formatTemp } from "@/lib/format";
import { DEFAULT_RESERVE_PCT, parseBounded, planTrip, toCelsius, toKm } from "@/lib/tripPlanner";

export const dynamic = "force-dynamic";

type Search = { car?: string; d?: string; t?: string; soc?: string; reserve?: string; kwh?: string };

const field = "w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
const card = "rounded-2xl border border-line bg-panel px-4 py-3";

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "bad" }) {
  return (
    <div className={card}>
      <div className="text-xs uppercase tracking-wide text-ink-2">{label}</div>
      <div className={`text-lg font-semibold ${tone === "bad" ? "text-[var(--bad)]" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

export default async function PlannerPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;

  const carsRes = await safe(listCarIdentities());
  if (!carsRes.ok) return <DataUnavailable service="database" detail={carsRes.error} />;
  const cars = carsRes.data;
  if (cars.length === 0) return <DataUnavailable service="database" detail="No cars found." />;
  const carId = parseCarId(sp.car, cars.map((c) => c.id));
  const car = cars.find((c) => c.id === carId) ?? cars[0];

  const res = await safe(Promise.all([getEfficiencyByTemp(car.id, "all"), getBatteryHealth(car.id, "all"), getSettings()]));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [series, health, settings] = res.data;
  const lengthUnit = settings.unitOfLength;
  const tempUnit = settings.unitOfTemperature;

  const summary = summarizeBatteryHealth(health, { newKm: newCarRatedRangeKm(car), efficiency: car.efficiency });
  const estimatedKwh = summary.currentKwh ?? summary.newKwh;

  const distance = parseBounded(sp.d, 0.1, 5000);
  const temp = parseBounded(sp.t, -40, tempUnit === "F" ? 122 : 50);
  const startSoc = parseBounded(sp.soc, 1, 100) ?? 80;
  const reserve = parseBounded(sp.reserve, 0, 50) ?? DEFAULT_RESERVE_PCT;
  const kwhOverride = parseBounded(sp.kwh, 10, 200);
  const capacityKwh = kwhOverride ?? estimatedKwh;

  const submitted = sp.d !== undefined || sp.t !== undefined;
  const plan =
    distance !== null && temp !== null && capacityKwh !== null
      ? planTrip(series.points, {
          distanceKm: toKm(distance, lengthUnit),
          tempC: toCelsius(temp, tempUnit),
          startSocPct: startSoc,
          capacityKwh,
          reservePct: reserve,
        })
      : null;

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">Trip range planner</h1>
        <p className="mt-1 text-sm text-ink-2">
          Predict arrival charge from {car.name}&apos;s own efficiency at the trip temperature ({series.driveCount} logged drives).
        </p>
      </div>

      {series.points.length === 0 ? (
        <DataUnavailable service="database" detail="No drives with temperature data yet, so there is nothing to base a prediction on." />
      ) : (
        <>
          <form method="get" className={`${card} mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6`}>
            {cars.length > 1 && (
              <label className="text-xs text-ink-2">
                Car
                <select name="car" defaultValue={String(car.id)} className={`${field} mt-1`}>
                  {cars.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-xs text-ink-2">
              Distance ({lengthUnit})
              <input name="d" type="number" inputMode="decimal" step="any" min="0.1" max="5000" required defaultValue={sp.d ?? ""} className={`${field} mt-1`} />
            </label>
            <label className="text-xs text-ink-2">
              Temperature (°{tempUnit})
              <input name="t" type="number" inputMode="decimal" step="any" required defaultValue={sp.t ?? ""} className={`${field} mt-1`} />
            </label>
            <label className="text-xs text-ink-2">
              Starting SoC (%)
              <input name="soc" type="number" min="1" max="100" step="1" defaultValue={String(startSoc)} className={`${field} mt-1`} />
            </label>
            <label className="text-xs text-ink-2">
              Reserve (%)
              <input name="reserve" type="number" min="0" max="50" step="1" defaultValue={String(reserve)} className={`${field} mt-1`} />
            </label>
            <label className="text-xs text-ink-2">
              Usable pack (kWh)
              <input
                name="kwh"
                type="number"
                min="10"
                max="200"
                step="0.1"
                defaultValue={sp.kwh ?? ""}
                placeholder={estimatedKwh === null ? "required" : estimatedKwh.toFixed(1)}
                required={estimatedKwh === null}
                className={`${field} mt-1`}
              />
            </label>
            <div className="col-span-2 flex items-end sm:col-span-3 lg:col-span-6">
              <button type="submit" className="pressable rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
                Plan trip
              </button>
            </div>
          </form>

          {submitted && !plan && (
            <p className="mb-4 text-sm text-ink-2">Enter a distance, a temperature between -40 and {tempUnit === "F" ? "122 °F" : "50 °C"}, and a usable pack size to get a prediction.</p>
          )}

          {plan && (
            <>
              <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                  label="Arrival SoC"
                  value={`${Math.round(plan.arrivalSocPct)}%`}
                  sub={plan.feasible ? `Above ${plan.reservePct}% reserve` : `Below ${plan.reservePct}% reserve`}
                  tone={plan.feasible ? undefined : "bad"}
                />
                <Stat label="Energy used" value={formatEnergy(plan.energyKwh)} sub={`${Math.round(plan.usedPct)}% of pack`} />
                <Stat
                  label="Range to reserve"
                  value={formatDistance(plan.rangeToReserveKm, lengthUnit, 0)}
                  sub={`From ${startSoc}% at ${formatTemp(toCelsius(temp!, tempUnit), tempUnit)}`}
                />
                <Stat
                  label="Start SoC needed"
                  value={plan.requiredStartSocPct > 100 ? ">100%" : `${Math.ceil(plan.requiredStartSocPct)}%`}
                  sub={plan.requiredStartSocPct > 100 ? "Plan a charging stop" : `To arrive with ${plan.reservePct}%`}
                />
              </div>
              <p className="text-sm text-ink-2">
                Expected efficiency {formatEfficiency(plan.efficiency.whPerKm, lengthUnit)} from{" "}
                {formatDistance(plan.efficiency.sampleKm, lengthUnit, 0)} of driving
                {Number.isFinite(plan.efficiency.windowC) && plan.efficiency.windowC > 0 ? ` within ±${tempUnit === "F" ? Math.round(plan.efficiency.windowC * 1.8) : plan.efficiency.windowC} °${tempUnit}` : ""}
                {Number.isFinite(plan.efficiency.windowC) ? "" : " across all temperatures"}. Pack {formatEnergy(capacityKwh)}
                {kwhOverride === null ? " (estimated from rated range)" : " (entered)"}.
                {plan.efficiency.extrapolated && " This temperature is outside what the car has been driven in, so the nearest logged temperature is used."}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
