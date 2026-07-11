# teslamate-frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standalone Next.js companion frontend for TeslaMate: live car dashboard (MQTT/SSE), drive/charge history, and stats, read-only against TeslaMate's Postgres.

**Architecture:** Next.js 15 App Router server components query Postgres directly via `pg`; a Node singleton subscribes to mosquitto and fans live car state out to browsers over SSE. Tailwind 4 with a token system ("night garage instrument panel"). Recharts for charts, MapLibre GL + OSM raster tiles for maps.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS 4, pg 8, mqtt 5, recharts 2.15, maplibre-gl 5, vitest 3, Node 22.

## Global Constraints

- Read-only DB access. Only `SELECT` statements ever. Env: `DATABASE_URL`, `MQTT_URL`, optional `MQTT_USERNAME`, `MQTT_PASSWORD`.
- TeslaMate stores km and °C. Convert for display per TeslaMate `settings` table (`unit_of_length` km|mi, `unit_of_temperature` C|F, `preferred_range` ideal|rated).
- `pg` returns Postgres `decimal`/`numeric` as **strings**. Every row mapper converts with `num()` before use.
- Design tokens (validated with the dataviz palette validator on 2026-07-10 — do not change without re-running it):
  - Dark (default): bg `#16181D`, panel `#1E2128`, ink `#E8EAED`, ink-2 `#9AA0AC`, line `#2A2E37`; states: charging `#3DDC84`, driving `#4A9EFF`, sentry `#FFB020`, idle/asleep `#6B7280`, updating `#8B6FE8`; charts: blue `#2E7FE0`, green `#1EA65F`, orange `#CC7612`, violet `#8B6FE8`.
  - Light: bg `#F5F6F8`, panel `#FFFFFF`, ink `#1A1D23`, ink-2 `#5A6070`, line `#E2E4EA`; states: charging `#188F52`, driving `#2465C2`, sentry `#B25E00`, idle `#6B7280`, updating `#6D4FD2`; charts: same as dark except green `#188F52`.
- Chart rules (dataviz skill): never two y-scales on one chart — two measures = two stacked panels with a shared/synced x-axis; single-series panels get no legend (the title names the series); thin marks, 4px rounded bar ends, 2px lines, recessive grid; crosshair/tooltip on every plot; text always in ink tokens, never series color.
- Series colors follow the entity everywhere: SoC = green, speed = blue, power = orange, efficiency = violet, mileage = blue, projected range = green, vampire drain = orange.
- Type: IBM Plex Sans (body), IBM Plex Sans Condensed (large telemetry digits), IBM Plex Mono (timestamps, coordinates, VIN) via `next/font/google`.
- Copy: sentence case, plain verbs, no filler. Errors say what happened and what to do.
- Commits: Conventional Commits, no AI attribution, no Co-Authored-By.
- All work on branch `feat/dashboard`.
- Quality floor: responsive to 375px, visible keyboard focus, `prefers-reduced-motion` respected.

## MQTT reference (from teslamate source, `lib/teslamate/mqtt/pubsub/vehicle_subscriber.ex`)

Topics `teslamate/cars/<car_id>/<field>`, retained, values are plain strings (`to_string`), datetimes ISO8601, empty string = nil. `state` values: `online`, `asleep`, `offline`, `charging`, `driving`, `suspended`, `updating`.

## DB reference (exact TeslaMate column names)

- `cars`: id, name, model, marketing_name, trim_badging, exterior_color, efficiency (float, kWh/km), vin, display_priority
- `positions`: id, date, latitude, longitude, elevation, speed (int, km/h), power, odometer (float, km), battery_level, usable_battery_level, rated_battery_range_km, ideal_battery_range_km, inside_temp, outside_temp, drive_id, car_id
- `drives`: id, car_id, start_date, end_date, distance (float, km), duration_min, speed_max, power_max, start_km, end_km, start_rated_range_km, end_rated_range_km, start_ideal_range_km, end_ideal_range_km, start_address_id, end_address_id, start_geofence_id, end_geofence_id, start_position_id, end_position_id, outside_temp_avg
- `charging_processes`: id, car_id, start_date, end_date, charge_energy_added (kWh), charge_energy_used, cost, duration_min, start_battery_level, end_battery_level, start_rated_range_km, end_rated_range_km, address_id, geofence_id, position_id, outside_temp_avg
- `charges`: id, charging_process_id, date, battery_level, usable_battery_level, charger_power (int, kW), charger_voltage, charger_actual_current, charger_phases, rated_battery_range_km, outside_temp
- `states`: id, car_id, state (online|asleep|offline), start_date, end_date
- `addresses`: id, display_name, name, city, road, house_number
- `geofences`: id, name, latitude, longitude, radius
- `settings`: unit_of_length, unit_of_temperature, unit_of_pressure, preferred_range, base_url, grafana_url

---

### Task 1: Scaffold — configs, tokens, fonts, layout, nav

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`
- Create: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx` (placeholder), `src/components/Nav.tsx`

**Interfaces:**
- Produces: CSS custom properties listed in Global Constraints (`--bg`, `--panel`, `--ink`, `--ink-2`, `--line`, `--state-*`, `--chart-*`), font CSS vars `--font-sans`, `--font-cond`, `--font-mono`, and Tailwind theme aliases (`bg-panel`, `text-ink`, `text-ink-2`, `border-line`). All later tasks style against these.

- [ ] **Step 1: Branch**

```bash
cd ~/Documents/github/teslamate-frontend && git switch -c feat/dashboard
```

- [ ] **Step 2: Write config files**

`package.json`:

```json
{
  "name": "teslamate-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "maplibre-gl": "^5.6.0",
    "mqtt": "^5.13.0",
    "next": "^15.3.4",
    "pg": "^8.16.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "recharts": "^2.15.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.10",
    "@types/node": "^22",
    "@types/pg": "^8.15.0",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4.1.10",
    "typescript": "^5.8.0",
    "vitest": "^3.2.0"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

`postcss.config.mjs`:

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

`.gitignore`:

```
node_modules/
.next/
out/
*.tsbuildinfo
next-env.d.ts
.env*.local
.env
```

`.env.example`:

```
DATABASE_URL=postgres://teslamate_ro:password@localhost:5432/teslamate
MQTT_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=
```

- [ ] **Step 3: Write `src/app/globals.css`**

```css
@import "tailwindcss";

:root {
  --bg: #f5f6f8;
  --panel: #ffffff;
  --ink: #1a1d23;
  --ink-2: #5a6070;
  --line: #e2e4ea;
  --state-charging: #188f52;
  --state-driving: #2465c2;
  --state-sentry: #b25e00;
  --state-idle: #6b7280;
  --state-updating: #6d4fd2;
  --chart-blue: #2e7fe0;
  --chart-green: #188f52;
  --chart-orange: #cc7612;
  --chart-violet: #8b6fe8;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #16181d;
    --panel: #1e2128;
    --ink: #e8eaed;
    --ink-2: #9aa0ac;
    --line: #2a2e37;
    --state-charging: #3ddc84;
    --state-driving: #4a9eff;
    --state-sentry: #ffb020;
    --state-idle: #6b7280;
    --state-updating: #8b6fe8;
    --chart-green: #1ea65f;
  }
}

@theme inline {
  --color-bg: var(--bg);
  --color-panel: var(--panel);
  --color-ink: var(--ink);
  --color-ink-2: var(--ink-2);
  --color-line: var(--line);
  --font-sans: var(--font-sans);
  --font-cond: var(--font-cond);
  --font-mono: var(--font-mono);
}

body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-sans), system-ui, sans-serif;
}

:focus-visible {
  outline: 2px solid var(--state-driving);
  outline-offset: 2px;
}

