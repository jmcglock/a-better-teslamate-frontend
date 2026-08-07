import { notFound } from "next/navigation";
import DataUnavailable from "@/components/DataUnavailable";
import MiniMap from "@/components/LazyMiniMap";
import ChargeCharts from "@/components/charts/ChargeCharts";
import { getCharge } from "@/lib/db/charges";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";
import {
  formatCost, formatCostPerKwh, formatDistance, formatDuration, formatEnergy, formatPct, formatPower, formatTemp,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ChargePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const res = await safe(Promise.all([getCharge(id), getSettings()]));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [charge, settings] = res.data;
  if (!charge) notFound();

  const currency = process.env.CURRENCY ?? "$";
  const rangeGained =
    charge.startRatedRangeKm !== null && charge.endRatedRangeKm !== null
      ? charge.endRatedRangeKm - charge.startRatedRangeKm
      : null;
  const sessionEff =
    charge.energyUsedKwh !== null && charge.energyAddedKwh !== null && charge.energyUsedKwh > 0
      ? (charge.energyAddedKwh / charge.energyUsedKwh) * 100
      : null;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Charge at {charge.location}</h1>
        <p className="font-[family-name:var(--font-mono)] text-xs text-ink-2">
          {new Date(charge.startDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          {charge.chargeKind ? ` · ${charge.chargeKind}` : ""}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-panel p-4 text-sm sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <div><dt className="text-xs text-ink-2">Added</dt><dd>{formatEnergy(charge.energyAddedKwh)}</dd></div>
        <div><dt className="text-xs text-ink-2">Used (wall)</dt><dd>{formatEnergy(charge.energyUsedKwh)}</dd></div>
        <div>
          <dt className="text-xs text-ink-2">Session efficiency</dt>
          <dd>{sessionEff === null ? "–" : `${Math.round(sessionEff)}%`}</dd>
        </div>
        <div><dt className="text-xs text-ink-2">Cost</dt><dd>{formatCost(charge.cost, currency)}</dd></div>
        <div><dt className="text-xs text-ink-2">$/kWh</dt><dd>{formatCostPerKwh(charge.cost, charge.energyAddedKwh, currency)}</dd></div>
        <div><dt className="text-xs text-ink-2">Duration</dt><dd>{formatDuration(charge.durationMin)}</dd></div>
        <div><dt className="text-xs text-ink-2">Max power</dt><dd>{formatPower(charge.maxPowerKw)}</dd></div>
        <div><dt className="text-xs text-ink-2">Battery</dt><dd>{formatPct(charge.socStart)} → {formatPct(charge.socEnd)}</dd></div>
        <div>
          <dt className="text-xs text-ink-2">Rated range</dt>
          <dd>
            {charge.startRatedRangeKm === null && charge.endRatedRangeKm === null
              ? "–"
              : `${formatDistance(charge.startRatedRangeKm, settings.unitOfLength, 0)} → ${formatDistance(charge.endRatedRangeKm, settings.unitOfLength, 0)}`}
          </dd>
          {rangeGained !== null && (
            <p className="text-[11px] text-ink-2">+{formatDistance(rangeGained, settings.unitOfLength, 1)}</p>
          )}
        </div>
        <div><dt className="text-xs text-ink-2">Outside</dt><dd>{formatTemp(charge.outsideTempAvgC, settings.unitOfTemperature)}</dd></div>
      </dl>

      {charge.latitude !== null && charge.longitude !== null && (
        <div className="h-56 overflow-hidden rounded-lg border border-line">
          <MiniMap latitude={charge.latitude} longitude={charge.longitude} />
        </div>
      )}

      <ChargeCharts
        syncId={`charge-${charge.id}`}
        powerData={charge.points.map((p) => ({ t: p.t, v: p.power }))}
        socData={charge.points.map((p) => ({ t: p.t, v: p.soc }))}
      />
    </div>
  );
}
