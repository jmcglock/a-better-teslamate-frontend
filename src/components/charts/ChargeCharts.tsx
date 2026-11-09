"use client";

import TimeSeriesPanel from "./TimeSeriesPanel";
import { chartColor } from "./useChartColors";

type Point = { t: number; v: number | null };

export default function ChargeCharts({
  syncId, powerData, socData,
}: { syncId: string; powerData: Point[]; socData: Point[] }) {
  return (
    <div className="space-y-4">
      <TimeSeriesPanel title="Charging power" unit="kW" data={powerData} color={chartColor.orange} syncId={syncId} />
      <TimeSeriesPanel title="Battery" unit="%" data={socData} color={chartColor.green} syncId={syncId} yDomain={[0, 100]} />
    </div>
  );
}