/* Signature: battery bar */
.battery-bar {
  position: relative;
  height: 28px;
  border-radius: 6px;
  background: color-mix(in oklab, var(--ink) 8%, transparent);
  overflow: hidden;
}
.battery-bar-fill {
  height: 100%;
  border-radius: 6px 0 0 6px;
  background: var(--state-idle);
  transition: width 0.6s ease;
}
.battery-bar-fill[data-state="charging"] { background: var(--state-charging); }
.battery-bar-fill[data-state="driving"] { background: var(--state-driving); }
.battery-bar-fill[data-state="updating"] { background: var(--state-updating); }
.battery-bar-fill[data-state="online"] { background: color-mix(in oklab, var(--state-driving) 55%, var(--state-idle)); }
.battery-bar-fill[data-state="charging"]::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 30%, rgb(255 255 255 / 0.14) 50%, transparent 70%);
  animation: shimmer 2.8s linear infinite;
}
.battery-bar-limit {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--ink-2);
  opacity: 0.7;
}
@keyframes shimmer {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .battery-bar-fill { transition: none; }
  .battery-bar-fill[data-state="charging"]::after { animation: none; }
}
```

- [ ] **Step 4: Write `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed, IBM_Plex_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const cond = IBM_Plex_Sans_Condensed({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-cond" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = { title: "TeslaMate", description: "Companion dashboard for TeslaMate" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${cond.variable} ${mono.variable}`}>
      <body>
        <Nav />
        <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Write `src/components/Nav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/drives", label: "Drives" },
  { href: "/charges", label: "Charges" },
  { href: "/stats", label: "Stats" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-line bg-panel">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
        <span className="mr-4 font-[family-name:var(--font-mono)] text-sm font-medium tracking-widest text-ink">
          TESLAMATE
        </span>
        {links.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm ${
                active ? "bg-[color-mix(in_oklab,var(--ink)_10%,transparent)] text-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
```

- [ ] **Step 6: Placeholder `src/app/page.tsx`**

```tsx
export default function Page() {
  return <p className="text-ink-2">Dashboard coming in Task 5.</p>;
}
```

- [ ] **Step 7: Install and verify build**

```bash
npm install
npm run build
```

Expected: build succeeds (placeholder page renders).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js app with design tokens and nav"
```

---

### Task 2: Units and formatting library (TDD)

**Files:**
- Create: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Produces:
  - `type LengthUnit = "km" | "mi"; type TempUnit = "C" | "F";`
  - `num(v: string | number | null | undefined): number | null` — pg decimal-string → number
  - `kmToUnit(km: number, unit: LengthUnit): number`
  - `formatDistance(km: number | null, unit: LengthUnit, digits?: number): string` → `"12.3 km"`
  - `formatSpeed(kmh: number | null, unit: LengthUnit): string` → `"110 km/h"` / `"68 mph"`
  - `formatTemp(c: number | null, unit: TempUnit): string` → `"21.5 °C"` / `"70.7 °F"`
  - `formatDuration(min: number | null): string` → `"45 min"`, `"2 h 05 min"`
  - `formatEnergy(kwh: number | null): string` → `"12.4 kWh"`
  - `formatPower(kw: number | null): string` → `"11 kW"`
  - `formatPct(v: number | null): string` → `"82%"`
  - `formatOdometer(km: number | null, unit: LengthUnit): string` → `"34,567 km"` (rounded, grouped)
  - All formatters return `"–"` for null input.

- [ ] **Step 1: Write the failing test `src/lib/format.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  formatDistance, formatDuration, formatEnergy, formatOdometer, formatPct,
  formatPower, formatSpeed, formatTemp, kmToUnit, num,
} from "@/lib/format";

describe("num", () => {
  it("parses pg decimal strings", () => expect(num("12.50")).toBe(12.5));
  it("passes numbers through", () => expect(num(7)).toBe(7));
  it("null for null/undefined/garbage", () => {
    expect(num(null)).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num("abc")).toBeNull();
  });
});

describe("units", () => {
  it("km→mi", () => expect(kmToUnit(160.9344, "mi")).toBeCloseTo(100, 4));
  it("km identity", () => expect(kmToUnit(42, "km")).toBe(42));
});

