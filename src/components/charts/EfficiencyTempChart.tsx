"use client";

import { Scatter, ScatterChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useChartColors } from "./useChartColors";

export default function EfficiencyTempChart({ data, unit }: { data: { tempC: number; whPerKm: number }[]; unit: string }) {
  const c = useChartColors();
  const isMi = unit === "mi";
  const yUnit = isMi ? "Wh/mi" : "Wh/km";
  const conv = (whPerKm: number) => (isMi ? whPerKm * 1.609344 : whPerKm);
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
        <CartesianGrid stroke={c.line} />
        <XAxis dataKey="tempC" type="number" name="Temp" unit="°C" tick={{ fill: c.ink2, fontSize: 11 }} />
        <YAxis dataKey="whPerKm" type="number" name="Efficiency" unit={yUnit} tick={{ fill: c.ink2, fontSize: 11 }} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--ink)" }} />
        <Scatter data={data.map((d) => ({ tempC: d.tempC, whPerKm: conv(d.whPerKm) }))} fill="#3b82f6" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
