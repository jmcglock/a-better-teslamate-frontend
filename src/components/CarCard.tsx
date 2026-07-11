"use client";

import type { ReactNode } from "react";
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

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel-2 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-2">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-cond)] text-xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-2">{hint}</p>}
    </div>
  );
}

function Flag({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "good" | "warn" | "hot" }) {
  const color =
    tone === "good" ? "var(--state-charging)"
    : tone === "warn" ? "var(--state-sentry)"
    : tone === "hot" ? "var(--accent)"
    : "var(--ink-2)";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
      style={{ borderColor: `color-mix(in oklab, ${color} 35%, var(--line))`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
      {children}
    </span>
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
  const estRange = liveNum(live.est_battery_range_km);
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
  const chargerPhases = liveNum(live.charger_phases);
  const chargeReq = liveNum(live.charge_current_request);
  const chargeReqMax = liveNum(live.charge_current_request_max);
  const speed = liveNum(live.speed);
  const power = liveNum(live.power);
  const heading = liveNum(live.heading);
  const elevation = liveNum(live.elevation);
  const geofence = liveStr(live.geofence);
  const version = liveStr(live.version);
  const updateVersion = liveStr(live.update_version);
  const shiftState = liveStr(live.shift_state);
  const chargingState = liveStr(live.charging_state);
  const since = liveStr(live.since);
  const color = liveStr(live.exterior_color);
  const wheels = liveStr(live.wheel_type);
  const trim = liveStr(live.trim_badging);

  const locked = liveBool(live.locked);
  const plugged = liveBool(live.plugged_in);
  const sentry = liveBool(live.sentry_mode);
  const climate = liveBool(live.is_climate_on);
  const preconditioning = liveBool(live.is_preconditioning);
  const windowsOpen = liveBool(live.windows_open);
  const doorsOpen = liveBool(live.doors_open);
  const trunkOpen = liveBool(live.trunk_open);
  const frunkOpen = liveBool(live.frunk_open);
  const occupied = liveBool(live.is_user_present);
  const updateAvail = liveBool(live.update_available);
  const chargePortOpen = liveBool(live.charge_port_door_open);
  const healthy = liveBool(live.healthy);

  const charging =
    state === "charging" ||
    chargingState === "Charging" ||
    chargingState === "Starting" ||
    (plugged === true && (chargerPower ?? 0) > 0);

  const driving = state === "driving" || (speed !== null && speed > 0);

  const tpms = {
    fl: liveNum(live.tpms_pressure_fl),
    fr: liveNum(live.tpms_pressure_fr),
    rl: liveNum(live.tpms_pressure_rl),
    rr: liveNum(live.tpms_pressure_rr),
  };
  const hasTpms = Object.values(tpms).some((p) => p !== null);

  const sinceLabel = since
    ? new Date(since).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
      })
    : null;

  const subtitle = [
    initial.model && `Model ${initial.model}`,
    initial.marketingName ?? trim,
    color,
    wheels,
  ].filter(Boolean).join(" · ");

  return (
    <section className="glass-panel overflow-hidden">
      <div className="grid lg:grid-cols-5">
        {/* Hero */}
        <div className="flex flex-col p-6 sm:p-8 lg:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-ink-2">
                {geofence ?? "Vehicle"}
              </p>
              <h2 className="mt-1 font-[family-name:var(--font-cond)] text-3xl font-semibold tracking-tight sm:text-4xl">
                {initial.name}
              </h2>
              <p className="mt-1 text-sm text-ink-2">{subtitle || "Tesla"}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StateBadge state={state} />
              {sinceLabel && <p className="text-[11px] text-ink-2">since {sinceLabel}</p>}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-ink-2">Battery</p>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-[family-name:var(--font-cond)] text-6xl font-semibold leading-none tracking-tight sm:text-7xl">
                  {formatPct(usable ?? soc).replace("%", "")}
                  <span className="text-3xl text-ink-2">%</span>
                </span>
                <div className="pb-1 text-sm text-ink-2">
                  <div>{formatDistance(rangeKm, settings.unitOfLength, 0)} rated</div>
                  {estRange !== null && (
                    <div>{formatDistance(estRange, settings.unitOfLength, 0)} estimated</div>
                  )}
                </div>
              </div>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1 text-right">
              {charging && chargerPower !== null && (
                <p className="font-[family-name:var(--font-cond)] text-2xl font-semibold" style={{ color: "var(--state-charging)" }}>
                  +{formatPower(chargerPower)}
                </p>
              )}
              {driving && speed !== null && (
                <p className="font-[family-name:var(--font-cond)] text-2xl font-semibold" style={{ color: "var(--state-driving)" }}>
                  {formatSpeed(speed, settings.unitOfLength)}
                </p>
              )}
              {chargeLimit !== null && (
                <p className="text-xs text-ink-2">Charge limit {formatPct(chargeLimit)}</p>
              )}
            </div>
          </div>

          <div className="mt-5">
            <BatteryBar soc={usable ?? soc} state={state} chargeLimit={chargeLimit} />
            {soc !== null && usable !== null && soc !== usable && (
              <p className="mt-2 text-xs text-ink-2">
                Displayed {formatPct(soc)} · usable {formatPct(usable)}
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {locked === true && <Flag tone="good">Locked</Flag>}
            {locked === false && <Flag tone="warn">Unlocked</Flag>}
            {plugged === true && <Flag tone="good">Plugged in</Flag>}
            {sentry === true && <Flag tone="warn">Sentry</Flag>}
            {climate === true && <Flag>Climate on</Flag>}
            {preconditioning === true && <Flag>Preconditioning</Flag>}
            {windowsOpen === true && <Flag tone="warn">Windows open</Flag>}
            {doorsOpen === true && <Flag tone="hot">Doors open</Flag>}
            {trunkOpen === true && <Flag tone="warn">Trunk open</Flag>}
            {frunkOpen === true && <Flag tone="warn">Frunk open</Flag>}
            {occupied === true && <Flag>Occupied</Flag>}
            {chargePortOpen === true && <Flag>Charge port open</Flag>}
            {shiftState && shiftState !== "P" && <Flag tone="hot">Gear {shiftState}</Flag>}
            {updateAvail === true && <Flag tone="warn">{updateVersion ? `Update ${updateVersion}` : "Update available"}</Flag>}
            {healthy === false && <Flag tone="hot">Logger unhealthy</Flag>}
            {!connected && <Flag tone="warn">Live offline</Flag>}
          </div>

          {charging && (
            <div className="mt-6 rounded-2xl border border-line bg-[color-mix(in_oklab,var(--state-charging)_8%,var(--panel-2))] p-4">
              <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--state-charging)" }}>
                Charging session
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile label="Power" value={formatPower(chargerPower)} />
                <Tile label="Added" value={formatEnergy(chargeEnergy)} />
                <Tile label="ETA full" value={formatHours(timeToFull)} />
                <Tile
                  label="Charger"
                  value={
                    [chargerAmps !== null ? `${Math.round(chargerAmps)}A` : null, chargerVolts !== null ? `${Math.round(chargerVolts)}V` : null]
                      .filter(Boolean)
                      .join(" · ") || (chargingState ?? "–")
                  }
                  hint={
                    [chargerPhases !== null ? `${chargerPhases}φ` : null, chargeReq !== null ? `req ${chargeReq}A` : null, chargeReqMax !== null ? `max ${chargeReqMax}A` : null]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                />
              </div>
            </div>
          )}

          {driving && (
            <div className="mt-6 rounded-2xl border border-line bg-[color-mix(in_oklab,var(--state-driving)_8%,var(--panel-2))] p-4">
              <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--state-driving)" }}>
                Driving
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile label="Speed" value={formatSpeed(speed, settings.unitOfLength)} />
                <Tile
                  label="Power"
                  value={power === null ? "–" : `${power > 0 ? "+" : ""}${Math.round(power)} kW`}
                />
                <Tile label="Gear" value={shiftState ?? "–"} />
                <Tile label="Heading" value={heading === null ? "–" : `${Math.round(heading)}°`} />
              </div>
            </div>
          )}
        </div>

        {/* Map + meta */}
        <div className="flex flex-col border-t border-line bg-panel-2 lg:col-span-2 lg:border-l lg:border-t-0">
          {lat !== null && lon !== null ? (
            <div className="min-h-56 flex-1 p-3 sm:p-4">
              <MiniMap latitude={lat} longitude={lon} />
              <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-ink-2">
                {lat.toFixed(5)}, {lon.toFixed(5)}
                {elevation !== null ? ` · ${Math.round(elevation)} m` : ""}
              </p>
            </div>
          ) : (
            <div className="flex min-h-56 flex-1 items-center justify-center p-6 text-sm text-ink-2">
              Location unavailable
            </div>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        <div className="bg-panel px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-2">Odometer</p>
          <p className="mt-1 font-[family-name:var(--font-cond)] text-lg font-semibold">{formatOdometer(odo, settings.unitOfLength)}</p>
        </div>
        <div className="bg-panel px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-2">Cabin</p>
          <p className="mt-1 font-[family-name:var(--font-cond)] text-lg font-semibold">{formatTemp(insideTemp, settings.unitOfTemperature)}</p>
        </div>
        <div className="bg-panel px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-2">Outside</p>
          <p className="mt-1 font-[family-name:var(--font-cond)] text-lg font-semibold">{formatTemp(outsideTemp, settings.unitOfTemperature)}</p>
        </div>
        <div className="bg-panel px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-2">Software</p>
          <p className="mt-1 font-[family-name:var(--font-cond)] text-lg font-semibold">{version ?? "–"}</p>
        </div>
        <div className="bg-panel px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-2">Charge limit</p>
          <p className="mt-1 font-[family-name:var(--font-cond)] text-lg font-semibold">{formatPct(chargeLimit)}</p>
        </div>
        <div className="bg-panel px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-2">TPMS</p>
          <p className="mt-1 font-[family-name:var(--font-cond)] text-sm font-semibold leading-snug">
            {hasTpms
              ? `FL ${tpms.fl?.toFixed(1) ?? "–"} · FR ${tpms.fr?.toFixed(1) ?? "–"}\nRL ${tpms.rl?.toFixed(1) ?? "–"} · RR ${tpms.rr?.toFixed(1) ?? "–"}`.split("\n").map((line, i) => (
                  <span key={i} className="block">{line}</span>
                ))
              : "–"}
          </p>
        </div>
      </div>
    </section>
  );
}
