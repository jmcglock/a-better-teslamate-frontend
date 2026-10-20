import { cached } from "@/lib/cache";
import { num } from "@/lib/format";
import { sinceMonthsSql } from "./range";
import { q } from "./pool";

const PLACE_TTL_MS = 5 * 60_000;

export type PlaceRow = {
  location: string | null;
  visits: string | number;
  energy: string | number | null;
  cost: string | number | null;
  last_visit: Date | null;
};

export type PlaceItem = {
  location: string;
  visits: number;
  energyKwh: number | null;
  cost: number | null;
  lastVisit: string | null;
};

export type DrivePlaceRow = {
  location: string | null;
  visits: string | number;
  distance: string | number | null;
  last_visit: Date | null;
};

export type DrivePlaceItem = {
  location: string;
  visits: number;
  distanceKm: number | null;
  lastVisit: string | null;
};

export type GeofenceRow = {
  id: number;
  name: string;
  latitude: string;
  longitude: string;
  radius: number;
  cost_per_unit: string | null;
  session_fee: string | null;
};

export type GeofenceItem = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  costPerUnit: number | null;
  sessionFee: number | null;
};

export function mapPlaceRow(r: PlaceRow): PlaceItem {
  return {
    location: r.location ?? "Unknown location",
    visits: num(r.visits) ?? 0,
    energyKwh: num(r.energy),
    cost: num(r.cost),
    lastVisit: r.last_visit ? r.last_visit.toISOString() : null,
  };
}

export function mapDrivePlaceRow(r: DrivePlaceRow): DrivePlaceItem {
  return {
    location: r.location ?? "Unknown location",
    visits: num(r.visits) ?? 0,
    distanceKm: num(r.distance),
    lastVisit: r.last_visit ? r.last_visit.toISOString() : null,
  };
}

const HOME_LOCATION = /^home$/i;

export function isHomeLocation(location: string): boolean {
  return HOME_LOCATION.test(location.trim());
}

export type PlaceSpendRollup = {
  ranked: PlaceItem[];
  other: PlaceItem | null;
  home: PlaceItem | null;
  away: { visits: number; energyKwh: number; cost: number };
};

function addSpend(
  total: { visits: number; energyKwh: number; cost: number },
  place: PlaceItem,
) {
  total.visits += place.visits;
  total.energyKwh += place.energyKwh ?? 0;
  total.cost += place.cost ?? 0;
}

/** Top places by cost, with the remainder rolled into Other. Home stays visible. */
export function summarizePlaceSpend(places: PlaceItem[], limit = 6): PlaceSpendRollup {
  const sorted = [...places].sort((a, b) => {
    const byCost = (b.cost ?? 0) - (a.cost ?? 0);
    if (byCost !== 0) return byCost;
    return (b.energyKwh ?? 0) - (a.energyKwh ?? 0);
  });
  const home = sorted.find((place) => isHomeLocation(place.location)) ?? null;
  const away = { visits: 0, energyKwh: 0, cost: 0 };
  for (const place of sorted) {
    if (home && place.location === home.location) continue;
    addSpend(away, place);
  }

  let ranked = sorted.slice(0, limit);
  let tail = sorted.slice(limit);
  if (home && limit > 0 && !ranked.some((place) => place.location === home.location)) {
    const displaced = ranked[ranked.length - 1];
    ranked = [...ranked.slice(0, limit - 1), home];
    tail = [
      ...(displaced ? [displaced] : []),
      ...tail.filter((place) => place.location !== home.location),
    ];
  }

  let other: PlaceItem | null = null;
  if (tail.length > 0) {
    const roll = { visits: 0, energyKwh: 0, cost: 0 };
    for (const place of tail) addSpend(roll, place);
    other = {
      location: "Other",
      visits: roll.visits,
      energyKwh: roll.energyKwh,
      cost: roll.cost,
      lastVisit: null,
    };
  }

  return { ranked, other, home, away };
}

