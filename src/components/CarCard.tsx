"use client";

import type { CarCard as CarCardData } from "@/lib/db/cars";
import type { Settings } from "@/lib/db/settings";
import { useLive } from "@/lib/live/useLive";
import {
  formatDistance, formatOdometer, formatPct, formatPower, formatTemp,
} from "@/lib/format";
import BatteryBar from "./BatteryBar";
import StateBadge from "./StateBadge";
import MiniMap from "./MiniMap";

function liveNum(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

export default function CarCard({ initial, settings }: { initial: CarCardData; settings: Settings }) {
  const { snaps, connected } = useLive();
  const live = snaps[initial.id] ?? {};

  const state = typeof live.state === "string" ? live.state : initial.state;
  const soc = liveNum(live.battery_level) ?? initial.batteryLevel;
  const usable = liveNum(live.usable_battery_level) ?? initial.usableBatteryLevel;
  const chargeLimit = liveNum(live.charge_limit_soc);
  const rangeKm =
    settings.preferredRange === "ideal"
      ? liveNum(live.ideal_battery_range_km) ?? initial.idealRangeKm
      : liveNum(live.rated_battery_range_km) ?? initial.ratedRangeKm;
  const odo = liveNum(live.odometer) ?? initial.odometerKm;
  const insideTemp = liveNum(live.inside_temp) ?? initial.insideTempC;
  const outsideTemp = liveNum(live.outside_temp) ?? initial.outsideTempC;
  const lat = liveNum(live.latitude) ?? initial.latitude;
  const lon = liveNum(live.longitude) ?? initial.longitude;
  const chargerPower = liveNum(live.charger_power);

  const flags = [
    live.locked === true && "Locked",
    live.plugged_in === true && "Plugged in",
    live.sentry_mode === true && "Sentry",
    live.is_climate_on === true && "Climate on",
  ].filter(Boolean) as string[];

  return (
    <section className="rounded-lg border border-line bg-panel p-5">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{initial.name}</h2>
          <p className="text-xs text-ink-2">
            {[initial.model && `Model ${initial.model}`, initial.marketingName].filter(Boolean).join(" · ")}
          </p>
        </div>
        <StateBadge state={state} />
      </header>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <span className="font-[family-name:var(--font-cond)] text-5xl font-semibold leading-none">
            {formatPct(usable ?? soc)}
          </span>
          <span className="ml-3 text-sm text-ink-2">{formatDistance(rangeKm, settings.unitOfLength, 0)} range</span>
        </div>
        {state === "charging" && chargerPower !== null && (
          <span className="text-sm" style={{ color: "var(--state-charging)" }}>
            ▲ {formatPower(chargerPower)}
          </span>
        )}
      </div>

      <div className="mt-3">
        <BatteryBar soc={soc} state={state} chargeLimit={chargeLimit} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div><dt className="text-xs text-ink-2">Odometer</dt><dd>{formatOdometer(odo, settings.unitOfLength)}</dd></div>
        <div><dt className="text-xs text-ink-2">Inside</dt><dd>{formatTemp(insideTemp, settings.unitOfTemperature)}</dd></div>
        <div><dt className="text-xs text-ink-2">Outside</dt><dd>{formatTemp(outsideTemp, settings.unitOfTemperature)}</dd></div>
      </dl>

      {flags.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-2">
          {flags.map((f) => (
            <span key={f} className="rounded-md border border-line px-2 py-0.5 text-xs text-ink-2">{f}</span>
          ))}
        </p>
      )}

      {!connected && (
        <p className="mt-3 text-xs" style={{ color: "var(--state-sentry)" }}>
          Live updates unavailable — showing last recorded state.
        </p>
      )}

      {lat !== null && lon !== null && (
        <div className="mt-4">
          <MiniMap latitude={lat} longitude={lon} />
          <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-ink-2">
            {lat.toFixed(5)}, {lon.toFixed(5)}
          </p>
        </div>
      )}
    </section>
  );
}
