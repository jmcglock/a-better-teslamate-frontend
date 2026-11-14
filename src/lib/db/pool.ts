import pg, { Pool } from "pg";

export { LOCAL_TZ, localTs } from "./localTz";

// TeslaMate stores UTC in `timestamp without time zone` columns. node-pg
// parses those (and serializes Date params) in the process TZ by default,
// which shifts every time by the host offset when TZ is not UTC.
const TIMESTAMP_OID = 1114;
pg.types.setTypeParser(TIMESTAMP_OID, (s) => new Date(`${s.replace(" ", "T")}Z`));
pg.defaults.parseInputDatesAsUTC = true;

const g = globalThis as unknown as { pgPool?: Pool };

const isProd = process.env.NODE_ENV === "production";

function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Keep now()/date_trunc consistent with the UTC-stored columns.
    options: "-c TimeZone=UTC",
    // TeslaMate Postgres often runs with max_connections ~20 shared with
    // TeslaMate + Grafana. Keep this modest; hold a warm client in prod so
    // first-click after idle does not pay TCP + auth again.
    // Dashboard activity issues four reads at once. 4 avoids a queue on that path.
    max: 4,
    min: isProd ? 1 : 0,
    idleTimeoutMillis: isProd ? 60_000 : 10_000,
    connectionTimeoutMillis: 4_000,
    allowExitOnIdle: !isProd,
  });
  pool.on("error", (err) => {
    console.error("pg pool idle client error", err);
  });
  // Warm one connection in production so the first request is not cold.
  // Skip during `next build` (no DB) and when DATABASE_URL is unset.
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  if (isProd && !isBuild && process.env.DATABASE_URL) {
    pool.query("SELECT 1").catch((err) => {
      console.error("pg pool warm-up failed", err instanceof Error ? err.message : err);
    });
  }
  return pool;
}

export const pool = g.pgPool ?? (g.pgPool = createPool());

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
