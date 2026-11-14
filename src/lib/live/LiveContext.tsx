"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { mergeSnapshots } from "./coalesce";
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
    let es: EventSource;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 2_000;
    let disposed = false;
    const pending = new Map<number, CarSnapshot>();
    let raf = 0;
    let opened = false;
    let offlineTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      raf = 0;
      const batch = [...pending.entries()];
      pending.clear();
      setSnaps((prev) => mergeSnapshots(prev, batch));
    };

    const armOffline = (delay: number) => {
      if (offlineTimer !== null) return;
      offlineTimer = setTimeout(() => {
        offlineTimer = null;
        wasDisconnected.current = true;
        setConnected(false);
      }, delay);
    };

    const onOpen = () => {
      opened = true;
      retryDelay = 2_000;
      if (offlineTimer !== null) {
        clearTimeout(offlineTimer);
        offlineTimer = null;
      }
      setConnected(true);
      if (wasDisconnected.current) {
        setJustReconnected(true);
        wasDisconnected.current = false;
      }
    };
    // EventSource retries on its own and fires error while it does. A short
    // blip should not flash "Live offline" or the reconnect toast. The first
    // connection gets longer before we call it down.
    // If the server rejects the stream (non-200, wrong content type) the
    // browser gives up and leaves the EventSource CLOSED; reopen it ourselves.
    const onError = () => {
      armOffline(opened ? 1_500 : 4_000);
      if (es.readyState === EventSource.CLOSED && !disposed && retryTimer === null) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (!disposed) connect();
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      }
    };
    const onMessage = (ev: MessageEvent) => {
      try {
        const { carId, snapshot } = JSON.parse(ev.data) as { carId: number; snapshot: CarSnapshot };
        pending.set(carId, snapshot);
        if (raf === 0) raf = requestAnimationFrame(flush);
      } catch {
        // ignore malformed frames
      }
    };
    const connect = () => {
      es = new EventSource("/api/live");
      es.onopen = onOpen;
      es.onerror = onError;
      es.onmessage = onMessage;
    };
    connect();
    return () => {
      disposed = true;
      es.close();
      if (retryTimer !== null) clearTimeout(retryTimer);
      if (offlineTimer !== null) clearTimeout(offlineTimer);
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, []);

  const dismissReconnected = useCallback(() => setJustReconnected(false), []);

  const value = useMemo(
    () => ({ snaps, connected, justReconnected, dismissReconnected }),
    [snaps, connected, justReconnected, dismissReconnected],
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
