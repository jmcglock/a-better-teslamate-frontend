import { afterEach, describe, expect, it } from "vitest";
import { cacheClear, cacheGet, cacheSet, cached } from "@/lib/cache";

afterEach(() => cacheClear());

describe("cache", () => {
  it("stores and returns", async () => {
    let n = 0;
    const a = await cached("k", 60_000, async () => {
      n += 1;
      return 42;
    });
    const b = await cached("k", 60_000, async () => {
      n += 1;
      return 99;
    });
    expect(a).toBe(42);
    expect(b).toBe(42);
    expect(n).toBe(1);
  });

  it("expires", async () => {
    cacheSet("x", "old", -1);
    expect(cacheGet("x")).toBeUndefined();
  });
});
