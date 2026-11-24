import { describe, expect, it } from "vitest";
import { pageInfo, pageRangeLabel } from "@/lib/pagination";

describe("pageInfo", () => {
  it("describes the first page", () => {
    expect(pageInfo(1, 50, 312, 50)).toEqual({ first: 1, last: 50, total: 312, totalPages: 7, pastEnd: false });
  });

  it("describes a partial last page", () => {
    expect(pageInfo(7, 50, 312, 12)).toEqual({ first: 301, last: 312, total: 312, totalPages: 7, pastEnd: false });
  });

  it("flags pages beyond the end", () => {
    const info = pageInfo(9, 50, 312, 0);
    expect(info.pastEnd).toBe(true);
    expect(info.first).toBe(0);
  });

  it("does not flag an empty first page as past the end", () => {
    expect(pageInfo(1, 50, 0, 0)).toEqual({ first: 0, last: 0, total: 0, totalPages: 0, pastEnd: false });
  });
});

describe("pageRangeLabel", () => {
  it("formats the visible range", () => {
    expect(pageRangeLabel(pageInfo(2, 50, 1312, 50), "drives")).toBe("51–100 of 1,312 drives");
  });

  it("returns null for an empty page", () => {
    expect(pageRangeLabel(pageInfo(3, 50, 20, 0), "charges")).toBeNull();
  });

  it("never reports a total smaller than the visible range", () => {
    expect(pageRangeLabel(pageInfo(1, 50, 3, 5), "charges")).toBe("1–5 of 5 charges");
  });
});
