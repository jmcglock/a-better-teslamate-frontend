import DataUnavailable from "@/components/DataUnavailable";
import { listGeofences, topChargePlaces, topDrivePlaces } from "@/lib/db/locations";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";
import { formatCost, formatDistance, formatEnergy } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PlacesPage() {
  const currency = process.env.CURRENCY ?? "$";
  const res = await safe(
    Promise.all([topChargePlaces(), topDrivePlaces(), listGeofences(), getSettings()]),
  );
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [charges, drives, geofences, settings] = res.data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">
          Places
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Charge locations, frequent drive endpoints, and configured geofences.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-ink-2">
          Top charge locations
        </h2>
        {charges.length === 0 ? (
          <p className="text-sm text-ink-2">No charge locations yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-panel">
            {charges.map((p) => (
              <li key={p.location} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.location}</span>
                <span className="text-sm text-ink-2">{p.visits}×</span>
                <span className="text-sm">{formatEnergy(p.energyKwh)}</span>
                <span className="text-sm">{formatCost(p.cost, currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-ink-2">
          Frequent drive places
        </h2>
        {drives.length === 0 ? (
          <p className="text-sm text-ink-2">No drive places yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-panel">
            {drives.map((p) => (
              <li key={p.location} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.location}</span>
                <span className="text-sm text-ink-2">{p.visits}×</span>
                <span className="text-sm">{formatDistance(p.distanceKm, settings.unitOfLength)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-ink-2">
          Geofences
        </h2>
        {geofences.length === 0 ? (
          <p className="text-sm text-ink-2">No geofences configured in TeslaMate.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-panel">
            {geofences.map((g) => (
              <li key={g.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{g.name}</span>
                <span className="font-[family-name:var(--font-mono)] text-xs text-ink-2">
                  {g.latitude.toFixed(4)}, {g.longitude.toFixed(4)}
                </span>
                <span className="text-sm text-ink-2">{g.radiusM} m</span>
                {g.costPerUnit !== null && (
                  <span className="text-sm text-ink-2">
                    {currency}{g.costPerUnit.toFixed(3)}/unit
                    {g.sessionFee !== null ? ` + ${currency}${g.sessionFee.toFixed(2)} fee` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
