"use client";

import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { chartColor } from "./useChartColors";
import { formatDuration } from "@/lib/format";

export default function BarPanel({
  title, unit, data, color, formatValue,
  valuePrefix, valueSuffix, valueDecimals, valueMode,
}: {
  title: string; unit: string; data: { label: string; v: number }[]; color: string;
  formatValue?: (v: number) => string;
  valuePrefix?: string;
  valueSuffix?: string;
  valueDecimals?: number;
  valueMode?: "hours";
}) {
  const fmt = formatValue ?? ((v: number) => {
    if (valueMode === "hours") return formatDuration(v * 60);
    const decimals = valueDecimals ?? 0;
    const numStr = decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
    const prefix = valuePrefix ?? "";
    const suffix = valueSuffix ?? (unit ? ` ${unit}` : "");
    return `${prefix}${numStr}${suffix}`;
  });
  return (
    <figure className="rounded-lg border border-line bg-panel p-4">
      <figcaption className="mb-2 text-sm font-medium">
        {title} <span className="text-xs text-ink-2">({unit})</span>
      </figcaption>
      <ResponsiveContainer width="100%" height={200} debounce={50}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }} barCategoryGap="25%">
          <CartesianGrid stroke={chartColor.line} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: chartColor.ink2, fontSize: 11 }} tickLine={false} axisLine={{ stroke: chartColor.line }} />
          <YAxis tick={{ fill: chartColor.ink2, fontSize: 11 }} tickLine={false} axisLine={false} width={46} />
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
