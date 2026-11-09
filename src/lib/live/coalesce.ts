import type { CarSnapshot } from "./snapshot";

/** Live UI flush rate. Fast enough to read speed, slow enough to skip per-topic renders. */
export const LIVE_FLUSH_MS = 250;

export function createUpdateCoalescer(
  flush: (carId: number, snap: CarSnapshot) => void,
  intervalMs = LIVE_FLUSH_MS,
) {
  const pending = new Map<number, CarSnapshot>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const emit = () => {
    timer = null;
    if (pending.size === 0) return;
    const batch = [...pending.entries()];
    pending.clear();
    for (const [carId, snap] of batch) flush(carId, snap);
  };

  return {
    push(carId: number, snap: CarSnapshot) {
      pending.set(carId, snap);
      if (timer === null) timer = setTimeout(emit, intervalMs);
    },
    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending.clear();
    },
  };
}

/** Apply a frame of snapshots. Keeps the previous object when nothing changed. */
export function mergeSnapshots<T>(
  prev: Record<number, T>,
  batch: Iterable<[number, T]>,
): Record<number, T> {
  let next = prev;
  let changed = false;
  for (const [carId, snapshot] of batch) {
    if (Object.is(next[carId], snapshot)) continue;
    if (!changed) {
      next = { ...prev };
      changed = true;
    }
    next[carId] = snapshot;
  }
  return next;
}
