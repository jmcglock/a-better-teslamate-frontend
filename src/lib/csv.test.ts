import { describe, expect, it } from "vitest";
import { serializeCsv } from "@/lib/csv";

describe("serializeCsv", () => {
  it("quotes fields that contain commas, quotes, or newlines", () => {
    const csv = serializeCsv(
      ["location", "note"],
      [
        ["Home, CA", 'say "hi"'],
        ["line1\nline2", "plain"],
        ["cr\rhere", "ok"],
      ],
    );
    expect(csv).toBe(
      'location,note\r\n"Home, CA","say ""hi"""\r\n"line1\nline2",plain\r\n"cr\rhere",ok\r\n',
    );
  });

  it("prefixes string fields that start with = + - or @", () => {
    const csv = serializeCsv(
      ["location"],
      [["=1+1"], ["+cmd"], ["-hidden"], ["@sum"], ["safe"]],
    );
    expect(csv).toBe("location\r\n'=1+1\r\n'+cmd\r\n'-hidden\r\n'@sum\r\nsafe\r\n");
  });

  it("quotes a formula string that also contains a comma", () => {
    const csv = serializeCsv(["location"], [["=1,2"]]);
    expect(csv).toBe('location\r\n"\'=1,2"\r\n');
  });

  it("leaves negative numbers untouched", () => {
    const csv = serializeCsv(["power_min_kw"], [[-45.5]]);
    expect(csv).toBe("power_min_kw\r\n-45.5\r\n");
  });

  it("writes ISO timestamps and empty cells for nulls", () => {
    const csv = serializeCsv(
      ["started_at", "ended_at", "distance_km"],
      [["2026-07-01T08:00:00.000Z", null, 21.7]],
    );
    expect(csv).toBe("started_at,ended_at,distance_km\r\n2026-07-01T08:00:00.000Z,,21.7\r\n");
  });

  it("emits a header row when there are no data rows", () => {
    expect(serializeCsv(["id", "distance_km"], [])).toBe("id,distance_km\r\n");
  });
});
