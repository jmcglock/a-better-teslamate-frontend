import { describe, expect, it } from "vitest";
import { mapStateRow } from "@/lib/db/timeline";

describe("mapStateRow", () => {
  it("maps duration when ended", () => {
    const s = mapStateRow({
      id: 1,
      state: "asleep",
      start_date: new Date("2026-07-01T00:00:00Z"),
      end_date: new Date("2026-07-01T02:30:00Z"),
      car_name: "Blue",
      car_id: 1,
    });
    expect(s.durationMin).toBe(150);
    expect(s.carName).toBe("Blue");
    expect(s.state).toBe("asleep");
  });
  it("null duration when open", () => {
    const s = mapStateRow({
      id: 2,
      state: "online",
      start_date: new Date("2026-07-01T00:00:00Z"),
      end_date: null,
      car_name: null,
      car_id: 3,
    });
    expect(s.durationMin).toBeNull();
    expect(s.carName).toBe("Car 3");
  });
});
