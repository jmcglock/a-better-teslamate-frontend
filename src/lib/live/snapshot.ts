export type CarSnapshot = Record<string, string | number | boolean | null>;

const NUMERIC = new Set([
  "battery_level", "usable_battery_level", "charge_limit_soc", "charger_power",
  "charger_actual_current", "charger_voltage", "charger_phases", "speed", "power",
  "odometer", "latitude", "longitude", "heading", "elevation", "inside_temp",
  "outside_temp", "rated_battery_range_km", "ideal_battery_range_km",
  "est_battery_range_km", "charge_energy_added", "time_to_full_charge",
  "charge_current_request", "charge_current_request_max",
  "tpms_pressure_fl", "tpms_pressure_fr", "tpms_pressure_rl", "tpms_pressure_rr",
  "download_perc", "install_perc", "sun_roof_percent_open",
]);
const BOOLEAN = new Set([
  "healthy", "is_climate_on", "is_preconditioning", "locked", "sentry_mode",
  "plugged_in", "windows_open", "doors_open", "trunk_open", "frunk_open",
  "is_user_present", "update_available", "charge_port_door_open",
]);

const TOPIC_RE = /^teslamate\/cars\/(\d+)\/([^/]+)$/;

export function parseTopic(topic: string): { carId: number; field: string } | null {
  const m = TOPIC_RE.exec(topic);
  return m ? { carId: Number(m[1]), field: m[2] } : null;
}

export function applyMessage(snap: CarSnapshot, field: string, payload: string): CarSnapshot {
  let value: CarSnapshot[string];
  if (payload === "") value = null;
  else if (NUMERIC.has(field)) {
    const n = Number(payload);
    value = Number.isFinite(n) ? n : null;
  } else if (BOOLEAN.has(field)) value = payload === "true";
  else value = payload;
  return { ...snap, [field]: value };
}
