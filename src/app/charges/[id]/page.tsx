import { notFound } from "next/navigation";
import DataUnavailable from "@/components/DataUnavailable";
import ChargeCharts from "@/components/charts/ChargeCharts";
import { getCharge } from "@/lib/db/charges";
import { safe } from "@/lib/db/pool";
import { formatCost, formatDuration, formatEnergy, formatPct, formatPower } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ChargePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const res = await safe(getCharge(id));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const charge = res.data;
  if (!charge) notFound();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Charge at {charge.location}</h1>
        <p className="font-[family-name:var(--font-mono)] text-xs text-ink-2">
          {new Date(charge.startDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-panel p-4 text-sm sm:grid-cols-5">
        <div><dt className="text-xs text-ink-2">Added</dt><dd>{formatEnergy(charge.energyAddedKwh)}</dd></div>
        <div><dt className="text-xs text-ink-2">Cost</dt><dd>{formatCost(charge.cost, process.env.CURRENCY ?? "$")}</dd></div>
        <div><dt className="text-xs text-ink-2">Duration</dt><dd>{formatDuration(charge.durationMin)}</dd></div>
        <div><dt className="text-xs text-ink-2">Max power</dt><dd>{formatPower(charge.maxPowerKw)}</dd></div>
        <div><dt className="text-xs text-ink-2">Battery</dt><dd>{formatPct(charge.socStart)} → {formatPct(charge.socEnd)}</dd></div>
      </dl>

      <ChargeCharts
        syncId={`charge-${charge.id}`}
        powerData={charge.points.map((p) => ({ t: p.t, v: p.power }))}
        socData={charge.points.map((p) => ({ t: p.t, v: p.soc }))}
      />
    </div>
  );
}