describe("formatters", () => {
  it("distance km", () => expect(formatDistance(12.34, "km")).toBe("12.3 km"));
  it("distance mi", () => expect(formatDistance(16.09344, "mi")).toBe("10.0 mi"));
  it("speed", () => expect(formatSpeed(110, "mi")).toBe("68 mph"));
  it("temp C", () => expect(formatTemp(21.5, "C")).toBe("21.5 °C"));
  it("temp F", () => expect(formatTemp(20, "F")).toBe("68.0 °F"));
  it("duration under an hour", () => expect(formatDuration(45)).toBe("45 min"));
  it("duration over an hour", () => expect(formatDuration(125)).toBe("2 h 05 min"));
  it("energy", () => expect(formatEnergy(12.44)).toBe("12.4 kWh"));
  it("power", () => expect(formatPower(11.2)).toBe("11 kW"));
  it("pct", () => expect(formatPct(82)).toBe("82%"));
  it("odometer grouped", () => expect(formatOdometer(34567.2, "km")).toBe("34,567 km"));
  it("null → dash", () => expect(formatDistance(null, "km")).toBe("–"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — cannot resolve `@/lib/format`.

- [ ] **Step 3: Write `src/lib/format.ts`**

```ts
export type LengthUnit = "km" | "mi";
export type TempUnit = "C" | "F";

export const KM_PER_MI = 1.609344;
const DASH = "–";

export function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function kmToUnit(km: number, unit: LengthUnit): number {
  return unit === "mi" ? km / KM_PER_MI : km;
}

export function formatDistance(km: number | null, unit: LengthUnit, digits = 1): string {
  if (km === null) return DASH;
  return `${kmToUnit(km, unit).toFixed(digits)} ${unit}`;
}

export function formatSpeed(kmh: number | null, unit: LengthUnit): string {
  if (kmh === null) return DASH;
  return unit === "mi" ? `${Math.round(kmh / KM_PER_MI)} mph` : `${Math.round(kmh)} km/h`;
}

export function formatTemp(c: number | null, unit: TempUnit): string {
  if (c === null) return DASH;
  const v = unit === "F" ? c * 1.8 + 32 : c;
  return `${v.toFixed(1)} °${unit}`;
}

export function formatDuration(min: number | null): string {
  if (min === null) return DASH;
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

export function formatEnergy(kwh: number | null): string {
  return kwh === null ? DASH : `${kwh.toFixed(1)} kWh`;
}

export function formatPower(kw: number | null): string {
  return kw === null ? DASH : `${Math.round(kw)} kW`;
}

export function formatPct(v: number | null): string {
  return v === null ? DASH : `${Math.round(v)}%`;
}

export function formatOdometer(km: number | null, unit: LengthUnit): string {
  if (km === null) return DASH;
  return `${Math.round(kmToUnit(km, unit)).toLocaleString("en-US")} ${unit}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts && git commit -m "feat: unit conversion and formatting helpers"
```

---

### Task 3: DB layer — pool, settings, cars (TDD on mappers)

**Files:**
- Create: `src/lib/db/pool.ts`, `src/lib/db/settings.ts`, `src/lib/db/cars.ts`
- Test: `src/lib/db/cars.test.ts`

**Interfaces:**
- Consumes: `num` from Task 2.
- Produces:
  - `q<T>(text: string, params?: unknown[]): Promise<T[]>` (pool.ts)
  - `safe<T>(p: Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }>` (pool.ts)
  - `getSettings(): Promise<Settings>` where `type Settings = { unitOfLength: "km" | "mi"; unitOfTemperature: "C" | "F"; preferredRange: "ideal" | "rated" }` (defaults km/C/rated if table empty)
  - `listCarCards(): Promise<CarCard[]>` and pure `mapCarRow(row: CarRow): CarCard` where

    ```ts
    type CarCard = {
      id: number; name: string; model: string | null; marketingName: string | null;
      state: string; batteryLevel: number | null; usableBatteryLevel: number | null;
      ratedRangeKm: number | null; idealRangeKm: number | null; odometerKm: number | null;
      insideTempC: number | null; outsideTempC: number | null;
      latitude: number | null; longitude: number | null; positionDate: string | null;
    };
    ```

- [ ] **Step 1: Write `src/lib/db/pool.ts`**

```ts
import { Pool } from "pg";

const g = globalThis as unknown as { pgPool?: Pool };

export const pool =
  g.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 4000,
  });
g.pgPool = pool;

export async function q<T extends object>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function safe<T>(p: Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await p };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
```

- [ ] **Step 2: Write `src/lib/db/settings.ts`**

```ts
import { q } from "./pool";

export type Settings = {
  unitOfLength: "km" | "mi";
  unitOfTemperature: "C" | "F";
  preferredRange: "ideal" | "rated";
};

type Row = { unit_of_length: string | null; unit_of_temperature: string | null; preferred_range: string | null };

export async function getSettings(): Promise<Settings> {
  const rows = await q<Row>("SELECT unit_of_length, unit_of_temperature, preferred_range FROM settings LIMIT 1");
  const r = rows[0];
  return {
    unitOfLength: r?.unit_of_length === "mi" ? "mi" : "km",
    unitOfTemperature: r?.unit_of_temperature === "F" ? "F" : "C",
    preferredRange: r?.preferred_range === "ideal" ? "ideal" : "rated",
  };
}
```

- [ ] **Step 3: Write failing mapper test `src/lib/db/cars.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { mapCarRow, type CarRow } from "@/lib/db/cars";

const row: CarRow = {
  id: 1, name: "Panther", model: "3", marketing_name: "LR AWD",
  latitude: "37.4", longitude: "-122.1", battery_level: 72, usable_battery_level: 71,
  rated_battery_range_km: "312.5", ideal_battery_range_km: "330.1", odometer: 34567.2,
  inside_temp: "21.5", outside_temp: "18.0",
  position_date: new Date("2026-07-10T15:00:00Z"), db_state: "online",
};

describe("mapCarRow", () => {
  it("converts decimal strings and dates", () => {
    const c = mapCarRow(row);
    expect(c.ratedRangeKm).toBeCloseTo(312.5);
    expect(c.latitude).toBeCloseTo(37.4);
    expect(c.positionDate).toBe("2026-07-10T15:00:00.000Z");
    expect(c.state).toBe("online");
  });
  it("nulls survive", () => {
    const c = mapCarRow({ ...row, inside_temp: null, position_date: null, db_state: null });
    expect(c.insideTempC).toBeNull();
    expect(c.positionDate).toBeNull();
    expect(c.state).toBe("offline");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/lib/db/cars.test.ts`
Expected: FAIL — `mapCarRow` not defined.

- [ ] **Step 5: Write `src/lib/db/cars.ts`**

```ts
import { num } from "@/lib/format";
import { q } from "./pool";

export type CarRow = {
  id: number; name: string | null; model: string | null; marketing_name: string | null;
  latitude: string | null; longitude: string | null;
  battery_level: number | null; usable_battery_level: number | null;
  rated_battery_range_km: string | null; ideal_battery_range_km: string | null;
  odometer: number | null; inside_temp: string | null; outside_temp: string | null;
  position_date: Date | null; db_state: string | null;
};

export type CarCard = {
  id: number; name: string; model: string | null; marketingName: string | null;
  state: string; batteryLevel: number | null; usableBatteryLevel: number | null;
  ratedRangeKm: number | null; idealRangeKm: number | null; odometerKm: number | null;
  insideTempC: number | null; outsideTempC: number | null;
  latitude: number | null; longitude: number | null; positionDate: string | null;
};

export function mapCarRow(r: CarRow): CarCard {
  return {
    id: r.id,
    name: r.name ?? `Car ${r.id}`,
    model: r.model,
    marketingName: r.marketing_name,
    state: r.db_state ?? "offline",
    batteryLevel: r.battery_level,
    usableBatteryLevel: r.usable_battery_level,
    ratedRangeKm: num(r.rated_battery_range_km),
    idealRangeKm: num(r.ideal_battery_range_km),
    odometerKm: r.odometer,
    insideTempC: num(r.inside_temp),
    outsideTempC: num(r.outside_temp),
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    positionDate: r.position_date ? r.position_date.toISOString() : null,
  };
}

export async function listCarCards(): Promise<CarCard[]> {
  const rows = await q<CarRow>(`
    SELECT c.id, c.name, c.model, c.marketing_name,
           p.latitude, p.longitude, p.battery_level, p.usable_battery_level,
           p.rated_battery_range_km, p.ideal_battery_range_km, p.odometer,
           p.inside_temp, p.outside_temp, p.date AS position_date,
           (SELECT s.state FROM states s WHERE s.car_id = c.id ORDER BY s.start_date DESC LIMIT 1) AS db_state
    FROM cars c
    LEFT JOIN LATERAL (
      SELECT * FROM positions p WHERE p.car_id = c.id ORDER BY p.date DESC LIMIT 1
    ) p ON true
    ORDER BY c.display_priority NULLS LAST, c.id
  `);
  return rows.map(mapCarRow);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/db/cars.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db && git commit -m "feat: pg pool, settings, and car card queries"
```

---

### Task 4: Live layer — MQTT snapshot reducer (TDD), bridge, SSE route, client hook

**Files:**
- Create: `src/lib/live/snapshot.ts`, `src/lib/live/bridge.ts`, `src/app/api/live/route.ts`, `src/lib/live/useLive.ts`
- Test: `src/lib/live/snapshot.test.ts`

**Interfaces:**
- Produces:
  - `type CarSnapshot = Record<string, string | number | boolean | null>`
  - `applyMessage(snap: CarSnapshot, field: string, payload: string): CarSnapshot` (pure, returns new object)
  - `parseTopic(topic: string): { carId: number; field: string } | null`
  - `getBridge(): MqttBridge` with `getSnapshots(): Array<[number, CarSnapshot]>`, EventEmitter event `"update"` → `(carId: number, snap: CarSnapshot)`
  - `GET /api/live` — SSE, each event `data: {"carId":1,"snapshot":{...}}`
  - `useLive(): { snaps: Record<number, CarSnapshot>; connected: boolean }` client hook (`connected` false after an EventSource error, true again on reopen — feeds the "live updates unavailable" notice)

- [ ] **Step 1: Write failing test `src/lib/live/snapshot.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { applyMessage, parseTopic } from "@/lib/live/snapshot";

describe("parseTopic", () => {
  it("parses car id and field", () =>
    expect(parseTopic("teslamate/cars/1/battery_level")).toEqual({ carId: 1, field: "battery_level" }));
  it("rejects other topics", () => expect(parseTopic("teslamate/other/1/x")).toBeNull());
});

describe("applyMessage", () => {
  it("parses numeric fields", () =>
    expect(applyMessage({}, "battery_level", "72").battery_level).toBe(72));
  it("parses booleans", () => expect(applyMessage({}, "locked", "true").locked).toBe(true));
  it("keeps strings", () => expect(applyMessage({}, "state", "driving").state).toBe("driving"));
  it("empty payload → null", () => expect(applyMessage({}, "shift_state", "").shift_state).toBeNull());
  it("does not mutate input", () => {
    const a = { state: "online" };
    const b = applyMessage(a, "state", "driving");
    expect(a.state).toBe("online");
    expect(b.state).toBe("driving");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/live/snapshot.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write `src/lib/live/snapshot.ts`**

```ts
export type CarSnapshot = Record<string, string | number | boolean | null>;

const NUMERIC = new Set([
  "battery_level", "usable_battery_level", "charge_limit_soc", "charger_power",
  "charger_actual_current", "charger_voltage", "charger_phases", "speed", "power",
  "odometer", "latitude", "longitude", "heading", "elevation", "inside_temp",
  "outside_temp", "rated_battery_range_km", "ideal_battery_range_km",
  "est_battery_range_km", "charge_energy_added", "time_to_full_charge",
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/live/snapshot.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `src/lib/live/bridge.ts`**

```ts
import { EventEmitter } from "node:events";
import mqtt, { type MqttClient } from "mqtt";
import { applyMessage, parseTopic, type CarSnapshot } from "./snapshot";

export class MqttBridge extends EventEmitter {
  private snapshots = new Map<number, CarSnapshot>();
  private client: MqttClient;
  connected = false;

  constructor(url: string) {
    super();
    this.setMaxListeners(50);
    this.client = mqtt.connect(url, {
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
      reconnectPeriod: 5000,
    });
    this.client.on("connect", () => {
      this.connected = true;
      this.client.subscribe("teslamate/cars/+/+");
    });
    this.client.on("close", () => { this.connected = false; });
    this.client.on("message", (topic, payload) => {
      const parsed = parseTopic(topic);
      if (!parsed) return;
      const prev = this.snapshots.get(parsed.carId) ?? {};
      const next = applyMessage(prev, parsed.field, payload.toString());
      this.snapshots.set(parsed.carId, next);
      this.emit("update", parsed.carId, next);
    });
  }

  getSnapshots(): Array<[number, CarSnapshot]> {
    return [...this.snapshots.entries()];
  }
}

const g = globalThis as unknown as { mqttBridge?: MqttBridge };

export function getBridge(): MqttBridge {
  if (!g.mqttBridge) g.mqttBridge = new MqttBridge(process.env.MQTT_URL ?? "mqtt://localhost:1883");
  return g.mqttBridge;
}
```

- [ ] **Step 6: Write `src/app/api/live/route.ts`**

```ts
import { getBridge } from "@/lib/live/bridge";
import type { CarSnapshot } from "@/lib/live/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const bridge = getBridge();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (carId: number, snapshot: CarSnapshot) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ carId, snapshot })}\n\n`));

      for (const [carId, snap] of bridge.getSnapshots()) send(carId, snap);

      const onUpdate = (carId: number, snap: CarSnapshot) => send(carId, snap);
      bridge.on("update", onUpdate);

      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 25000);

      req.signal.addEventListener("abort", () => {
        bridge.off("update", onUpdate);
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 7: Write `src/lib/live/useLive.ts`**

```ts
"use client";

import { useEffect, useState } from "react";
import type { CarSnapshot } from "./snapshot";

export function useLive(): { snaps: Record<number, CarSnapshot>; connected: boolean } {
  const [snaps, setSnaps] = useState<Record<number, CarSnapshot>>({});
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const es = new EventSource("/api/live");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      const { carId, snapshot } = JSON.parse(ev.data) as { carId: number; snapshot: CarSnapshot };
      setSnaps((prev) => ({ ...prev, [carId]: snapshot }));
    };
    return () => es.close();
  }, []);

  return { snaps, connected };
}
```

- [ ] **Step 8: Full test run + build**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/lib/live src/app/api && git commit -m "feat: MQTT bridge with SSE fan-out and client hook"
```

---

### Task 5: Live dashboard — BatteryBar, StateBadge, MiniMap, CarCard, page

**Files:**
- Create: `src/components/BatteryBar.tsx`, `src/components/StateBadge.tsx`, `src/components/MiniMap.tsx`, `src/components/CarCard.tsx`, `src/components/DataUnavailable.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `listCarCards`, `getSettings`, `safe` (Task 3); `useLive`, `CarSnapshot` (Task 4); formatters (Task 2).
- Produces: `<DataUnavailable service="database" | "live updates" detail?>` reused by every later page.

- [ ] **Step 1: Write `src/components/StateBadge.tsx`**

```tsx
const STATE_COLOR: Record<string, string> = {
  charging: "var(--state-charging)",
  driving: "var(--state-driving)",
  updating: "var(--state-updating)",
  online: "var(--state-driving)",
};

const STATE_LABEL: Record<string, string> = {
  charging: "Charging",
  driving: "Driving",
  updating: "Updating",
  online: "Online",
  asleep: "Asleep",
  suspended: "Falling asleep",
  offline: "Offline",
};

export default function StateBadge({ state }: { state: string }) {
  const color = STATE_COLOR[state] ?? "var(--state-idle)";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-2">
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: color }} />
      {STATE_LABEL[state] ?? state}
    </span>
  );
}
```

- [ ] **Step 2: Write `src/components/BatteryBar.tsx`** (the signature element)

```tsx
export default function BatteryBar({
  soc, state, chargeLimit,
}: { soc: number | null; state: string; chargeLimit?: number | null }) {
  const pct = soc ?? 0;
  return (
    <div
      className="battery-bar"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={soc ?? undefined}
      aria-label={soc === null ? "Battery level unknown" : `Battery ${pct}%`}
    >
      <div className="battery-bar-fill" data-state={state} style={{ width: `${pct}%` }} />
      {chargeLimit != null && chargeLimit > 0 && chargeLimit < 100 && (
        <div aria-hidden className="battery-bar-limit" style={{ left: `${chargeLimit}%` }} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `src/components/MiniMap.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

export default function MiniMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = new maplibregl.Map({
      container: el.current,
      style: OSM_STYLE,
      center: [longitude, latitude],
      zoom: 13,
      interactive: false,
      attributionControl: { compact: true },
    });
    marker.current = new maplibregl.Marker({ color: "#4A9EFF" })
      .setLngLat([longitude, latitude])
      .addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    marker.current?.setLngLat([longitude, latitude]);
    map.current?.setCenter([longitude, latitude]);
  }, [latitude, longitude]);

  return <div ref={el} className="h-40 w-full overflow-hidden rounded-md border border-line" />;
}
```

- [ ] **Step 4: Write `src/components/DataUnavailable.tsx`**

```tsx
export default function DataUnavailable({ service, detail }: { service: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-6">
      <p className="font-medium">Can’t reach the TeslaMate {service}</p>
      <p className="mt-1 text-sm text-ink-2">
        {detail ?? "Check that the service is running and the connection settings are correct, then reload."}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Write `src/components/CarCard.tsx`** (client; merges DB initial + live)

```tsx
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
```

- [ ] **Step 6: Rewrite `src/app/page.tsx`**

```tsx
import CarCard from "@/components/CarCard";
import DataUnavailable from "@/components/DataUnavailable";
import { listCarCards } from "@/lib/db/cars";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const res = await safe(Promise.all([listCarCards(), getSettings()]));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [cars, settings] = res.data;

  if (cars.length === 0) {
    return <DataUnavailable service="database" detail="No cars found. Sign in to TeslaMate first." />;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {cars.map((car) => (
        <CarCard key={car.id} initial={car} settings={settings} />
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: succeeds. (Live DB not needed for build; pages are dynamic.)

- [ ] **Step 8: Commit**

```bash
git add src/components src/app/page.tsx && git commit -m "feat: live dashboard with battery-bar car cards"
```

---

### Task 6: Charts plumbing — colors hook + panels

**Files:**
- Create: `src/components/charts/useChartColors.ts`, `src/components/charts/TimeSeriesPanel.tsx`, `src/components/charts/BarPanel.tsx`

**Interfaces:**
- Produces:
  - `useChartColors(): { blue: string; green: string; orange: string; violet: string; ink2: string; line: string }` — resolved from CSS vars, updates on theme change
  - `<TimeSeriesPanel title unit data color syncId? yDomain? formatValue?>` with `data: { t: number; v: number | null }[]` (t = epoch ms)
  - `<BarPanel title unit data color formatValue?>` with `data: { label: string; v: number }[]`

- [ ] **Step 1: Write `src/components/charts/useChartColors.ts`**

```ts
"use client";

import { useEffect, useState } from "react";

export type ChartColors = { blue: string; green: string; orange: string; violet: string; ink2: string; line: string };

const DARK: ChartColors = {
  blue: "#2e7fe0", green: "#1ea65f", orange: "#cc7612", violet: "#8b6fe8",
  ink2: "#9aa0ac", line: "#2a2e37",
};

function read(): ChartColors {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    blue: v("--chart-blue", DARK.blue),
    green: v("--chart-green", DARK.green),
    orange: v("--chart-orange", DARK.orange),
    violet: v("--chart-violet", DARK.violet),
    ink2: v("--ink-2", DARK.ink2),
    line: v("--line", DARK.line),
  };
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(DARK);
  useEffect(() => {
    setColors(read());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setColors(read());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return colors;
}
```

- [ ] **Step 2: Write `src/components/charts/TimeSeriesPanel.tsx`**

```tsx
"use client";

import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useChartColors } from "./useChartColors";

type Point = { t: number; v: number | null };

function fmtTime(t: number): string {
  return new Date(t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function TimeSeriesPanel({
  title, unit, data, color, syncId, yDomain, formatValue, formatTick,
}: {
  title: string; unit: string; data: Point[]; color: string;
  syncId?: string; yDomain?: [number, number];
  formatValue?: (v: number) => string; formatTick?: (t: number) => string;
}) {
  const c = useChartColors();
  const fmt = formatValue ?? ((v: number) => `${Math.round(v)} ${unit}`);
  const tick = formatTick ?? fmtTime;
  return (
    <figure className="rounded-lg border border-line bg-panel p-4">
      <figcaption className="mb-2 text-sm font-medium">
        {title} <span className="text-xs text-ink-2">({unit})</span>
      </figcaption>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} syncId={syncId} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={c.line} vertical={false} />
          <XAxis
            dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time"
            tickFormatter={tick} tick={{ fill: c.ink2, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.line }}
          />
          <YAxis
            domain={yDomain ?? ["auto", "auto"]} tick={{ fill: c.ink2, fontSize: 11 }}
            tickLine={false} axisLine={false} width={46}
          />
          <Tooltip
            labelFormatter={(t) => tick(Number(t))}
            formatter={(v) => [fmt(Number(v)), title]}
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--ink)" }}
          />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
```

- [ ] **Step 3: Write `src/components/charts/BarPanel.tsx`**

```tsx
"use client";

import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useChartColors } from "./useChartColors";

export default function BarPanel({
  title, unit, data, color, formatValue,
}: {
  title: string; unit: string; data: { label: string; v: number }[]; color: string;
  formatValue?: (v: number) => string;
}) {
  const c = useChartColors();
  const fmt = formatValue ?? ((v: number) => `${Math.round(v)} ${unit}`);
  return (
    <figure className="rounded-lg border border-line bg-panel p-4">
      <figcaption className="mb-2 text-sm font-medium">
        {title} <span className="text-xs text-ink-2">({unit})</span>
      </figcaption>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }} barCategoryGap="25%">
          <CartesianGrid stroke={c.line} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: c.ink2, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.line }} />
          <YAxis tick={{ fill: c.ink2, fontSize: 11 }} tickLine={false} axisLine={false} width={46} />
          <Tooltip
            formatter={(v) => [fmt(Number(v)), title]} cursor={{ fill: "rgb(127 127 127 / 0.08)" }}
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--ink)" }}
          />
          <Bar dataKey="v" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
```

- [ ] **Step 4: Build + commit**

Run: `npm run build` — expected: succeeds.

```bash
git add src/components/charts && git commit -m "feat: theme-aware chart panels"
```

---

### Task 7: Drives — queries (TDD), list page, detail page with route map

**Files:**
- Create: `src/lib/db/drives.ts`, `src/components/RouteMap.tsx`, `src/app/drives/page.tsx`, `src/app/drives/[id]/page.tsx`
- Test: `src/lib/db/drives.test.ts`

**Interfaces:**
- Consumes: `q`, `safe`, `getSettings`, formatters, `TimeSeriesPanel`, `OSM_STYLE`.
- Produces:
  - `listDrives(page: number, pageSize?: number): Promise<DriveListItem[]>`
  - `getDrive(id: number): Promise<DriveDetail | null>` — facts + `points: DrivePoint[]`
  - `mapDriveRow`, `mapDrivePoint` (pure, tested)

    ```ts
    type DriveListItem = {
      id: number; startDate: string; distanceKm: number | null; durationMin: number | null;
      speedMaxKmh: number | null; startLabel: string; endLabel: string; rangeUsedKm: number | null;
    };
    type DrivePoint = { t: number; speed: number | null; soc: number | null; lat: number; lon: number };
    type DriveDetail = Omit<DriveListItem, never> & { endDate: string | null; outsideTempAvgC: number | null; points: DrivePoint[] };
    ```

- [ ] **Step 1: Write failing test `src/lib/db/drives.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { mapDriveRow, mapDrivePoint } from "@/lib/db/drives";

describe("mapDriveRow", () => {
  it("converts decimals and labels", () => {
    const d = mapDriveRow({
      id: 9, start_date: new Date("2026-07-01T08:00:00Z"), end_date: new Date("2026-07-01T08:30:00Z"),
      distance: 21.7, duration_min: 30, speed_max: 118,
      range_used_km: "14.2", start_label: "Home", end_label: null, outside_temp_avg: "17.5",
    });
    expect(d.rangeUsedKm).toBeCloseTo(14.2);
    expect(d.endLabel).toBe("Unknown location");
    expect(d.startDate).toBe("2026-07-01T08:00:00.000Z");
  });
});

describe("mapDrivePoint", () => {
  it("epoch ms + numeric soc", () => {
    const p = mapDrivePoint({
      date: new Date("2026-07-01T08:10:00Z"), speed: 88, battery_level: 64,
      latitude: "37.4", longitude: "-122.1",
    });
    expect(p.t).toBe(Date.parse("2026-07-01T08:10:00Z"));
    expect(p.soc).toBe(64);
    expect(p.lat).toBeCloseTo(37.4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/drives.test.ts` — expected FAIL, module missing.

- [ ] **Step 3: Write `src/lib/db/drives.ts`**

```ts
import { num } from "@/lib/format";
import { q } from "./pool";

export type DriveRow = {
  id: number; start_date: Date; end_date: Date | null;
  distance: number | null; duration_min: number | null; speed_max: number | null;
  range_used_km: string | null; start_label: string | null; end_label: string | null;
  outside_temp_avg: string | null;
};

export type DriveListItem = {
  id: number; startDate: string; endDate: string | null;
  distanceKm: number | null; durationMin: number | null; speedMaxKmh: number | null;
  rangeUsedKm: number | null; startLabel: string; endLabel: string; outsideTempAvgC: number | null;
};

export type PointRow = {
  date: Date; speed: number | null; battery_level: number | null;
  latitude: string; longitude: string;
};

export type DrivePoint = { t: number; speed: number | null; soc: number | null; lat: number; lon: number };

export type DriveDetail = DriveListItem & { points: DrivePoint[] };

export function mapDriveRow(r: DriveRow): DriveListItem {
  return {
    id: r.id,
    startDate: r.start_date.toISOString(),
    endDate: r.end_date ? r.end_date.toISOString() : null,
    distanceKm: r.distance,
    durationMin: r.duration_min,
    speedMaxKmh: r.speed_max,
    rangeUsedKm: num(r.range_used_km),
    startLabel: r.start_label ?? "Unknown location",
    endLabel: r.end_label ?? "Unknown location",
    outsideTempAvgC: num(r.outside_temp_avg),
  };
}

export function mapDrivePoint(r: PointRow): DrivePoint {
  return {
    t: r.date.getTime(),
    speed: r.speed,
    soc: r.battery_level,
    lat: num(r.latitude) ?? 0,
    lon: num(r.longitude) ?? 0,
  };
}

const DRIVE_SELECT = `
  SELECT d.id, d.start_date, d.end_date, d.distance, d.duration_min, d.speed_max,
         (d.start_rated_range_km - d.end_rated_range_km) AS range_used_km,
         d.outside_temp_avg,
         COALESCE(gs.name, sa.city, sa.display_name) AS start_label,
         COALESCE(ge.name, ea.city, ea.display_name) AS end_label
  FROM drives d
  LEFT JOIN addresses sa ON sa.id = d.start_address_id
  LEFT JOIN addresses ea ON ea.id = d.end_address_id
  LEFT JOIN geofences gs ON gs.id = d.start_geofence_id
  LEFT JOIN geofences ge ON ge.id = d.end_geofence_id
`;

export async function listDrives(page: number, pageSize = 50): Promise<DriveListItem[]> {
  const rows = await q<DriveRow>(
    `${DRIVE_SELECT} WHERE d.distance > 0.1 ORDER BY d.start_date DESC LIMIT $1 OFFSET $2`,
    [pageSize, (page - 1) * pageSize],
  );
  return rows.map(mapDriveRow);
}

export async function getDrive(id: number): Promise<DriveDetail | null> {
  const rows = await q<DriveRow>(`${DRIVE_SELECT} WHERE d.id = $1`, [id]);
  if (rows.length === 0) return null;
  const points = await q<PointRow>(
    `SELECT date, speed, battery_level, latitude, longitude FROM (
       SELECT p.date, p.speed, p.battery_level, p.latitude, p.longitude,
              row_number() OVER (ORDER BY p.date) AS rn,
              count(*) OVER () AS total
       FROM positions p WHERE p.drive_id = $1
     ) t
     WHERE rn % greatest(1, ceil(total::numeric / 500)::int) = 0 OR rn = 1 OR rn = total
     ORDER BY date`,
    [id],
  );
  return { ...mapDriveRow(rows[0]), points: points.map(mapDrivePoint) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/drives.test.ts` — expected PASS.

- [ ] **Step 5: Write `src/components/RouteMap.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { OSM_STYLE } from "./MiniMap";

export default function RouteMap({ points }: { points: { lat: number; lon: number }[] }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!el.current || points.length === 0) return;
    const coords = points.map((p) => [p.lon, p.lat] as [number, number]);
    const lons = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    const bounds: LngLatBoundsLike = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
    const map = new maplibregl.Map({ container: el.current, style: OSM_STYLE, bounds, fitBoundsOptions: { padding: 40 } });
    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } },
      });
      map.addLayer({
        id: "route", type: "line", source: "route",
        paint: { "line-color": "#2e7fe0", "line-width": 3 },
      });
    });
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={el} className="h-72 w-full overflow-hidden rounded-lg border border-line" />;
}
```

- [ ] **Step 6: Write `src/app/drives/page.tsx`**

```tsx
import Link from "next/link";
import DataUnavailable from "@/components/DataUnavailable";
import { listDrives } from "@/lib/db/drives";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";
import { formatDistance, formatDuration, formatSpeed } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DrivesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const res = await safe(Promise.all([listDrives(page), getSettings()]));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [drives, settings] = res.data;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Drives</h1>
      {drives.length === 0 ? (
        <p className="text-ink-2">No drives on this page.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-panel">
          {drives.map((d) => (
            <li key={d.id}>
              <Link href={`/drives/${d.id}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]">
                <span className="w-40 font-[family-name:var(--font-mono)] text-xs text-ink-2">
                  {new Date(d.startDate).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{d.startLabel} → {d.endLabel}</span>
                <span className="text-sm">{formatDistance(d.distanceKm, settings.unitOfLength)}</span>
                <span className="text-sm text-ink-2">{formatDuration(d.durationMin)}</span>
                <span className="text-sm text-ink-2">max {formatSpeed(d.speedMaxKmh, settings.unitOfLength)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <nav className="mt-4 flex gap-3 text-sm">
        {page > 1 && <Link className="text-ink-2 hover:text-ink" href={`/drives?page=${page - 1}`}>← Newer</Link>}
        {drives.length === 50 && <Link className="text-ink-2 hover:text-ink" href={`/drives?page=${page + 1}`}>Older →</Link>}
      </nav>
    </div>
  );
}
```

- [ ] **Step 7: Write `src/app/drives/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import DataUnavailable from "@/components/DataUnavailable";
import RouteMap from "@/components/RouteMap";
import TimeSeriesPanel from "@/components/charts/TimeSeriesPanel";
import { getDrive } from "@/lib/db/drives";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";
import { formatDistance, formatDuration, formatSpeed, formatTemp, kmToUnit } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DrivePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const res = await safe(Promise.all([getDrive(id), getSettings()]));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [drive, settings] = res.data;
  if (!drive) notFound();

  const speedData = drive.points.map((p) => ({
    t: p.t, v: p.speed === null ? null : Math.round(kmToUnit(p.speed, settings.unitOfLength)),
  }));
  const socData = drive.points.map((p) => ({ t: p.t, v: p.soc }));
  const avgSpeed =
    drive.distanceKm !== null && drive.durationMin ? (drive.distanceKm / drive.durationMin) * 60 : null;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">{drive.startLabel} → {drive.endLabel}</h1>
        <p className="font-[family-name:var(--font-mono)] text-xs text-ink-2">
          {new Date(drive.startDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-panel p-4 text-sm sm:grid-cols-5">
        <div><dt className="text-xs text-ink-2">Distance</dt><dd>{formatDistance(drive.distanceKm, settings.unitOfLength)}</dd></div>
        <div><dt className="text-xs text-ink-2">Duration</dt><dd>{formatDuration(drive.durationMin)}</dd></div>
        <div><dt className="text-xs text-ink-2">Avg speed</dt><dd>{formatSpeed(avgSpeed, settings.unitOfLength)}</dd></div>
        <div><dt className="text-xs text-ink-2">Max speed</dt><dd>{formatSpeed(drive.speedMaxKmh, settings.unitOfLength)}</dd></div>
        <div><dt className="text-xs text-ink-2">Outside</dt><dd>{formatTemp(drive.outsideTempAvgC, settings.unitOfTemperature)}</dd></div>
      </dl>

      <RouteMap points={drive.points} />

      <div className="space-y-4">
        <TimeSeriesPanel
          title="Speed" unit={settings.unitOfLength === "mi" ? "mph" : "km/h"}
          data={speedData} color="var(--chart-blue)" syncId={`drive-${drive.id}`}
        />
        <TimeSeriesPanel
          title="Battery" unit="%" data={socData} color="var(--chart-green)"
          syncId={`drive-${drive.id}`} yDomain={[0, 100]}
        />
      </div>
    </div>
  );
}
```

Note: `color` is passed to Recharts `stroke` as an attribute — CSS `var()` does not resolve there. In implementation, replace `color="var(--chart-blue)"` with the resolved hook value: make the two panels' parent a small client wrapper `DriveCharts` that calls `useChartColors()` and passes `c.blue` / `c.green`. Create `src/components/charts/DriveCharts.tsx`:

```tsx
"use client";

import TimeSeriesPanel from "./TimeSeriesPanel";
import { useChartColors } from "./useChartColors";

type Point = { t: number; v: number | null };

export default function DriveCharts({
  syncId, speedData, socData, speedUnit,
}: { syncId: string; speedData: Point[]; socData: Point[]; speedUnit: string }) {
  const c = useChartColors();
  return (
    <div className="space-y-4">
      <TimeSeriesPanel title="Speed" unit={speedUnit} data={speedData} color={c.blue} syncId={syncId} />
      <TimeSeriesPanel title="Battery" unit="%" data={socData} color={c.green} syncId={syncId} yDomain={[0, 100]} />
    </div>
  );
}
```

and use `<DriveCharts syncId={...} speedData={speedData} socData={socData} speedUnit={...} />` in the page instead of the two inline panels.

- [ ] **Step 8: Test + build + commit**

Run: `npm test && npm run build` — expected: pass.

```bash
git add src/lib/db/drives.ts src/lib/db/drives.test.ts src/components/RouteMap.tsx src/components/charts/DriveCharts.tsx src/app/drives && git commit -m "feat: drives list and detail with route map and synced charts"
```

---

### Task 8: Charges — queries (TDD), list page, detail page with charge curve

**Files:**
- Create: `src/lib/db/charges.ts`, `src/components/charts/ChargeCharts.tsx`, `src/app/charges/page.tsx`, `src/app/charges/[id]/page.tsx`
- Test: `src/lib/db/charges.test.ts`

**Interfaces:**
- Consumes: `q`, `safe`, `getSettings`, formatters, `TimeSeriesPanel`, `useChartColors`.
- Produces:
  - `listCharges(page: number, pageSize?: number): Promise<ChargeListItem[]>`
  - `getCharge(id: number): Promise<ChargeDetail | null>`
  - `mapChargeRow`, `mapCurvePoint` (pure, tested)

    ```ts
    type ChargeListItem = {
      id: number; startDate: string; location: string; energyAddedKwh: number | null;
      energyUsedKwh: number | null; cost: number | null; durationMin: number | null;
      socStart: number | null; socEnd: number | null; maxPowerKw: number | null;
    };
    type CurvePoint = { t: number; power: number | null; soc: number | null };
    type ChargeDetail = ChargeListItem & { endDate: string | null; points: CurvePoint[] };
    ```

- [ ] **Step 1: Write failing test `src/lib/db/charges.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { mapChargeRow, mapCurvePoint } from "@/lib/db/charges";

describe("mapChargeRow", () => {
  it("converts decimals", () => {
    const c = mapChargeRow({
      id: 3, start_date: new Date("2026-07-02T22:00:00Z"), end_date: new Date("2026-07-03T04:00:00Z"),
      charge_energy_added: "41.20", charge_energy_used: "43.05", cost: "6.18",
      duration_min: 360, start_battery_level: 22, end_battery_level: 80,
      location: "Home", max_power: 11,
    });
    expect(c.energyAddedKwh).toBeCloseTo(41.2);
    expect(c.cost).toBeCloseTo(6.18);
    expect(c.location).toBe("Home");
  });
  it("null location → label", () => {
    const c = mapChargeRow({
      id: 3, start_date: new Date(), end_date: null, charge_energy_added: null,
      charge_energy_used: null, cost: null, duration_min: null,
      start_battery_level: null, end_battery_level: null, location: null, max_power: null,
    });
    expect(c.location).toBe("Unknown location");
  });
});

describe("mapCurvePoint", () => {
  it("maps power and soc", () => {
    const p = mapCurvePoint({ date: new Date("2026-07-02T22:10:00Z"), charger_power: 11, battery_level: 25 });
    expect(p.power).toBe(11);
    expect(p.soc).toBe(25);
    expect(p.t).toBe(Date.parse("2026-07-02T22:10:00Z"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/charges.test.ts` — expected FAIL.

- [ ] **Step 3: Write `src/lib/db/charges.ts`**

```ts
import { num } from "@/lib/format";
import { q } from "./pool";

export type ChargeRow = {
  id: number; start_date: Date; end_date: Date | null;
  charge_energy_added: string | null; charge_energy_used: string | null; cost: string | null;
  duration_min: number | null; start_battery_level: number | null; end_battery_level: number | null;
  location: string | null; max_power: number | null;
};

export type ChargeListItem = {
  id: number; startDate: string; endDate: string | null; location: string;
  energyAddedKwh: number | null; energyUsedKwh: number | null; cost: number | null;
  durationMin: number | null; socStart: number | null; socEnd: number | null; maxPowerKw: number | null;
};

export type CurveRow = { date: Date; charger_power: number | null; battery_level: number | null };
export type CurvePoint = { t: number; power: number | null; soc: number | null };
export type ChargeDetail = ChargeListItem & { points: CurvePoint[] };

export function mapChargeRow(r: ChargeRow): ChargeListItem {
  return {
    id: r.id,
    startDate: r.start_date.toISOString(),
    endDate: r.end_date ? r.end_date.toISOString() : null,
    location: r.location ?? "Unknown location",
    energyAddedKwh: num(r.charge_energy_added),
    energyUsedKwh: num(r.charge_energy_used),
    cost: num(r.cost),
    durationMin: r.duration_min,
    socStart: r.start_battery_level,
    socEnd: r.end_battery_level,
    maxPowerKw: r.max_power,
  };
}

export function mapCurvePoint(r: CurveRow): CurvePoint {
  return { t: r.date.getTime(), power: r.charger_power, soc: r.battery_level };
}

const CHARGE_SELECT = `
  SELECT cp.id, cp.start_date, cp.end_date, cp.charge_energy_added, cp.charge_energy_used,
         cp.cost, cp.duration_min, cp.start_battery_level, cp.end_battery_level,
         COALESCE(g.name, a.city, a.display_name) AS location,
         (SELECT max(ch.charger_power) FROM charges ch WHERE ch.charging_process_id = cp.id) AS max_power
  FROM charging_processes cp
  LEFT JOIN addresses a ON a.id = cp.address_id
  LEFT JOIN geofences g ON g.id = cp.geofence_id
`;

export async function listCharges(page: number, pageSize = 50): Promise<ChargeListItem[]> {
  const rows = await q<ChargeRow>(
    `${CHARGE_SELECT} WHERE cp.charge_energy_added > 0.1 ORDER BY cp.start_date DESC LIMIT $1 OFFSET $2`,
    [pageSize, (page - 1) * pageSize],
  );
  return rows.map(mapChargeRow);
}

export async function getCharge(id: number): Promise<ChargeDetail | null> {
  const rows = await q<ChargeRow>(`${CHARGE_SELECT} WHERE cp.id = $1`, [id]);
  if (rows.length === 0) return null;
  const points = await q<CurveRow>(
    `SELECT date, charger_power, battery_level FROM (
       SELECT ch.date, ch.charger_power, ch.battery_level,
              row_number() OVER (ORDER BY ch.date) AS rn,
              count(*) OVER () AS total
       FROM charges ch WHERE ch.charging_process_id = $1
     ) t
     WHERE rn % greatest(1, ceil(total::numeric / 500)::int) = 0 OR rn = 1 OR rn = total
     ORDER BY date`,
    [id],
  );
  return { ...mapChargeRow(rows[0]), points: points.map(mapCurvePoint) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/charges.test.ts` — expected PASS.

- [ ] **Step 5: Write `src/components/charts/ChargeCharts.tsx`**

```tsx
"use client";

import TimeSeriesPanel from "./TimeSeriesPanel";
import { useChartColors } from "./useChartColors";

type Point = { t: number; v: number | null };

export default function ChargeCharts({
  syncId, powerData, socData,
}: { syncId: string; powerData: Point[]; socData: Point[] }) {
  const c = useChartColors();
  return (
    <div className="space-y-4">
      <TimeSeriesPanel title="Charging power" unit="kW" data={powerData} color={c.orange} syncId={syncId} />
      <TimeSeriesPanel title="Battery" unit="%" data={socData} color={c.green} syncId={syncId} yDomain={[0, 100]} />
    </div>
  );
}
```

- [ ] **Step 6: Write `src/app/charges/page.tsx`**

```tsx
import Link from "next/link";
import DataUnavailable from "@/components/DataUnavailable";
import { listCharges } from "@/lib/db/charges";
import { safe } from "@/lib/db/pool";
import { formatDuration, formatEnergy, formatPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ChargesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const res = await safe(listCharges(page));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const charges = res.data;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Charges</h1>
      {charges.length === 0 ? (
        <p className="text-ink-2">No charging sessions on this page.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-panel">
          {charges.map((c) => (
            <li key={c.id}>
              <Link href={`/charges/${c.id}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]">
                <span className="w-40 font-[family-name:var(--font-mono)] text-xs text-ink-2">
                  {new Date(c.startDate).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{c.location}</span>
                <span className="text-sm">{formatEnergy(c.energyAddedKwh)}</span>
                <span className="text-sm text-ink-2">{formatPct(c.socStart)} → {formatPct(c.socEnd)}</span>
                <span className="text-sm text-ink-2">{formatDuration(c.durationMin)}</span>
                <span className="text-sm">{c.cost !== null ? `$${c.cost.toFixed(2)}` : "–"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <nav className="mt-4 flex gap-3 text-sm">
        {page > 1 && <Link className="text-ink-2 hover:text-ink" href={`/charges?page=${page - 1}`}>← Newer</Link>}
        {charges.length === 50 && <Link className="text-ink-2 hover:text-ink" href={`/charges?page=${page + 1}`}>Older →</Link>}
      </nav>
    </div>
  );
}
```

- [ ] **Step 7: Write `src/app/charges/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import DataUnavailable from "@/components/DataUnavailable";
import ChargeCharts from "@/components/charts/ChargeCharts";
import { getCharge } from "@/lib/db/charges";
import { safe } from "@/lib/db/pool";
import { formatDuration, formatEnergy, formatPct, formatPower } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ChargePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const res = await safe(getCharge(id));
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const charge = res.data;
  if (!charge) notFound();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Charge at {charge.location}</h1>
        <p className="font-[family-name:var(--font-mono)] text-xs text-ink-2">
          {new Date(charge.startDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-panel p-4 text-sm sm:grid-cols-5">
        <div><dt className="text-xs text-ink-2">Added</dt><dd>{formatEnergy(charge.energyAddedKwh)}</dd></div>
        <div><dt className="text-xs text-ink-2">Cost</dt><dd>{charge.cost !== null ? `$${charge.cost.toFixed(2)}` : "–"}</dd></div>
        <div><dt className="text-xs text-ink-2">Duration</dt><dd>{formatDuration(charge.durationMin)}</dd></div>
        <div><dt className="text-xs text-ink-2">Max power</dt><dd>{formatPower(charge.maxPowerKw)}</dd></div>
        <div><dt className="text-xs text-ink-2">Battery</dt><dd>{formatPct(charge.socStart)} → {formatPct(charge.socEnd)}</dd></div>
      </dl>

      <ChargeCharts
        syncId={`charge-${charge.id}`}
        powerData={charge.points.map((p) => ({ t: p.t, v: p.power }))}
        socData={charge.points.map((p) => ({ t: p.t, v: p.soc }))}
      />
    </div>
  );
}
```

- [ ] **Step 8: Test + build + commit**

Run: `npm test && npm run build` — expected: pass.

```bash
git add src/lib/db/charges.ts src/lib/db/charges.test.ts src/components/charts/ChargeCharts.tsx src/app/charges && git commit -m "feat: charges list and detail with charge curve"
```

---

### Task 9: Stats — queries (TDD on vampire-drain math), page with four panels

**Files:**
- Create: `src/lib/db/stats.ts`, `src/components/charts/StatsCharts.tsx`, `src/app/stats/page.tsx`
- Test: `src/lib/db/stats.test.ts`

**Interfaces:**
- Consumes: `q`, `safe`, `getSettings`, formatters, `BarPanel`, `TimeSeriesPanel`, `useChartColors`.
- Produces:
  - `getMonthlyMileage(): Promise<{ label: string; v: number }[]>` (km per month, last 12, oldest first; label `"Jan 26"`)
  - `getMonthlyEfficiency(): Promise<{ label: string; v: number }[]>` (Wh/km)
  - `getBatteryHealth(): Promise<{ t: number; v: number | null }[]>` (projected 100% rated range km by month, last 24)
  - `getVampireDrain(): Promise<{ label: string; v: number }[]>` (avg %/day per month)
  - Pure, tested: `drainPctPerDay(socStart: number, socEnd: number, hours: number): number | null` (null when hours < 6 or drain negative), `monthLabel(d: Date): string`

- [ ] **Step 1: Write failing test `src/lib/db/stats.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { drainPctPerDay, monthLabel } from "@/lib/db/stats";

describe("drainPctPerDay", () => {
  it("computes normalized drain", () => expect(drainPctPerDay(80, 75, 24)).toBeCloseTo(5));
  it("scales to 24h", () => expect(drainPctPerDay(80, 78, 12)).toBeCloseTo(4));
  it("null for short gaps", () => expect(drainPctPerDay(80, 79, 3)).toBeNull());
  it("null for negative drain", () => expect(drainPctPerDay(70, 75, 24)).toBeNull());
});

describe("monthLabel", () => {
  it("formats", () => expect(monthLabel(new Date("2026-07-01T00:00:00Z"))).toBe("Jul 26"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/stats.test.ts` — expected FAIL.

- [ ] **Step 3: Write `src/lib/db/stats.ts`**

```ts
import { num } from "@/lib/format";
import { q } from "./pool";

export function drainPctPerDay(socStart: number, socEnd: number, hours: number): number | null {
  if (hours < 6) return null;
  const drain = socStart - socEnd;
  if (drain < 0) return null;
  return (drain / hours) * 24;
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

type MonthRow = { month: Date; v: string | number | null };

export async function getMonthlyMileage(): Promise<{ label: string; v: number }[]> {
  const rows = await q<MonthRow>(`
    SELECT date_trunc('month', start_date) AS month, sum(distance) AS v
    FROM drives WHERE distance > 0.1
    GROUP BY 1 ORDER BY 1 DESC LIMIT 12
  `);
  return rows.reverse().map((r) => ({ label: monthLabel(r.month), v: num(r.v) ?? 0 }));
}

export async function getMonthlyEfficiency(): Promise<{ label: string; v: number }[]> {
  const rows = await q<MonthRow>(`
    SELECT date_trunc('month', d.start_date) AS month,
           sum((d.start_rated_range_km - d.end_rated_range_km) * c.efficiency) * 1000 / nullif(sum(d.distance), 0) AS v
    FROM drives d JOIN cars c ON c.id = d.car_id
    WHERE d.distance > 0.1 AND d.start_rated_range_km IS NOT NULL AND d.end_rated_range_km IS NOT NULL
    GROUP BY 1 ORDER BY 1 DESC LIMIT 12
  `);
  return rows.reverse().flatMap((r) => {
    const v = num(r.v);
    return v === null || v <= 0 ? [] : [{ label: monthLabel(r.month), v }];
  });
}

export async function getBatteryHealth(): Promise<{ t: number; v: number | null }[]> {
  const rows = await q<MonthRow>(`
    SELECT date_trunc('month', cp.start_date) AS month,
           max(cp.end_rated_range_km / nullif(cp.end_battery_level, 0) * 100) AS v
    FROM charging_processes cp
    WHERE cp.end_battery_level >= 50 AND cp.end_rated_range_km IS NOT NULL
    GROUP BY 1 ORDER BY 1 DESC LIMIT 24
  `);
  return rows.reverse().map((r) => ({ t: r.month.getTime(), v: num(r.v) }));
}

type DrainRow = { end_date: Date; soc_start: number | null; soc_end: number | null; hours: string | number | null };

export async function getVampireDrain(): Promise<{ label: string; v: number }[]> {
  const rows = await q<DrainRow>(`
    WITH d AS (
      SELECT car_id, end_date, end_position_id,
             lead(start_date) OVER w AS next_start,
             lead(start_position_id) OVER w AS next_start_pos
      FROM drives WINDOW w AS (PARTITION BY car_id ORDER BY start_date)
    )
    SELECT d.end_date, p1.battery_level AS soc_start, p2.battery_level AS soc_end,
           extract(epoch FROM (d.next_start - d.end_date)) / 3600 AS hours
    FROM d
    JOIN positions p1 ON p1.id = d.end_position_id
    JOIN positions p2 ON p2.id = d.next_start_pos
    WHERE d.next_start - d.end_date > interval '6 hours'
      AND NOT EXISTS (
        SELECT 1 FROM charging_processes cp
        WHERE cp.car_id = d.car_id AND cp.start_date BETWEEN d.end_date AND d.next_start
      )
    ORDER BY d.end_date DESC LIMIT 500
  `);

  const byMonth = new Map<string, { sum: number; n: number; date: Date }>();
  for (const r of rows) {
    const hours = num(r.hours);
    if (r.soc_start === null || r.soc_end === null || hours === null) continue;
    const drain = drainPctPerDay(r.soc_start, r.soc_end, hours);
    if (drain === null) continue;
    const key = `${r.end_date.getUTCFullYear()}-${r.end_date.getUTCMonth()}`;
    const cur = byMonth.get(key) ?? { sum: 0, n: 0, date: r.end_date };
    byMonth.set(key, { sum: cur.sum + drain, n: cur.n + 1, date: cur.date });
  }
  return [...byMonth.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-12)
    .map((m) => ({ label: monthLabel(m.date), v: m.sum / m.n }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/stats.test.ts` — expected PASS.

- [ ] **Step 5: Write `src/components/charts/StatsCharts.tsx`**

```tsx
"use client";

import BarPanel from "./BarPanel";
import TimeSeriesPanel from "./TimeSeriesPanel";
import { useChartColors } from "./useChartColors";
import { kmToUnit, type LengthUnit } from "@/lib/format";

export default function StatsCharts({
  unit, mileage, efficiency, health, drain,
}: {
  unit: LengthUnit;
  mileage: { label: string; v: number }[];
  efficiency: { label: string; v: number }[];
  health: { t: number; v: number | null }[];
  drain: { label: string; v: number }[];
}) {
  const c = useChartColors();
  const distUnit = unit === "mi" ? "mi" : "km";
  const effUnit = unit === "mi" ? "Wh/mi" : "Wh/km";
  const toUnit = (km: number) => Math.round(kmToUnit(km, unit));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <BarPanel
        title="Distance driven" unit={distUnit} color={c.blue}
        data={mileage.map((m) => ({ label: m.label, v: toUnit(m.v) }))}
      />
      <BarPanel
        title="Consumption" unit={effUnit} color={c.violet}
        data={efficiency.map((m) => ({ label: m.label, v: Math.round(unit === "mi" ? m.v * 1.609344 : m.v) }))}
      />
      <TimeSeriesPanel
        title="Projected range at 100%" unit={distUnit} color={c.green}
        data={health.map((h) => ({ t: h.t, v: h.v === null ? null : toUnit(h.v) }))}
        formatValue={(v) => `${Math.round(v)} ${distUnit}`}
        formatTick={(t) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
      />
      <BarPanel
        title="Standby drain" unit="%/day" color={c.orange}
        data={drain.map((d) => ({ label: d.label, v: Number(d.v.toFixed(2)) }))}
        formatValue={(v) => `${v.toFixed(2)} %/day`}
      />
    </div>
  );
}
```


- [ ] **Step 6: Write `src/app/stats/page.tsx`**

```tsx
import DataUnavailable from "@/components/DataUnavailable";
import StatsCharts from "@/components/charts/StatsCharts";
import { getBatteryHealth, getMonthlyEfficiency, getMonthlyMileage, getVampireDrain } from "@/lib/db/stats";
import { getSettings } from "@/lib/db/settings";
import { safe } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const res = await safe(
    Promise.all([getMonthlyMileage(), getMonthlyEfficiency(), getBatteryHealth(), getVampireDrain(), getSettings()]),
  );
  if (!res.ok) return <DataUnavailable service="database" detail={res.error} />;
  const [mileage, efficiency, health, drain, settings] = res.data;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Stats</h1>
      <StatsCharts unit={settings.unitOfLength} mileage={mileage} efficiency={efficiency} health={health} drain={drain} />
    </div>
  );
}
```

- [ ] **Step 7: Test + build + commit**

Run: `npm test && npm run build` — expected: pass.

```bash
git add src/lib/db/stats.ts src/lib/db/stats.test.ts src/components/charts/StatsCharts.tsx src/app/stats && git commit -m "feat: stats page with mileage, consumption, battery health, standby drain"
```

---

### Task 10: Polish — not-found page, Dockerfile, README

**Files:**
- Create: `src/app/not-found.tsx`, `Dockerfile`, `README.md`

- [ ] **Step 1: Write `src/app/not-found.tsx`**

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-lg border border-line bg-panel p-6">
      <p className="font-medium">Page not found</p>
      <p className="mt-1 text-sm text-ink-2">
        The drive or charge you’re looking for doesn’t exist. <Link href="/" className="underline">Back to the dashboard</Link>.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Write `Dockerfile`**

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

(If `public/` doesn't exist by this point, create it with a `.gitkeep`.)

- [ ] **Step 3: Write `README.md`**

```markdown
# teslamate-frontend

Standalone companion dashboard for [TeslaMate](https://github.com/teslamate-org/teslamate):
live car status over MQTT, drive and charge history, and stats — read-only against
TeslaMate's Postgres. TeslaMate itself is untouched.

## Configuration

| Env var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (read-only user recommended) |
| `MQTT_URL` | mosquitto URL, e.g. `mqtt://mosquitto:1883` |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | optional broker credentials |

Create a read-only DB user:

```sql
CREATE USER teslamate_ro WITH PASSWORD '...';
GRANT CONNECT ON DATABASE teslamate TO teslamate_ro;
GRANT USAGE ON SCHEMA public TO teslamate_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO teslamate_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO teslamate_ro;
```

## Development

```bash
cp .env.example .env.local   # fill in URLs
npm install
npm run dev                  # http://localhost:3000
npm test
```

## Deployment

`docker build -t teslamate-frontend .` — listens on 3000. No auth built in;
run it behind your ingress on a trusted network.
```

- [ ] **Step 4: Build + commit**

Run: `npm run build` — expected: succeeds.

```bash
git add src/app/not-found.tsx Dockerfile README.md public && git commit -m "feat: not-found page, Dockerfile, README"
```

---

### Task 11: Verify against live homelab data, create private repo, open PR

**Files:** none created (verification + delivery).

- [ ] **Step 1: Full test suite + build**

```bash
npm test && npm run build
```

Expected: all tests pass, build clean.

- [ ] **Step 2: Port-forward homelab TeslaMate DB + broker** (kubeconfig `~/.kube/config`, joker2 cluster)

```bash
kubectl get svc -n teslamate   # confirm service names/ports
kubectl port-forward -n teslamate svc/<db-svc> 5544:5432 &
kubectl port-forward -n teslamate svc/<mosquitto-svc> 1883:1883 &
```

DB credentials: `kubectl get secret -n teslamate -o yaml` (see teslamate-secrets in the kubernetes repo). Use the existing teslamate user for verification only.

- [ ] **Step 3: Run against live data and drive every page**

```bash
DATABASE_URL=postgres://teslamate:<pass>@localhost:5544/teslamate MQTT_URL=mqtt://localhost:1883 npm run dev
```

Check, in a browser (screenshot each if possible):
- `/` shows the car with correct name, SoC, range, state; battery bar fill color matches state; live update arrives (toggle climate or wait for an MQTT tick).
- `/drives` lists real drives; a detail page shows route polyline and synced speed/SoC panels (hover one panel — crosshair appears in both).
- `/charges` lists sessions with cost; detail shows the charge curve.
- `/stats` renders all four panels with sane values; month labels on the projected-range x-axis (not HH:mm).
- Narrow the window to ~375px — no horizontal scroll; tab through the nav — focus visible.
- Kill the DB port-forward, reload `/drives` — the "Can't reach the TeslaMate database" panel renders.

Fix anything broken before proceeding.

- [ ] **Step 4: Create private repo and push**

```bash
cd ~/Documents/github/teslamate-frontend
gh repo create jmcglock/teslamate-frontend --private --source . --push   # pushes main
git push -u origin feat/dashboard
```

- [ ] **Step 5: Open the PR**

```bash
gh pr create --base main --head feat/dashboard \
  --title "feat: companion dashboard (live status, drives, charges, stats)" \
  --body "$(cat <<'EOF'
Standalone TeslaMate companion frontend.

- Live dashboard: per-car cards over MQTT→SSE, battery-bar state signature
- Drives: list + detail (route map, synced speed/SoC panels)
- Charges: list + detail (charge curve, cost)
- Stats: monthly distance, consumption, projected range, standby drain
- Read-only Postgres; TeslaMate untouched
- Design spec: docs/superpowers/specs/2026-07-10-teslamate-frontend-design.md
EOF
)"
```

Expected: PR URL printed. Report it.
