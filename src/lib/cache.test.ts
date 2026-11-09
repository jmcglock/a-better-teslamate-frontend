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

  it("joins in-flight calls", async () => {
    let n = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fn = async () => {
      n += 1;
      await gate;
      return "ok";
    };
    const a = cached("inflight", 60_000, fn);
    const b = cached("inflight", 60_000, fn);
    release();
    await expect(Promise.all([a, b])).resolves.toEqual(["ok", "ok"]);
    expect(n).toBe(1);
    expect(await cached("inflight", 60_000, async () => "later")).toBe("ok");
  });

  it("does not cache failures", async () => {
    let n = 0;
    await expect(
      cached("fail", 60_000, async () => {
        n += 1;
        throw new Error("nope");
      }),
    ).rejects.toThrow("nope");
    await expect(cached("fail", 60_000, async () => {
      n += 1;
      return 1;
    })).resolves.toBe(1);
    expect(n).toBe(2);
  });
});
