"use client";

import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useChartColors } from "./useChartColors";

type Point = { t: number; v: number | null };

function fmtTime(t: number): string {
  return new Date(t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function TimeSeriesPanel({
  title, unit, data, color, syncId, yDomain, formatValue, formatTick,
}: {
  title: string; unit: string; data: Point[]; color: string;
  syncId?: string; yDomain?: [number, number];
  formatValue?: (v: number) => string; formatTick?: (t: number) => string;
}) {
  const c = useChartColors();
  const fmt = formatValue ?? ((v: number) => `${Math.round(v)} ${unit}`);
  const tick = formatTick ?? fmtTime;
  return (
    <figure className="rounded-lg border border-line bg-panel p-4">
      <figcaption className="mb-2 text-sm font-medium">
        {title} <span className="text-xs text-ink-2">({unit})</span>
      </figcaption>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} syncId={syncId} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={c.line} vertical={false} />
          <XAxis
            dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time"
            tickFormatter={tick} tick={{ fill: c.ink2, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.line }}
          />
          <YAxis
            domain={yDomain ?? ["auto", "auto"]} tick={{ fill: c.ink2, fontSize: 11 }}
            tickLine={false} axisLine={false} width={46}
          />
          <Tooltip
            labelFormatter={(t) => tick(Number(t))}
            formatter={(v) => [fmt(Number(v)), title]}
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--ink)" }}
          />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
