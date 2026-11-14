import DataUnavailable from "@/components/DataUnavailable";
import EmptyState from "@/components/EmptyState";
import { getUpdateImpact } from "@/lib/db/updateImpact";
import { listCarIdentities } from "@/lib/db/stats";
import { safe } from "@/lib/db/pool";
import { parseCarId } from "@/lib/db/range";
import { KM_PER_MI, type LengthUnit } from "@/lib/format";
import { getSettings } from "@/lib/db/settings";

export const dynamic = "force-dynamic";

// standbyDrain has no data source yet (always empty), so it is not shown.
const METRICS = ["efficiency", "range", "dcSpeed"] as const;
type ShownMetric = (typeof METRICS)[number];

function metricMeta(key: ShownMetric, unit: LengthUnit): { label: string; scale: number; digits: number } {
  switch (key) {
    case "efficiency":
      return unit === "mi"
        ? { label: "Efficiency (Wh/mi)", scale: KM_PER_MI, digits: 0 }
        : { label: "Efficiency (Wh/km)", scale: 1, digits: 0 };
    case "range":
      return unit === "mi"
        ? { label: "Range at 100% (mi)", scale: 1 / KM_PER_MI, digits: 0 }
        : { label: "Range at 100% (km)", scale: 1, digits: 0 };
    case "dcSpeed":
      return { label: "Peak DC power (kW)", scale: 1, digits: 0 };
  }
}

function metricText(value: number | null, scale: number, digits: number): string {
  return value === null ? "—" : (value * scale).toFixed(digits);
}

export default async function UpdateImpactPage({
  searchParams,
}: {
  searchParams: Promise<{ car?: string }>;
}) {
  const sp = await searchParams;
  const carsRes = await safe(listCarIdentities());
  if (!carsRes.ok) return <DataUnavailable service="database" detail={carsRes.error} />;
  const cars = carsRes.data;
  if (cars.length === 0) return <DataUnavailable service="database" detail="No cars found. Sign in to TeslaMate first." />;

  const carId = parseCarId(sp.car, cars.map((c) => c.id));
  const car = carId === null ? cars[0] : cars.find((c) => c.id === carId) ?? cars[0];

  const res = await safe(Promise.all([getUpdateImpact(car.id), getSettings()]));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [impacts, settings] = res.data;
  const unit: LengthUnit = settings.unitOfLength;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">Update impact</h1>
          <p className="mt-1 text-sm text-ink-2">Before/after comparison of efficiency, range, and DC speed per software version.</p>
        </div>
      </div>

      {impacts.length === 0 ? (
        <EmptyState title="No software updates" detail="Install history from TeslaMate will show up here." icon="↑" />
      ) : (
        <div className="space-y-4">
          {impacts.map((impact) => (
            <section key={impact.id} className="rounded-2xl border border-line bg-panel p-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-[family-name:var(--font-cond)] text-lg font-semibold tracking-tight">{impact.version}</h2>
                <span className="text-xs text-ink-2">installed {new Date(impact.installedAt).toLocaleDateString()}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="px-2 py-1 text-left text-ink-2">Metric</th>
                      <th className="px-2 py-1 text-right text-ink-2">Before</th>
                      <th className="px-2 py-1 text-right text-ink-2">After</th>
                      <th className="px-2 py-1 text-right text-ink-2">Delta</th>
                      <th className="px-2 py-1 text-right text-ink-2">Samples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map((key) => {
                      const m = impact.metrics[key];
                      const { label, scale, digits } = metricMeta(key, unit);
                      const delta = m.delta === null ? null : m.delta * scale;
                      return (
                        <tr key={key} className="border-b border-line-subtle/60 last:border-0">
                          <td className="px-2 py-1 font-medium">{label}</td>
                          <td className="px-2 py-1 text-right">{metricText(m.before, scale, digits)}</td>
                          <td className="px-2 py-1 text-right">{metricText(m.after, scale, digits)}</td>
                          <td className="px-2 py-1 text-right">{delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(digits)}`}</td>
                          <td className="px-2 py-1 text-right text-ink-2">{m.beforeSamples}/{m.afterSamples}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}