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
