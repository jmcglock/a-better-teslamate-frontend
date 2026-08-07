/** Simple process-local TTL cache for read-mostly TeslaMate data. */

type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as T;

  const value = await fn();
  store.set(key, { value, expires: now + ttlMs });
  return value;
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
    store.clear();
    return;
  }
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
