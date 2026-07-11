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
