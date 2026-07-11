"use client";

import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useChartColors } from "./useChartColors";

export default function BarPanel({
  title, unit, data, color, formatValue,
}: {
  title: string; unit: string; data: { label: string; v: number }[]; color: string;
  formatValue?: (v: number) => string;
}) {
  const c = useChartColors();
  const fmt = formatValue ?? ((v: number) => `${Math.round(v)} ${unit}`);
  return (
    <figure className="rounded-lg border border-line bg-panel p-4">
      <figcaption className="mb-2 text-sm font-medium">
        {title} <span className="text-xs text-ink-2">({unit})</span>
      </figcaption>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }} barCategoryGap="25%">
          <CartesianGrid stroke={c.line} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: c.ink2, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.line }} />
          <YAxis tick={{ fill: c.ink2, fontSize: 11 }} tickLine={false} axisLine={false} width={46} />
          <Tooltip
            formatter={(v) => [fmt(Number(v)), title]} cursor={{ fill: "rgb(127 127 127 / 0.08)" }}
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--ink)" }}
          />
          <Bar dataKey="v" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
