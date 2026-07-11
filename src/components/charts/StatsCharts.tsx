"use client";

import BarPanel from "./BarPanel";
import TimeSeriesPanel from "./TimeSeriesPanel";
import { useChartColors } from "./useChartColors";
import { formatDistance, kmToUnit, type LengthUnit } from "@/lib/format";

export default function StatsCharts({
  unit, mileage, efficiency, health, drain, healthSummary,
}: {
  unit: LengthUnit;
  mileage: { label: string; v: number }[];
  efficiency: { label: string; v: number }[];
  health: { t: number; v: number | null }[];
  drain: { label: string; v: number }[];
  healthSummary: {
    currentKm: number | null;
    peakKm: number | null;
    newKm: number | null;
    healthPct: number | null;
    degradationPct: number | null;
    currentKwh: number | null;
    newKwh: number | null;
    baseline: "new" | "peak" | null;
  };
}) {
  const c = useChartColors();
  const distUnit = unit === "mi" ? "mi" : "km";
  const effUnit = unit === "mi" ? "Wh/mi" : "Wh/km";
  const toUnit = (km: number) => Math.round(kmToUnit(km, unit));
  const fmtKwh = (v: number | null) => (v === null ? "–" : `${v.toFixed(1)} kWh`);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-panel p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-2">Battery health</p>
          <p className="mt-2 font-[family-name:var(--font-cond)] text-4xl font-semibold tracking-tight">
            {healthSummary.healthPct === null ? "–" : `${Math.round(healthSummary.healthPct)}%`}
          </p>
          <p className="mt-1 text-xs text-ink-2">
            {healthSummary.baseline === "new"
              ? "of new EPA rated range"
              : healthSummary.baseline === "peak"
                ? "of peak observed (new baseline unknown)"
                : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-panel p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-2">Degradation</p>
          <p className="mt-2 font-[family-name:var(--font-cond)] text-4xl font-semibold tracking-tight">
            {healthSummary.degradationPct === null ? "–" : `${Math.round(healthSummary.degradationPct)}%`}
          </p>
          <p className="mt-1 text-xs text-ink-2">
            {fmtKwh(healthSummary.currentKwh)}
            {healthSummary.newKwh !== null ? ` / ${fmtKwh(healthSummary.newKwh)} new` : ""}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-panel p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-2">Current full range</p>
          <p className="mt-2 font-[family-name:var(--font-cond)] text-4xl font-semibold tracking-tight">
            {formatDistance(healthSummary.currentKm, unit, 0)}
          </p>
          <p className="mt-1 text-xs text-ink-2">projected at 100% SoC</p>
        </div>
        <div className="rounded-2xl border border-line bg-panel p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-2">New rated range</p>
          <p className="mt-2 font-[family-name:var(--font-cond)] text-4xl font-semibold tracking-tight">
            {formatDistance(healthSummary.newKm ?? healthSummary.peakKm, unit, 0)}
          </p>
          <p className="mt-1 text-xs text-ink-2">
            {healthSummary.newKm !== null ? "EPA baseline for this config" : "peak observed (fallback)"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarPanel
          title="Distance driven" unit={distUnit} color={c.blue}
          data={mileage.map((m) => ({ label: m.label, v: toUnit(m.v) }))}
        />
        <BarPanel
          title="Consumption" unit={effUnit} color={c.violet}
          data={efficiency.map((m) => ({ label: m.label, v: Math.round(unit === "mi" ? m.v * 1.609344 : m.v) }))}
        />
        <TimeSeriesPanel
          title="Battery health · full-pack range" unit={distUnit} color={c.green}
          data={health.map((h) => ({ t: h.t, v: h.v === null ? null : toUnit(h.v) }))}
          formatValue={(v) => `${Math.round(v)} ${distUnit}`}
          formatTick={(t) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
        />
        <BarPanel
          title="Standby drain" unit="%/day" color={c.orange}
          data={drain.map((d) => ({ label: d.label, v: Number(d.v.toFixed(2)) }))}
          formatValue={(v) => `${v.toFixed(2)} %/day`}
        />
      </div>
    </div>
  );
}
