import Link from "next/link";
import type { CarActivity } from "@/lib/db/activity";
import type { Settings } from "@/lib/db/settings";
import { formatCost, formatDistance, formatEnergy, formatDuration } from "@/lib/format";

function TotalsCard({
  title, distanceKm, energyKwh, cost, driveCount, chargeCount, settings, currency,
}: {
  title: string;
  distanceKm: number;
  energyKwh: number;
  cost: number | null;
  driveCount: number;
  chargeCount: number;
  settings: Settings;
  currency: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-2">{title}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs text-ink-2">Driven</p>
          <p className="font-[family-name:var(--font-cond)] text-lg font-semibold">
            {formatDistance(distanceKm, settings.unitOfLength, 1)}
          </p>
          <p className="text-[11px] text-ink-2">{driveCount} drive{driveCount === 1 ? "" : "s"}</p>
        </div>
        <div>
          <p className="text-xs text-ink-2">Charged</p>
          <p className="font-[family-name:var(--font-cond)] text-lg font-semibold">
            {formatEnergy(energyKwh)}
          </p>
          <p className="text-[11px] text-ink-2">{chargeCount} session{chargeCount === 1 ? "" : "s"}</p>
        </div>
        <div>
          <p className="text-xs text-ink-2">Spend</p>
          <p className="font-[family-name:var(--font-cond)] text-lg font-semibold">
            {formatCost(cost, currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-2">Quick links</p>
          <div className="mt-1 flex flex-col gap-0.5 text-sm">
            <Link href="/drives" className="text-ink-2 hover:text-ink">Drives →</Link>
            <Link href="/charges" className="text-ink-2 hover:text-ink">Charges →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ActivityStrip({
  activity, settings, currency = "$",
}: {
  activity: CarActivity;
  settings: Settings;
  currency?: string;
}) {
  const { lastDrive: d, lastCharge: c, today, week } = activity;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <TotalsCard
          title="Today"
          distanceKm={today.distanceKm}
          energyKwh={today.energyAddedKwh}
          cost={today.cost}
          driveCount={today.driveCount}
          chargeCount={today.chargeCount}
          settings={settings}
          currency={currency}
        />
        <TotalsCard
          title="This week"
          distanceKm={week.distanceKm}
          energyKwh={week.energyAddedKwh}
          cost={week.cost}
          driveCount={week.driveCount}
          chargeCount={week.chargeCount}
          settings={settings}
          currency={currency}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-panel p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-2">Last drive</p>
            {d && (
              <Link href={`/drives/${d.id}`} className="text-xs text-ink-2 hover:text-ink">
                Details →
              </Link>
            )}
          </div>
          {d ? (
            <>
              <p className="mt-2 truncate text-sm font-medium">
                {d.startLabel} → {d.endLabel}
              </p>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-ink-2">
                {new Date(d.startDate).toLocaleString("en-US", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
                })}
                {" · "}
                {formatDistance(d.distanceKm, settings.unitOfLength)}
                {" · "}
                {formatDuration(d.durationMin)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-2">No drives yet</p>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-panel p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-2">Last charge</p>
            {c && (
              <Link href={`/charges/${c.id}`} className="text-xs text-ink-2 hover:text-ink">
                Details →
              </Link>
            )}
          </div>
          {c ? (
            <>
              <p className="mt-2 truncate text-sm font-medium">{c.location}</p>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-ink-2">
                {new Date(c.startDate).toLocaleString("en-US", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
                })}
                {" · "}
                {formatEnergy(c.energyAddedKwh)}
                {" · "}
                {formatCost(c.cost, currency)}
                {c.chargeKind ? ` · ${c.chargeKind}` : ""}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-2">No charges yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
