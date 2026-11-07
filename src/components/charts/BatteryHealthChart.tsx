"use client";

import TimeSeriesPanel from "./TimeSeriesPanel";

type Point = { t: number; v: number | null };

export default function BatteryHealthChart({
  title,
  unit,
  color,
  data,
}: {
  title: string;
  unit: string;
  color: string;
  data: Point[];
}) {
  return (
    <TimeSeriesPanel
      title={title}
      unit={unit}
      color={color}
      data={data}
      formatValue={(v) => `${Math.round(v)} ${unit}`}
      formatTick={(t) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
    />
  );
}