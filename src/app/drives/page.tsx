import Link from "next/link";
import DataUnavailable from "@/components/DataUnavailable";
import { listDrives } from "@/lib/db/drives";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";
import { formatDistance, formatDuration, formatSpeed } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DrivesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const res = await safe(Promise.all([listDrives(page), getSettings()]));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [drives, settings] = res.data;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Drives</h1>
      {drives.length === 0 ? (
        <p className="text-ink-2">No drives on this page.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-panel">
          {drives.map((d) => (
            <li key={d.id}>
              <Link href={`/drives/${d.id}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]">
                <span className="w-40 font-[family-name:var(--font-mono)] text-xs text-ink-2">
                  {new Date(d.startDate).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{d.startLabel} → {d.endLabel}</span>
                <span className="text-sm">{formatDistance(d.distanceKm, settings.unitOfLength)}</span>
                <span className="text-sm text-ink-2">{formatDuration(d.durationMin)}</span>
                <span className="text-sm text-ink-2">max {formatSpeed(d.speedMaxKmh, settings.unitOfLength)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <nav className="mt-4 flex gap-3 text-sm">
        {page > 1 && <Link className="text-ink-2 hover:text-ink" href={`/drives?page=${page - 1}`}>← Newer</Link>}
        {drives.length === 50 && <Link className="text-ink-2 hover:text-ink" href={`/drives?page=${page + 1}`}>Older →</Link>}
      </nav>
    </div>
  );
}
