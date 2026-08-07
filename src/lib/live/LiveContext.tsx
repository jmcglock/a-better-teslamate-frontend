"use client";

import {
  createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import type { CarSnapshot } from "./snapshot";

type LiveContextValue = {
  snaps: Record<number, CarSnapshot>;
  connected: boolean;
  /** True after a disconnect→reconnect cycle (for toast) */
  justReconnected: boolean;
  dismissReconnected: () => void;
};

const LiveContext = createContext<LiveContextValue | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [snaps, setSnaps] = useState<Record<number, CarSnapshot>>({});
  const [connected, setConnected] = useState(true);
  const [justReconnected, setJustReconnected] = useState(false);
  const wasDisconnected = useRef(false);

  useEffect(() => {
    const es = new EventSource("/api/live");
    es.onopen = () => {
      setConnected(true);
      if (wasDisconnected.current) {
        setJustReconnected(true);
        wasDisconnected.current = false;
      }
    };
    es.onerror = () => {
      setConnected(false);
      wasDisconnected.current = true;
    };
    es.onmessage = (ev) => {
      try {
        const { carId, snapshot } = JSON.parse(ev.data) as { carId: number; snapshot: CarSnapshot };
        setSnaps((prev) => ({ ...prev, [carId]: snapshot }));
      } catch {
        // ignore malformed frames
      }
    };
    return () => es.close();
  }, []);

  const value = useMemo(
    () => ({
      snaps,
      connected,
      justReconnected,
      dismissReconnected: () => setJustReconnected(false),
    }),
    [snaps, connected, justReconnected],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveContextValue {
  const ctx = useContext(LiveContext);
  if (!ctx) {
    // Fallback for tests / accidental use outside provider
    return {
      snaps: {},
      connected: true,
      justReconnected: false,
      dismissReconnected: () => {},
    };
  }
  return ctx;
}
