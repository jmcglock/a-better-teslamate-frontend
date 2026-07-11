import { notFound } from "next/navigation";
import DataUnavailable from "@/components/DataUnavailable";
import RouteMap from "@/components/RouteMap";
import DriveCharts from "@/components/charts/DriveCharts";
import { getDrive } from "@/lib/db/drives";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";
import { formatDistance, formatDuration, formatSpeed, formatTemp, kmToUnit } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DrivePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const res = await safe(Promise.all([getDrive(id), getSettings()]));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [drive, settings] = res.data;
  if (!drive) notFound();

  const speedData = drive.points.map((p) => ({
    t: p.t, v: p.speed === null ? null : Math.round(kmToUnit(p.speed, settings.unitOfLength)),
  }));
  const socData = drive.points.map((p) => ({ t: p.t, v: p.soc }));
  const avgSpeed =
    drive.distanceKm !== null && drive.durationMin ? (drive.distanceKm / drive.durationMin) * 60 : null;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">{drive.startLabel} → {drive.endLabel}</h1>
        <p className="font-[family-name:var(--font-mono)] text-xs text-ink-2">
          {new Date(drive.startDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-panel p-4 text-sm sm:grid-cols-5">
        <div><dt className="text-xs text-ink-2">Distance</dt><dd>{formatDistance(drive.distanceKm, settings.unitOfLength)}</dd></div>
        <div><dt className="text-xs text-ink-2">Duration</dt><dd>{formatDuration(drive.durationMin)}</dd></div>
        <div><dt className="text-xs text-ink-2">Avg speed</dt><dd>{formatSpeed(avgSpeed, settings.unitOfLength)}</dd></div>
        <div><dt className="text-xs text-ink-2">Max speed</dt><dd>{formatSpeed(drive.speedMaxKmh, settings.unitOfLength)}</dd></div>
        <div><dt className="text-xs text-ink-2">Outside</dt><dd>{formatTemp(drive.outsideTempAvgC, settings.unitOfTemperature)}</dd></div>
      </dl>

      <RouteMap points={drive.points} />

      <DriveCharts
        syncId={`drive-${drive.id}`}
        speedData={speedData}
        socData={socData}
        speedUnit={settings.unitOfLength === "mi" ? "mph" : "km/h"}
      />
    </div>
  );
}
