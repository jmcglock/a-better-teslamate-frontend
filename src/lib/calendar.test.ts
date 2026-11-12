import { describe, expect, it } from "vitest";
import { calendarLevel, calendarWeeks, parseCalendarMetric } from "@/lib/calendar";

describe("parseCalendarMetric", () => {
  it("accepts known metrics", () => {
    expect(parseCalendarMetric("drives")).toBe("drives");
    expect(parseCalendarMetric("charges")).toBe("charges");
  });

  it("falls back to drives", () => {
    expect(parseCalendarMetric(undefined)).toBe("drives");
    expect(parseCalendarMetric(null)).toBe("drives");
    expect(parseCalendarMetric("energy")).toBe("drives");
  });
});

describe("calendarLevel", () => {
  it("is zero for no activity or an empty window", () => {
    expect(calendarLevel(0, 4)).toBe(0);
    expect(calendarLevel(3, 0)).toBe(0);
    expect(calendarLevel(Number.NaN, 4)).toBe(0);
  });

  it("buckets relative to the busiest day", () => {
    expect(calendarLevel(1, 8)).toBe(1);
    expect(calendarLevel(2, 8)).toBe(2);
    expect(calendarLevel(5, 8)).toBe(3);
    expect(calendarLevel(8, 8)).toBe(4);
  });
});

describe("calendarWeeks", () => {
  it("groups days into Sunday-first weeks", () => {
    // 2026-07-01 is a Wednesday; 2026-07-05 is a Sunday.
    const weeks = calendarWeeks(new Date("2026-07-01T15:00:00Z"), new Date("2026-07-08T03:00:00Z"));
    expect(weeks).toEqual([
      ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"],
      ["2026-07-05", "2026-07-06", "2026-07-07", "2026-07-08"],
    ]);
  });

  it("returns one day and handles reversed ranges", () => {
    expect(calendarWeeks(new Date("2026-07-01T00:00:00Z"), new Date("2026-07-01T23:59:59Z"))).toEqual([
      ["2026-07-01"],
    ]);
    expect(calendarWeeks(new Date("2026-07-08T00:00:00Z"), new Date("2026-07-01T00:00:00Z"))).toEqual([]);
  });
});
