import { Pool } from "pg";

const g = globalThis as unknown as { pgPool?: Pool };

if (!g.pgPool) {
  g.pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 4000,
  });
  g.pgPool.on("error", (err) => {
    console.error("pg pool idle client error", err);
  });
}

export const pool = g.pgPool;

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
