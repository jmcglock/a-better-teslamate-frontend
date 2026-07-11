"use client";

import BarPanel from "./BarPanel";
import TimeSeriesPanel from "./TimeSeriesPanel";
import { useChartColors } from "./useChartColors";
import { kmToUnit, type LengthUnit } from "@/lib/format";

export default function StatsCharts({
  unit, mileage, efficiency, health, drain,
}: {
  unit: LengthUnit;
  mileage: { label: string; v: number }[];
  efficiency: { label: string; v: number }[];
  health: { t: number; v: number | null }[];
  drain: { label: string; v: number }[];
}) {
  const c = useChartColors();
  const distUnit = unit === "mi" ? "mi" : "km";
  const effUnit = unit === "mi" ? "Wh/mi" : "Wh/km";
  const toUnit = (km: number) => Math.round(kmToUnit(km, unit));

  return (
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
        title="Projected range at 100%" unit={distUnit} color={c.green}
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
  );
}
