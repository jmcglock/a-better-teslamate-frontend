import { num } from "@/lib/format";
import { q } from "./pool";

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
