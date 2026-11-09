/** Simple process-local TTL cache for read-mostly TeslaMate data. */

type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
/** Bumped on a full clear so a query that started earlier cannot refill the cache. */
let epoch = 0;

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit) {
    if (hit.expires > now) return hit.value as T;
    store.delete(key);
  }

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const ticket = epoch;
  const promise = fn()
    .then((value) => {
      if (ticket === epoch) store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      if (inflight.get(key) === promise) inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit || hit.expires <= Date.now()) return undefined;
  return hit.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number): void {
  store.set(key, { value, expires: Date.now() + ttlMs });
}

export function cacheClear(prefix?: string): void {
  if (!prefix) {
    epoch += 1;
    inflight.clear();
    store.clear();
    return;
  }
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
