export default function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div>
        <div className="h-3 w-28 rounded bg-[color-mix(in_oklab,var(--ink)_10%,transparent)]" />
        <div className="mt-2 h-8 w-48 rounded-lg bg-[color-mix(in_oklab,var(--ink)_10%,transparent)]" />
      </div>
      <div className="glass-panel overflow-hidden">
        <div className="grid lg:grid-cols-5">
          <div className="space-y-6 p-6 sm:p-8 lg:col-span-3">
            <div className="h-4 w-24 rounded bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
            <div className="h-10 w-56 rounded bg-[color-mix(in_oklab,var(--ink)_10%,transparent)]" />
            <div className="h-16 w-40 rounded bg-[color-mix(in_oklab,var(--ink)_12%,transparent)]" />
            <div className="h-3 w-full rounded-full bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
            <div className="flex gap-2">
              <div className="h-7 w-16 rounded-full bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
              <div className="h-7 w-20 rounded-full bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
            </div>
          </div>
          <div className="min-h-56 border-t border-line bg-panel-2 lg:col-span-2 lg:border-l lg:border-t-0" />
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="bg-panel px-4 py-4">
              <div className="h-3 w-16 rounded bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
              <div className="mt-2 h-5 w-20 rounded bg-[color-mix(in_oklab,var(--ink)_10%,transparent)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