export function mapGeofenceRow(r: GeofenceRow): GeofenceItem {
  return {
    id: r.id,
    name: r.name,
    latitude: num(r.latitude) ?? 0,
    longitude: num(r.longitude) ?? 0,
    radiusM: r.radius,
    costPerUnit: num(r.cost_per_unit),
    sessionFee: num(r.session_fee),
  };
}

/** Top charge locations by visit count. */
export async function topChargePlaces(limit = 25): Promise<PlaceItem[]> {
  const rows = await q<PlaceRow>(
    `
    SELECT COALESCE(g.name, a.city, a.display_name) AS location,
           count(*)::int AS visits,
           sum(cp.charge_energy_added) AS energy,
           sum(cp.cost) AS cost,
           max(cp.start_date) AS last_visit
    FROM charging_processes cp
    LEFT JOIN addresses a ON a.id = cp.address_id
    LEFT JOIN geofences g ON g.id = cp.geofence_id
    WHERE cp.charge_energy_added > 0.1
    GROUP BY 1
    ORDER BY visits DESC, last_visit DESC NULLS LAST
    LIMIT $1
    `,
    [limit],
  );
  return rows.map(mapPlaceRow);
}

/** Charge locations for one car, limited to a calendar window (`null` = all history). */
export async function chargeSpendByPlace(carId: number, months: number | null): Promise<PlaceItem[]> {
  const key = `placeSpend:${carId}:${months ?? "all"}`;
  return cached(key, PLACE_TTL_MS, async () => {
    const params: unknown[] = [carId];
    const rows = await q<PlaceRow>(
      `
      SELECT COALESCE(g.name, a.city, a.display_name) AS location,
             count(*)::int AS visits,
             sum(cp.charge_energy_added) AS energy,
             sum(cp.cost) AS cost,
             max(cp.start_date) AS last_visit
      FROM charging_processes cp
      LEFT JOIN addresses a ON a.id = cp.address_id
      LEFT JOIN geofences g ON g.id = cp.geofence_id
      WHERE cp.car_id = $1 AND cp.charge_energy_added > 0.1${sinceMonthsSql("cp.start_date", months, params)}
      GROUP BY 1
      ORDER BY sum(cp.cost) DESC NULLS LAST, sum(cp.charge_energy_added) DESC NULLS LAST
      `,
      params,
    );
    return rows.map(mapPlaceRow);
  });
}

/** Top drive endpoints (start or end labels combined). */
export async function topDrivePlaces(limit = 25): Promise<DrivePlaceItem[]> {
  const rows = await q<DrivePlaceRow>(
    `
    WITH ends AS (
      SELECT COALESCE(gs.name, sa.city, sa.display_name) AS location, d.start_date AS visit, d.distance
      FROM drives d
      LEFT JOIN addresses sa ON sa.id = d.start_address_id
      LEFT JOIN geofences gs ON gs.id = d.start_geofence_id
      WHERE d.distance > 0.1
      UNION ALL
      SELECT COALESCE(ge.name, ea.city, ea.display_name) AS location, d.start_date AS visit, d.distance
      FROM drives d
      LEFT JOIN addresses ea ON ea.id = d.end_address_id
      LEFT JOIN geofences ge ON ge.id = d.end_geofence_id
      WHERE d.distance > 0.1
    )
    SELECT location,
           count(*)::int AS visits,
           sum(distance) AS distance,
           max(visit) AS last_visit
    FROM ends
    WHERE location IS NOT NULL
    GROUP BY 1
    ORDER BY visits DESC, last_visit DESC NULLS LAST
    LIMIT $1
    `,
    [limit],
  );
  return rows.map(mapDrivePlaceRow);
}

export async function listGeofences(): Promise<GeofenceItem[]> {
  const rows = await q<GeofenceRow>(
    `SELECT id, name, latitude, longitude, radius, cost_per_unit, session_fee
     FROM geofences ORDER BY name`,
  );
  return rows.map(mapGeofenceRow);
}
