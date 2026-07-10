# teslamate-frontend — Design Spec

Date: 2026-07-10
Status: Approved

## Purpose

Standalone companion web app that gives TeslaMate a nicer frontend: a glanceable
live car dashboard plus browsable drive/charge history and aggregate stats.
TeslaMate itself is not modified. Single-user homelab deployment (K3s, behind
existing ingress).

## Constraints

- Read-only against TeslaMate's Postgres database (dedicated read-only DB user).
- Live state via MQTT (mosquitto, topics `teslamate/cars/<car_id>/<field>`).
- No authentication (internal network, behind ingress). Revisit if exposed publicly.
- Units and preferences must match the TeslaMate install by reading TeslaMate's
  `settings` table (length km/mi, temperature C/F).
- One container image; deployable next to existing teslamate manifests in the
  `kubernetes` repo (deployment manifests are out of scope for this PR).

## Architecture

- **Next.js 15 (App Router, TypeScript) + Tailwind CSS 4.**
- **Data layer** (`src/lib/db/`): `pg` connection pool; one query module per
  domain — `cars.ts`, `drives.ts`, `charges.ts`, `stats.ts`, `settings.ts`.
  Server components call these directly; no intermediate REST API.
- **Live layer**: Node runtime route handler `GET /api/live` subscribes to
  mosquitto (`mqtt` package, topic `teslamate/cars/+/+`), maintains an in-memory
  latest-state snapshot per car, and streams updates to browsers via
  Server-Sent Events. Client hook `useLiveCar(carId)` consumes the stream with
  auto-reconnect. Snapshot is sent on connect so the dashboard renders
  immediately.
- **Config** via env: `DATABASE_URL` (read-only user), `MQTT_URL`, optional
  `MQTT_USERNAME`/`MQTT_PASSWORD`.
- **Maps**: MapLibre GL JS with OSM raster tiles.
- **Charts**: Recharts, styled per the dataviz skill at implementation time.

## Pages

| Route | Content |
|---|---|
| `/` | Live dashboard. One card per car: SoC + range, car state, climate (inside/outside temp), locked/sentry/plugged-in flags, odometer, small location map. |
| `/drives` | Paginated drive list: start→end address, duration, distance, avg/max speed, SoC used, efficiency. |
| `/drives/[id]` | Route polyline on map + chart of speed and SoC over the drive. |
| `/charges` | Charging sessions: location, added kWh, cost, duration, charger type. |
| `/charges/[id]` | Charge curve: power and SoC vs time; session facts (cost, kWh added, temperature). |
| `/stats` | Monthly mileage bars, efficiency trend, battery health (range degradation vs odometer), vampire drain. |

Key TeslaMate tables: `cars`, `positions`, `drives`, `charging_processes`,
`charges`, `states`, `settings`, `car_settings`, `addresses`, `geofences`.

## Visual direction — "night garage instrument panel"

- **Palette**: base `#16181D` (deep graphite), panel `#1E2128`, ink `#E8EAED`.
  Signal colors are semantic, mapped to real car states: charging `#3DDC84`,
  driving `#4A9EFF`, sentry `#FFB020`, asleep/offline `#6B7280`. Light mode
  derived from the same tokens.
- **Type**: IBM Plex family via `next/font` — Plex Sans Condensed for large
  telemetry digits (SoC, range, odometer), Plex Sans for body, Plex Mono for
  coordinates, timestamps, VIN.
- **Signature element**: the hero battery bar on each car card — full-width
  horizontal charge bar whose fill color encodes the live car state, with a slow
  shimmer animation only while charging. Everything around it stays quiet.
- Quality floor: responsive to phone width, visible keyboard focus,
  `prefers-reduced-motion` respected.

## Error handling

- Postgres unreachable: page renders with an inline "Can't reach the TeslaMate
  database" panel; no crash, no blank page.
- MQTT unreachable: dashboard renders last-known DB state with a "live updates
  unavailable" notice; SSE client retries with backoff.
- Unknown drive/charge id: 404 page with a link back to the list.

## Testing

- Vitest unit tests for query result shaping, unit conversion/formatting
  (km/mi, C/F, duration, currency), and MQTT message → state snapshot reduction.
- Manual verification against the live TeslaMate database and broker on the
  homelab cluster before opening the PR.

## Delivery

- Repo: new private `github.com/jmcglock/teslamate-frontend`.
- `main` gets scaffold + this spec; implementation lands on `feat/dashboard`;
  PR opened from the branch within the private repo.
- No Claude attribution in commits.
