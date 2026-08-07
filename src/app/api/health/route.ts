import { pool } from "@/lib/db/pool";
import { getBridge } from "@/lib/live/bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight probe for k8s liveness/readiness.
 * Avoids SSR + map/font work on `/`.
 */
export async function GET() {
  let db: "ok" | "error" = "ok";
  try {
    await pool.query("SELECT 1");
  } catch {
    db = "error";
  }

  const bridge = getBridge();
  const mqtt = bridge.connected ? "ok" : "disconnected";

  const healthy = db === "ok";
  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      db,
      mqtt,
      uptimeSec: Math.floor(process.uptime()),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
