import { describe, expect, it } from "vitest";
import { applyMessage, parseActiveRoute, parseTopic } from "@/lib/live/snapshot";

describe("parseTopic", () => {
  it("parses car id and field", () =>
    expect(parseTopic("teslamate/cars/1/battery_level")).toEqual({ carId: 1, field: "battery_level" }));
  it("rejects other topics", () => expect(parseTopic("teslamate/other/1/x")).toBeNull());
});

describe("applyMessage", () => {
  it("parses numeric fields", () =>
    expect(applyMessage({}, "battery_level", "72").battery_level).toBe(72));
  it("parses booleans", () => expect(applyMessage({}, "locked", "true").locked).toBe(true));
  it("parses new door/tpms/service booleans", () => {
    expect(applyMessage({}, "driver_front_door_open", "true").driver_front_door_open).toBe(true);
    expect(applyMessage({}, "tpms_soft_warning_fl", "false").tpms_soft_warning_fl).toBe(false);
    expect(applyMessage({}, "service_mode", "true").service_mode).toBe(true);
  });
  it("parses download/install perc", () => {
    expect(applyMessage({}, "download_perc", "42").download_perc).toBe(42);
  });
  it("keeps strings", () => expect(applyMessage({}, "state", "driving").state).toBe("driving"));
  it("empty payload → null", () => expect(applyMessage({}, "shift_state", "").shift_state).toBeNull());
  it("does not mutate input", () => {
    const a = { state: "online" };
    const b = applyMessage(a, "state", "driving");
    expect(a.state).toBe("online");
    expect(b.state).toBe("driving");
  });
});

describe("parseActiveRoute", () => {
  it("parses route JSON", () => {
    const r = parseActiveRoute(JSON.stringify({
      destination: "Home",
      energy_at_arrival: 73,
      miles_to_arrival: 6.5,
      minutes_to_arrival: 23.5,
      traffic_minutes_delay: 0,
      location: { latitude: 35.2, longitude: 29.7 },
      error: null,
    }));
    expect(r?.destination).toBe("Home");
    expect(r?.energyAtArrival).toBe(73);
    expect(r?.minutesToArrival).toBeCloseTo(23.5);
    expect(r?.latitude).toBeCloseTo(35.2);
  });
  it("null when no active route", () => {
    expect(parseActiveRoute(JSON.stringify({ error: "No active route available" }))).toBeNull();
    expect(parseActiveRoute(null)).toBeNull();
    expect(parseActiveRoute("")).toBeNull();
  });
});
