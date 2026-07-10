"use client";

import TimeSeriesPanel from "./TimeSeriesPanel";
import { useChartColors } from "./useChartColors";

type Point = { t: number; v: number | null };

export default function DriveCharts({
  syncId, speedData, socData, speedUnit,
}: { syncId: string; speedData: Point[]; socData: Point[]; speedUnit: string }) {
  const c = useChartColors();
  return (
    <div className="space-y-4">
      <TimeSeriesPanel title="Speed" unit={speedUnit} data={speedData} color={c.blue} syncId={syncId} />
      <TimeSeriesPanel title="Battery" unit="%" data={socData} color={c.green} syncId={syncId} yDomain={[0, 100]} />
    </div>
  );
}
