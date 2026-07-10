"use client";

import TimeSeriesPanel from "./TimeSeriesPanel";
import { useChartColors } from "./useChartColors";

type Point = { t: number; v: number | null };

export default function ChargeCharts({
  syncId, powerData, socData,
}: { syncId: string; powerData: Point[]; socData: Point[] }) {
  const c = useChartColors();
  return (
    <div className="space-y-4">
      <TimeSeriesPanel title="Charging power" unit="kW" data={powerData} color={c.orange} syncId={syncId} />
      <TimeSeriesPanel title="Battery" unit="%" data={socData} color={c.green} syncId={syncId} yDomain={[0, 100]} />
    </div>
  );
}
