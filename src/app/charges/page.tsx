import Link from "next/link";
import DataUnavailable from "@/components/DataUnavailable";
import { listCharges } from "@/lib/db/charges";
import { safe } from "@/lib/db/pool";
import { formatCost, formatDuration, formatEnergy, formatPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ChargesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const currency = process.env.CURRENCY ?? "$";
  const res = await safe(listCharges(page));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const { items: charges, hasMore } = res.data;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Charges</h1>
      {charges.length === 0 ? (
        <p className="text-ink-2">No charging sessions on this page.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-panel">
          {charges.map((c) => (
            <li key={c.id}>
              <Link href={`/charges/${c.id}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]">
                <span className="w-40 font-[family-name:var(--font-mono)] text-xs text-ink-2">
                  {new Date(c.startDate).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{c.location}</span>
                <span className="text-sm">{formatEnergy(c.energyAddedKwh)}</span>
                <span className="text-sm text-ink-2">{formatPct(c.socStart)} → {formatPct(c.socEnd)}</span>
                <span className="text-sm text-ink-2">{formatDuration(c.durationMin)}</span>
                <span className="text-sm">{formatCost(c.cost, currency)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <nav className="mt-4 flex gap-3 text-sm">
        {page > 1 && <Link className="text-ink-2 hover:text-ink" href={`/charges?page=${page - 1}`}>← Newer</Link>}
        {hasMore && <Link className="text-ink-2 hover:text-ink" href={`/charges?page=${page + 1}`}>Older →</Link>}
      </nav>
    </div>
  );
}
