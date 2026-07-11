import { Pool } from "pg";

const g = globalThis as unknown as { pgPool?: Pool };

function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // TeslaMate Postgres often runs with max_connections ~20 shared with
    // TeslaMate + Grafana. Keep this tiny and release idle clients quickly.
    max: 2,
    min: 0,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 4_000,
    allowExitOnIdle: true,
  });
  pool.on("error", (err) => {
    console.error("pg pool idle client error", err);
  });
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
