import EmptyState from "@/components/EmptyState";
import { formatCost, formatEnergy } from "@/lib/format";
import type { PlaceSpendRollup } from "@/lib/db/locations";

export default function ChargePlaceSpend({
  rollup,
  currency,
}: {
  rollup: PlaceSpendRollup;
  currency: string;
}) {
  const rows = rollup.other ? [...rollup.ranked, rollup.other] : rollup.ranked;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-ink-2">
        Charge spend by place
      </h2>
      {rollup.home && (
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-panel p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-ink-2">Home</p>
            <p className="mt-2 font-[family-name:var(--font-cond)] text-3xl font-semibold tracking-tight">
              {formatCost(rollup.home.cost, currency)}
            </p>
            <p className="mt-1 text-xs text-ink-2">
              {formatEnergy(rollup.home.energyKwh)} · {rollup.home.visits}×
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-panel p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-ink-2">Away</p>
            <p className="mt-2 font-[family-name:var(--font-cond)] text-3xl font-semibold tracking-tight">
              {formatCost(rollup.away.cost, currency)}
            </p>
            <p className="mt-1 text-xs text-ink-2">
              {formatEnergy(rollup.away.energyKwh)} · {rollup.away.visits}×
            </p>
          </div>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState
          title="No charge locations in this range"
          detail="Sessions in the selected window will rank here."
          icon="⌁"
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
          {rows.map((place) => (
            <li key={place.location} className="list-row">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{place.location}</span>
              <span className="text-sm text-ink-2">{place.visits}×</span>
              <span className="text-sm">{formatEnergy(place.energyKwh)}</span>
              <span className="text-sm">{formatCost(place.cost, currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
