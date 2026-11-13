import DataUnavailable from "@/components/DataUnavailable";
import EmptyState from "@/components/EmptyState";
import { getUpdateImpact } from "@/lib/db/updateImpact";
import { listCarIdentities } from "@/lib/db/stats";
import { safe } from "@/lib/db/pool";
import { parseCarId } from "@/lib/db/range";
import { formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

function metricText(value: number | null, digits = 1): string {
  return value === null ? "—" : value.toFixed(digits);
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

  const res = await safe(getUpdateImpact(car.id));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const impacts = res.data;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">Update impact</h1>
          <p className="mt-1 text-sm text-ink-2">Before/after comparison of efficiency, range, DC speed, and standby drain per software version.</p>
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
                    {(["efficiency", "range", "dcSpeed", "standbyDrain"] as const).map((key) => {
                      const m = impact.metrics[key];
                      return (
                        <tr key={key} className="border-b border-line-subtle/60 last:border-0">
                          <td className="px-2 py-1 font-medium">{key}</td>
                          <td className="px-2 py-1 text-right">{metricText(m.before)}</td>
                          <td className="px-2 py-1 text-right">{metricText(m.after)}</td>
                          <td className="px-2 py-1 text-right">{m.delta === null ? "—" : `${m.delta > 0 ? "+" : ""}${m.delta.toFixed(key === "standbyDrain" ? 2 : 1)}`}</td>
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