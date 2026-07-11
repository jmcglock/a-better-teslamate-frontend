import { getBridge } from "@/lib/live/bridge";
import type { CarSnapshot } from "@/lib/live/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const bridge = getBridge();
  const encoder = new TextEncoder();

  let closed = false;
  let onUpdate: ((carId: number, snap: CarSnapshot) => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (onUpdate) bridge.off("update", onUpdate);
    if (heartbeat) clearInterval(heartbeat);
  };

  const stream = new ReadableStream({
    start(controller) {
      if (req.signal.aborted) {
        cleanup();
        return;
      }

      const send = (carId: number, snapshot: CarSnapshot) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ carId, snapshot })}\n\n`));
      };

      for (const [carId, snap] of bridge.getSnapshots()) send(carId, snap);

      onUpdate = (carId: number, snap: CarSnapshot) => send(carId, snap);
      bridge.on("update", onUpdate);

      heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 25000);

      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      // Invoked when the consumer cancels the stream directly (distinct from
      // the abort-signal path above). No controller.close() here -- cancel()
      // means the controller is already closed/closing.
      cleanup();
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
