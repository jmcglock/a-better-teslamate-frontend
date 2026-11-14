import { describe, expect, it } from "vitest";
import { activeHref } from "./nav";

describe("activeHref", () => {
  it("matches the dashboard only on /", () => {
    expect(activeHref("/")).toBe("/");
    expect(activeHref("/drives")).toBe("/drives");
  });

  it("prefers the most specific route", () => {
    expect(activeHref("/updates")).toBe("/updates");
    expect(activeHref("/updates/impact")).toBe("/updates/impact");
  });

  it("matches detail pages and ignores lookalike prefixes", () => {
    expect(activeHref("/drives/42")).toBe("/drives");
    expect(activeHref("/charges-old")).toBeNull();
  });
});
