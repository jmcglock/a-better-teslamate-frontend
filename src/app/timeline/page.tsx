import Link from "next/link";
import DataUnavailable from "@/components/DataUnavailable";
import { listStates } from "@/lib/db/timeline";
import { safe } from "@/lib/db/pool";
import { formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

const stateColor: Record<string, string> = {
  online: "var(--state-driving)",
  offline: "var(--state-idle)",
  asleep: "var(--state-idle)",
  charging: "var(--state-charging)",
  driving: "var(--state-driving)",
  updating: "var(--state-updating)",
  suspended: "var(--state-idle)",
};

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const res = await safe(listStates(page));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const { items, hasMore } = res.data;

  return (
    <div>
      <h1 className="mb-1 font-[family-name:var(--font-cond)] text-2xl font-semibold tracking-tight">
        Timeline
      </h1>
      <p className="mb-4 text-sm text-ink-2">
        Vehicle logger states (online / asleep / offline) from TeslaMate.
      </p>
      {items.length === 0 ? (
        <p className="text-ink-2">No state history on this page.</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-panel">
          {items.map((s) => {
            const color = stateColor[s.state] ?? "var(--ink-2)";
            return (
              <li key={s.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                <span className="w-40 font-[family-name:var(--font-mono)] text-xs text-ink-2">
                  {new Date(s.startDate).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
                  })}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs capitalize"
                  style={{ borderColor: `color-mix(in oklab, ${color} 40%, var(--line))`, color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                  {s.state}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{s.carName}</span>
                <span className="text-sm text-ink-2">
                  {s.durationMin === null ? "ongoing" : formatDuration(s.durationMin)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <nav className="mt-4 flex gap-3 text-sm">
        {page > 1 && <Link className="text-ink-2 hover:text-ink" href={`/timeline?page=${page - 1}`}>← Newer</Link>}
        {hasMore && <Link className="text-ink-2 hover:text-ink" href={`/timeline?page=${page + 1}`}>Older →</Link>}
      </nav>
    </div>
  );
}
