export default function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 rounded-lg bg-[color-mix(in_oklab,var(--ink)_10%,transparent)]" />
      <div className="divide-y divide-line rounded-2xl border border-line bg-panel">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3">
            <div className="h-4 w-28 rounded bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
            <div className="h-4 min-w-0 flex-1 rounded bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
            <div className="h-4 w-16 rounded bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
