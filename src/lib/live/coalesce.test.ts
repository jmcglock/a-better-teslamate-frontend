import { afterEach, describe, expect, it, vi } from "vitest";
import { createUpdateCoalescer, mergeSnapshots } from "./coalesce";
import type { CarSnapshot } from "./snapshot";

afterEach(() => {
  vi.useRealTimers();
});

describe("createUpdateCoalescer", () => {
  it("emits the latest snapshot once per interval", () => {
    vi.useFakeTimers();
    const seen: Array<[number, CarSnapshot]> = [];
    const coalescer = createUpdateCoalescer((carId, snap) => {
      seen.push([carId, snap]);
    }, 250);

    coalescer.push(1, { speed: 10 });
    coalescer.push(1, { speed: 20 });
    coalescer.push(2, { speed: 5 });
    expect(seen).toEqual([]);

    vi.advanceTimersByTime(250);
    expect(seen).toEqual([
      [1, { speed: 20 }],
      [2, { speed: 5 }],
    ]);

    coalescer.dispose();
  });

  it("does not emit after dispose", () => {
    vi.useFakeTimers();
    const flush = vi.fn();
    const coalescer = createUpdateCoalescer(flush, 250);
    coalescer.push(1, { speed: 1 });
    coalescer.dispose();
    vi.advanceTimersByTime(1000);
    expect(flush).not.toHaveBeenCalled();
  });
});

describe("mergeSnapshots", () => {
  it("returns the same object when the batch is identical", () => {
    const snap = { speed: 1 };
    const prev = { 1: snap };
    expect(mergeSnapshots(prev, [[1, snap]])).toBe(prev);
  });

  it("keeps the last snapshot for a car", () => {
    const prev = { 1: { speed: 1 } };
    const next = mergeSnapshots(prev, [
      [1, { speed: 2 }],
      [1, { speed: 3 }],
    ]);
    expect(next[1]).toEqual({ speed: 3 });
    expect(prev[1]).toEqual({ speed: 1 });
  });
});
