"use client";

import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import TimeSeriesPanel from "./TimeSeriesPanel";
import { chartColor } from "./useChartColors";

type Point = { t: number; v: number | null };

export type HealthForecastOverlay = {
  band: { t: number; fit: number; lo: number; hi: number }[];
  target: number;
  targetLabel: string;
  projectedAt: number | null;
};

type Row = { t: number; v?: number | null; fit?: number; range?: [number, number] };

const fmtMonth = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

export default function BatteryHealthChart({
  title,
  unit,
  color,
  data,
  forecast,
}: {
  title: string;
  unit: string;
  color: string;
  data: Point[];
  forecast?: HealthForecastOverlay | null;
}) {
  const fmt = (v: number) => `${Math.round(v)} ${unit}`;
  if (!forecast || forecast.band.length === 0) {
    return (
      <TimeSeriesPanel title={title} unit={unit} color={color} data={data} formatValue={fmt} formatTick={fmtMonth} />
    );
  }

  const byT = new Map<number, Row>();
  for (const p of data) byT.set(p.t, { t: p.t, v: p.v });
  for (const b of forecast.band) {
    const row = byT.get(b.t) ?? { t: b.t };
    row.fit = b.fit;
    row.range = [b.lo, b.hi];
    byT.set(b.t, row);
  }
  const rows = [...byT.values()].sort((a, b) => a.t - b.t);
  const names: Record<string, string> = { v: "Observed", fit: "Trend", range: "95% range" };

  return (
    <figure className="rounded-lg border border-line bg-panel p-4">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm font-medium">
        <span>
          {title} <span className="text-xs text-ink-2">({unit})</span>
        </span>
        <span className="flex gap-3 text-xs font-normal text-ink-2">
          <span><span className="mr-1 inline-block h-0.5 w-3 align-middle" style={{ background: color }} />Observed</span>
          <span><span className="mr-1 inline-block w-3 border-t border-dashed align-middle" style={{ borderColor: chartColor.blue }} />Trend</span>
          <span><span className="mr-1 inline-block h-2 w-3 align-middle opacity-30" style={{ background: chartColor.blue }} />95% range</span>
        </span>
      </figcaption>
      <ResponsiveContainer width="100%" height={260} debounce={50}>
        <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={chartColor.line} vertical={false} />
          <XAxis
            dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time"
            tickFormatter={fmtMonth} tick={{ fill: chartColor.ink2, fontSize: 11 }} tickLine={false} axisLine={{ stroke: chartColor.line }}
          />
          <YAxis domain={["auto", "auto"]} tick={{ fill: chartColor.ink2, fontSize: 11 }} tickLine={false} axisLine={false} width={46} />
          <Tooltip
            labelFormatter={(t) => fmtMonth(Number(t))}
            formatter={(v, name) => {
              const label = names[String(name)] ?? String(name);
              if (Array.isArray(v)) return [`${fmt(Number(v[0]))} – ${fmt(Number(v[1]))}`, label];
              return [fmt(Number(v)), label];
            }}
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--ink)" }}
          />
          <Area
            dataKey="range" name="range" stroke="none" fill={chartColor.blue} fillOpacity={0.15}
            connectNulls isAnimationActive={false} activeDot={false}
          />
          <Line
            dataKey="fit" name="fit" stroke={chartColor.blue} strokeWidth={1.5} strokeDasharray="5 4"
            dot={false} connectNulls isAnimationActive={false}
          />
          <Line
            dataKey="v" name="v" stroke={color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false}
          />
          <ReferenceLine
            y={forecast.target} stroke={chartColor.orange} strokeDasharray="3 3"
            label={{ value: forecast.targetLabel, position: "insideTopLeft", fill: chartColor.orange, fontSize: 11 }}
          />
          {forecast.projectedAt !== null && (
            <ReferenceLine x={forecast.projectedAt} stroke={chartColor.orange} strokeOpacity={0.6} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}
