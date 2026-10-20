import { describe, expect, it } from "vitest";
import {
  historyHref,
  historyRangeMonths,
  parseCarId,
  parseHistoryRange,
  sinceMonthsSql,
} from "@/lib/db/range";

describe("sinceMonthsSql", () => {
  it("uses an inclusive calendar window", () => {
    const params: unknown[] = [1];
    const sql = sinceMonthsSql("start_date", 12, params);
    expect(sql).toContain("start_date >=");
    expect(sql).toContain("$2");
    expect(params).toEqual([1, 11]);
  });

  it("treats one month as the current calendar month", () => {
    const params: unknown[] = [];
    sinceMonthsSql("d.start_date", 1, params);
    expect(params).toEqual([0]);
  });

  it("omits the predicate for all history", () => {
    const params: unknown[] = [1];
    expect(sinceMonthsSql("cp.start_date", null, params)).toBe("");
    expect(params).toEqual([1]);
  });

  it("rejects identifiers that are not column references", () => {
    expect(() => sinceMonthsSql("start_date; drop", 1, [])).toThrow(/unsafe column/);
  });
});

describe("parseHistoryRange", () => {
  it("accepts known keys", () => {
    expect(parseHistoryRange("1m")).toBe("1m");
    expect(parseHistoryRange("3m")).toBe("3m");
    expect(parseHistoryRange("12m")).toBe("12m");
    expect(parseHistoryRange("all")).toBe("all");
  });

  it("falls back to all history", () => {
    expect(parseHistoryRange(undefined)).toBe("all");
    expect(parseHistoryRange("24m")).toBe("all");
    expect(historyRangeMonths("all")).toBeNull();
    expect(historyRangeMonths("3m")).toBe(3);
  });
});

describe("parseCarId", () => {
  it("accepts a known integer id", () => {
    expect(parseCarId("2", [1, 2])).toBe(2);
    expect(parseCarId("9", [1, 2])).toBeNull();
    expect(parseCarId("1.5", [1])).toBeNull();
    expect(parseCarId(undefined, [1])).toBeNull();
  });
});

describe("historyHref", () => {
  it("drops the default range and the first page", () => {
    expect(historyHref("/drives", { car: null, range: "all" })).toBe("/drives");
    expect(historyHref("/drives", { car: 2, range: "3m", page: 2 })).toBe("/drives?car=2&range=3m&page=2");
  });

  it("uses the caller default when omitting a range", () => {
    expect(historyHref("/stats", { car: 1, range: "12m", defaultRange: "12m" })).toBe("/stats?car=1");
    expect(historyHref("/stats", { car: 1, range: "all", defaultRange: "12m" })).toBe("/stats?car=1&range=all");
  });
});
