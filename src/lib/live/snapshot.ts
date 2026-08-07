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
  "active_route_latitude", "active_route_longitude",
  "center_display_state",
]);
const BOOLEAN = new Set([
  "healthy", "is_climate_on", "is_preconditioning", "locked", "sentry_mode",
  "plugged_in", "windows_open", "doors_open", "trunk_open", "frunk_open",
  "is_user_present", "update_available", "charge_port_door_open",
  "driver_front_window_open", "driver_rear_window_open",
  "passenger_front_window_open", "passenger_rear_window_open",
  "driver_front_door_open", "driver_rear_door_open",
  "passenger_front_door_open", "passenger_rear_door_open",
  "sun_roof_installed",
  "tpms_soft_warning_fl", "tpms_soft_warning_fr",
  "tpms_soft_warning_rl", "tpms_soft_warning_rr",
  "service_mode",
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

export type ActiveRoute = {
  destination: string | null;
  energyAtArrival: number | null;
  milesToArrival: number | null;
  minutesToArrival: number | null;
  trafficMinutesDelay: number | null;
  latitude: number | null;
  longitude: number | null;
  error: string | null;
};

/** Parse TeslaMate `active_route` JSON blob (or null when no route). */
export function parseActiveRoute(raw: unknown): ActiveRoute | null {
  if (raw == null || raw === "" || raw === "nil") return null;
  let obj: Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  } else {
    return null;
  }
  const err = typeof obj.error === "string" ? obj.error : null;
  if (err && err.toLowerCase().includes("no active route")) return null;

  const loc = obj.location && typeof obj.location === "object"
    ? (obj.location as { latitude?: number; longitude?: number })
    : null;

  const numOrNull = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v !== "" && v !== "nil") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const destination =
    typeof obj.destination === "string" && obj.destination !== "" && obj.destination !== "nil"
      ? obj.destination
      : null;

  const route: ActiveRoute = {
    destination,
    energyAtArrival: numOrNull(obj.energy_at_arrival),
    milesToArrival: numOrNull(obj.miles_to_arrival),
    minutesToArrival: numOrNull(obj.minutes_to_arrival),
    trafficMinutesDelay: numOrNull(obj.traffic_minutes_delay),
    latitude: numOrNull(loc?.latitude) ?? numOrNull(obj.latitude),
    longitude: numOrNull(loc?.longitude) ?? numOrNull(obj.longitude),
    error: err,
  };

  // Require at least a destination or ETA to show the card.
  if (!route.destination && route.minutesToArrival === null && route.milesToArrival === null) {
    return null;
  }
  return route;
}
