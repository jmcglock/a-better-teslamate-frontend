"use client";

import type { CarCard as CarCardData } from "@/lib/db/cars";
import type { Settings } from "@/lib/db/settings";
import { useLive } from "@/lib/live/useLive";
import {
  formatDistance, formatDuration, formatEnergy, formatOdometer, formatPct,
  formatPower, formatSpeed, formatTemp,
} from "@/lib/format";
import BatteryBar from "./BatteryBar";
import StateBadge from "./StateBadge";
import MiniMap from "./MiniMap";

function liveNum(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

function liveStr(v: unknown): string | null {
  return typeof v === "string" && v !== "" && v !== "nil" ? v : null;
}

function liveBool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function parseLocation(live: Record<string, unknown>): { lat: number | null; lon: number | null } {
  const lat = liveNum(live.latitude);
  const lon = liveNum(live.longitude);
  if (lat !== null && lon !== null) return { lat, lon };
  const raw = live.location;
  if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw) as { latitude?: number; longitude?: number };
      return { lat: liveNum(j.latitude), lon: liveNum(j.longitude) };
    } catch {
      return { lat: null, lon: null };
    }
  }
  return { lat: null, lon: null };
}

function formatHours(h: number | null): string {
  if (h === null) return "–";
  return formatDuration(h * 60);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export default function CarCard({ initial, settings }: { initial: CarCardData; settings: Settings }) {
  const { snaps, connected } = useLive();
  const live = snaps[initial.id] ?? {};

  const state = liveStr(live.state) ?? initial.state;
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
  const { lat: liveLat, lon: liveLon } = parseLocation(live);
  const lat = liveLat ?? initial.latitude;
  const lon = liveLon ?? initial.longitude;
  const chargerPower = liveNum(live.charger_power);
  const chargeEnergy = liveNum(live.charge_energy_added);
  const timeToFull = liveNum(live.time_to_full_charge);
  const chargerAmps = liveNum(live.charger_actual_current);
  const chargerVolts = liveNum(live.charger_voltage);
  const chargeLimitSoc = liveNum(live.charge_limit_soc);
  const speed = liveNum(live.speed);
  const power = liveNum(live.power);
  const geofence = liveStr(live.geofence);
  const version = liveStr(live.version);
  const updateVersion = liveStr(live.update_version);
  const shiftState = liveStr(live.shift_state);
  const chargingState = liveStr(live.charging_state);
  const since = liveStr(live.since);

  const flags = [
    liveBool(live.locked) === true && "Locked",
    liveBool(live.locked) === false && "Unlocked",
    liveBool(live.plugged_in) === true && "Plugged in",
    liveBool(live.sentry_mode) === true && "Sentry",
    liveBool(live.is_climate_on) === true && "Climate on",
    liveBool(live.is_preconditioning) === true && "Preconditioning",
    liveBool(live.windows_open) === true && "Windows open",
    liveBool(live.doors_open) === true && "Doors open",
    liveBool(live.trunk_open) === true && "Trunk open",
    liveBool(live.frunk_open) === true && "Frunk open",
    liveBool(live.is_user_present) === true && "Occupied",
    liveBool(live.update_available) === true && (updateVersion ? `Update ${updateVersion}` : "Update available"),
    liveBool(live.charge_port_door_open) === true && "Charge port open",
    shiftState && shiftState !== "P" && `Gear ${shiftState}`,
  ].filter(Boolean) as string[];

  const charging =
    state === "charging" ||
    chargingState === "Charging" ||
    chargingState === "Starting" ||
    (liveBool(live.plugged_in) === true && (chargerPower ?? 0) > 0);

  const driving = state === "driving" || (speed !== null && speed > 0);

  const tpms = [
    liveNum(live.tpms_pressure_fl),
    liveNum(live.tpms_pressure_fr),
    liveNum(live.tpms_pressure_rl),
    liveNum(live.tpms_pressure_rr),
  ];
  const hasTpms = tpms.some((p) => p !== null);
  const tpmsLabel = hasTpms
    ? tpms.map((p) => (p === null ? "–" : p.toFixed(1))).join(" · ")
    : null;

  const sinceLabel = since
    ? new Date(since).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    : null;

  return (
    <section className="rounded-lg border border-line bg-panel p-5">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{initial.name}</h2>
          <p className="text-xs text-ink-2">
            {[
              initial.model && `Model ${initial.model}`,
              initial.marketingName,
              version && `v${version}`,
              geofence,
            ].filter(Boolean).join(" · ")}
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
          {chargeLimit !== null && (
            <span className="ml-2 text-xs text-ink-2">limit {formatPct(chargeLimit)}</span>
          )}
        </div>
        {charging && chargerPower !== null && (
          <span className="text-sm" style={{ color: "var(--state-charging)" }}>
            ▲ {formatPower(chargerPower)}
          </span>
        )}
        {driving && speed !== null && (
          <span className="text-sm text-ink-2">{formatSpeed(speed, settings.unitOfLength)}</span>
        )}
      </div>

      <div className="mt-3">
        <BatteryBar soc={soc} state={state} chargeLimit={chargeLimit} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Odometer" value={formatOdometer(odo, settings.unitOfLength)} />
        <Stat label="Inside" value={formatTemp(insideTemp, settings.unitOfTemperature)} />
        <Stat label="Outside" value={formatTemp(outsideTemp, settings.unitOfTemperature)} />
        <Stat label="Location" value={geofence ?? (lat !== null && lon !== null ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : "–")} />
        {soc !== null && usable !== null && soc !== usable && (
          <Stat label="Displayed SoC" value={formatPct(soc)} />
        )}
        {chargeLimitSoc !== null && <Stat label="Charge limit" value={formatPct(chargeLimitSoc)} />}
        {version && <Stat label="Software" value={version} />}
        {sinceLabel && <Stat label="State since" value={sinceLabel} />}
        {power !== null && (driving || charging) && (
          <Stat label="Battery power" value={`${power > 0 ? "+" : ""}${Math.round(power)} kW`} />
        )}
        {tpmsLabel && <Stat label="TPMS (bar)" value={tpmsLabel} />}
      </dl>

      {charging && (
        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-md border border-line bg-[color-mix(in_oklab,var(--state-charging)_8%,transparent)] p-3 text-sm sm:grid-cols-4">
          <Stat label="Charge power" value={formatPower(chargerPower)} />
          <Stat label="Added" value={formatEnergy(chargeEnergy)} />
          <Stat label="Time to full" value={formatHours(timeToFull)} />
          <Stat
            label="Charger"
            value={
              chargerAmps !== null || chargerVolts !== null
                ? [chargerAmps !== null ? `${Math.round(chargerAmps)} A` : null, chargerVolts !== null ? `${Math.round(chargerVolts)} V` : null]
                    .filter(Boolean)
                    .join(" · ")
                : chargingState ?? "–"
            }
          />
        </dl>
      )}

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
            {geofence ? ` · ${geofence}` : ""}
          </p>
        </div>
      )}
    </section>
  );
}
