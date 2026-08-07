"use client";

import { useEffect } from "react";
import { useLive } from "@/lib/live/useLive";

/** Bottom toast when MQTT/SSE reconnects after being offline. */
export default function LiveToast() {
  const { justReconnected, dismissReconnected } = useLive();

  useEffect(() => {
    if (!justReconnected) return;
    const t = setTimeout(dismissReconnected, 3200);
    return () => clearTimeout(t);
  }, [justReconnected, dismissReconnected]);

  return (
    <div
      className={`live-toast ${justReconnected ? "is-visible" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="toast-dot" aria-hidden />
      Live connection restored
    </div>
  );
}
