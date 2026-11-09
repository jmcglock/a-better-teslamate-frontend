"use client";

import TimeSeriesPanel from "./TimeSeriesPanel";
import { chartColor } from "./useChartColors";

type Point = { t: number; v: number | null };

export default function DriveCharts({
  syncId, speedData, socData, powerData, elevationData, speedUnit, elevUnit,
}: {
  syncId: string;
  speedData: Point[];
  socData: Point[];
  powerData?: Point[];
  elevationData?: Point[];
  speedUnit: string;
  elevUnit?: string;
}) {
  const hasPower = powerData && powerData.some((p) => p.v !== null);
  const hasElev = elevationData && elevationData.some((p) => p.v !== null);
  return (
    <div className="space-y-4">
      <TimeSeriesPanel title="Speed" unit={speedUnit} data={speedData} color={chartColor.blue} syncId={syncId} />
      <TimeSeriesPanel title="Battery" unit="%" data={socData} color={chartColor.green} syncId={syncId} yDomain={[0, 100]} />
      {hasPower && powerData && (
        <TimeSeriesPanel title="Power" unit="kW" data={powerData} color={chartColor.orange} syncId={syncId} />
      )}
      {hasElev && elevationData && (
        <TimeSeriesPanel
          title="Elevation"
          unit={elevUnit ?? "m"}
          data={elevationData}
          color={chartColor.violet}
          syncId={syncId}
        />
      )}
    </div>
  );
}
