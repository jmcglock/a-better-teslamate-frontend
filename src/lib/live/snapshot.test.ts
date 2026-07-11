import { describe, expect, it } from "vitest";
import { applyMessage, parseTopic } from "@/lib/live/snapshot";

describe("parseTopic", () => {
  it("parses car id and field", () =>
    expect(parseTopic("teslamate/cars/1/battery_level")).toEqual({ carId: 1, field: "battery_level" }));
  it("rejects other topics", () => expect(parseTopic("teslamate/other/1/x")).toBeNull());
});

describe("applyMessage", () => {
  it("parses numeric fields", () =>
    expect(applyMessage({}, "battery_level", "72").battery_level).toBe(72));
  it("parses booleans", () => expect(applyMessage({}, "locked", "true").locked).toBe(true));
  it("keeps strings", () => expect(applyMessage({}, "state", "driving").state).toBe("driving"));
  it("empty payload → null", () => expect(applyMessage({}, "shift_state", "").shift_state).toBeNull());
  it("does not mutate input", () => {
    const a = { state: "online" };
    const b = applyMessage(a, "state", "driving");
    expect(a.state).toBe("online");
    expect(b.state).toBe("driving");
  });
});
