import { describe, expect, it } from "vitest";
import {
  buildUpdateImpact,
  type ImpactSamples,
  type ImpactSample,
  type UpdateEvent,
} from "./updateImpact";

const update = (id: number, version: string, installedAt: string): UpdateEvent => ({
  id,
  version,
  installedAt,
});

const sample = (
  at: string,
  value: number,
  tempC: number | null,
  weight?: number,
): ImpactSample => ({ at, value, tempC, weight });

const emptySamples = (): ImpactSamples => ({
  efficiency: [],
  range: [],
  dcSpeed: [],
  standbyDrain: [],
});

describe("buildUpdateImpact", () => {
  it("computes distance-weighted efficiency before and after an install", () => {
    const rows = buildUpdateImpact(
      [update(1, "2026.20", "2026-06-01T00:00:00Z")],
      {
        ...emptySamples(),
        efficiency: [
          sample("2026-05-01T00:00:00Z", 200, 15, 100),
          sample("2026-05-02T00:00:00Z", 100, 15, 100),
          sample("2026-06-02T00:00:00Z", 120, 15, 100),
          sample("2026-06-03T00:00:00Z", 140, 15, 100),
        ],
      },
    );

    expect(rows).toHaveLength(1);
    const efficiency = rows[0].metrics.efficiency;
    expect(efficiency.before).toBe(150);
    expect(efficiency.after).toBe(130);
    expect(efficiency.delta).toBe(-20);
    expect(efficiency.deltaPct).toBe(-13.3);
    expect(efficiency.beforeSamples).toBe(2);
    expect(efficiency.afterSamples).toBe(2);
    expect(efficiency.lowSample).toBe(true);
    expect(efficiency.tempMatch).toBe("matched");
    expect(efficiency.tempBand).toEqual({ minC: 15, maxC: 15 });
  });

  it("keeps only the shared temperature band on both sides", () => {
    const rows = buildUpdateImpact(
      [update(1, "2026.20", "2026-06-01T00:00:00Z")],
      {
        ...emptySamples(),
        efficiency: [
          sample("2026-05-01T00:00:00Z", 300, 0),
          sample("2026-05-02T00:00:00Z", 200, 10),
          sample("2026-05-03T00:00:00Z", 100, 20),
          sample("2026-06-02T00:00:00Z", 280, 5),
          sample("2026-06-03T00:00:00Z", 180, 15),
          sample("2026-06-04T00:00:00Z", 80, 25),
        ],
      },
      { tempToleranceC: 5, minSamples: 1 },
    );

    const efficiency = rows[0].metrics.efficiency;
    expect(efficiency.tempMatch).toBe("matched");
    expect(efficiency.tempBand).toEqual({ minC: 7.5, maxC: 17.5 });
    expect(efficiency.before).toBe(200);
    expect(efficiency.after).toBe(180);
    expect(efficiency.beforeSamples).toBe(1);
    expect(efficiency.afterSamples).toBe(1);
    expect(efficiency.beforeTotal).toBe(3);
    expect(efficiency.afterTotal).toBe(3);
    expect(efficiency.lowSample).toBe(false);
  });

  it("returns a blank comparison when the windows share no temperatures", () => {
    const rows = buildUpdateImpact(
      [update(1, "2026.20", "2026-06-01T00:00:00Z")],
      {
        ...emptySamples(),
        range: [
          sample("2026-05-01T00:00:00Z", 400, 0),
          sample("2026-05-02T00:00:00Z", 395, 5),
          sample("2026-06-02T00:00:00Z", 380, 20),
          sample("2026-06-03T00:00:00Z", 375, 25),
        ],
      },
    );

    const range = rows[0].metrics.range;
    expect(range.tempMatch).toBe("no-overlap");
    expect(range.tempBand).toBeNull();
    expect(range.before).toBeNull();
    expect(range.after).toBeNull();
    expect(range.delta).toBeNull();
    expect(range.deltaPct).toBeNull();
    expect(range.beforeSamples).toBe(0);
    expect(range.afterSamples).toBe(0);
    expect(range.beforeTotal).toBe(2);
    expect(range.afterTotal).toBe(2);
  });

  it("clamps windows at neighbouring installs", () => {
    const rows = buildUpdateImpact(
      [
        update(1, "2026.10", "2026-01-01T00:00:00Z"),
        update(2, "2026.20", "2026-03-01T00:00:00Z"),
        update(3, "2026.30", "2026-05-01T00:00:00Z"),
      ],
      {
        ...emptySamples(),
        efficiency: [
          sample("2025-12-15T00:00:00Z", 200, 15),
          sample("2026-01-15T00:00:00Z", 200, 15),
          sample("2026-02-15T00:00:00Z", 200, 15),
          sample("2026-03-15T00:00:00Z", 200, 15),
          sample("2026-04-15T00:00:00Z", 200, 15),
          sample("2026-05-15T00:00:00Z", 200, 15),
        ],
      },
      { beforeDays: 90, afterDays: 90 },
    );

    expect(rows.map((row) => row.version)).toEqual(["2026.30", "2026.20", "2026.10"]);

    const newest = rows[0];
    const middle = rows[1];
    const oldest = rows[2];

    expect(middle.previousVersion).toBe("2026.10");
    expect(middle.nextVersion).toBe("2026.30");
    expect(oldest.previousVersion).toBeNull();
    expect(newest.nextVersion).toBeNull();

    expect(oldest.before.start).toBe("2025-10-03T00:00:00.000Z");
    expect(oldest.metrics.efficiency.beforeSamples).toBe(1);
    expect(oldest.metrics.efficiency.afterSamples).toBe(2);

    expect(middle.before.start).toBe("2026-01-01T00:00:00.000Z");
    expect(middle.after.end).toBe("2026-05-01T00:00:00.000Z");
    expect(middle.metrics.efficiency.beforeSamples).toBe(2);
    expect(middle.metrics.efficiency.afterSamples).toBe(2);

    expect(newest.metrics.efficiency.beforeSamples).toBe(2);
    expect(newest.metrics.efficiency.afterSamples).toBe(1);
  });

  it("falls back to all samples when one side has no temperature readings", () => {
    const rows = buildUpdateImpact(
      [update(1, "2026.20", "2026-06-01T00:00:00Z")],
      {
        ...emptySamples(),
        dcSpeed: [
          sample("2026-05-01T00:00:00Z", 150, null, 40),
          sample("2026-06-02T00:00:00Z", 120, 15, 40),
        ],
      },
    );

    const dcSpeed = rows[0].metrics.dcSpeed;
    expect(dcSpeed.tempMatch).toBe("unavailable");
    expect(dcSpeed.tempBand).toBeNull();
    expect(dcSpeed.before).toBe(150);
    expect(dcSpeed.after).toBe(120);
    expect(dcSpeed.delta).toBe(-30);
    expect(dcSpeed.deltaPct).toBe(-20);
    expect(dcSpeed.beforeSamples).toBe(1);
    expect(dcSpeed.afterSamples).toBe(1);
  });

  it("leaves the comparison blank when one side has no samples", () => {
    const rows = buildUpdateImpact(
      [update(1, "2026.20", "2026-06-01T00:00:00Z")],
      {
        ...emptySamples(),
        standbyDrain: [sample("2026-06-02T00:00:00Z", 0.4, 10)],
      },
    );

    const drain = rows[0].metrics.standbyDrain;
    expect(drain.tempMatch).toBe("empty");
    expect(drain.before).toBeNull();
    expect(drain.after).toBeNull();
    expect(drain.beforeSamples).toBe(0);
    expect(drain.afterSamples).toBe(0);
    expect(drain.beforeTotal).toBe(0);
    expect(drain.afterTotal).toBe(1);
  });

  it("allows a zero standby drain and reports an undefined relative change", () => {
    const rows = buildUpdateImpact(
      [update(1, "2026.20", "2026-06-01T00:00:00Z")],
      {
        ...emptySamples(),
        standbyDrain: [
          sample("2026-05-01T00:00:00Z", 0, 10, 24),
          sample("2026-06-02T00:00:00Z", 0.5, 10, 24),
        ],
      },
    );

    const drain = rows[0].metrics.standbyDrain;
    expect(drain.before).toBe(0);
    expect(drain.after).toBe(0.5);
    expect(drain.delta).toBe(0.5);
    expect(drain.deltaPct).toBeNull();
  });

  it("rounds metrics to display precision", () => {
    const rows = buildUpdateImpact(
      [update(1, "2026.20", "2026-06-01T00:00:00Z")],
      {
        ...emptySamples(),
        range: [
          sample("2026-05-01T00:00:00Z", 401.24, 10),
          sample("2026-06-02T00:00:00Z", 398.16, 10),
        ],
      },
    );

    const range = rows[0].metrics.range;
    expect(range.before).toBe(401.2);
    expect(range.after).toBe(398.2);
    expect(range.delta).toBe(-3.1);
  });

  it("ignores updates with invalid timestamps", () => {
    const rows = buildUpdateImpact(
      [update(1, "bad", "not-a-date"), update(2, "2026.20", "2026-06-01T00:00:00Z")],
      emptySamples(),
    );
    expect(rows.map((row) => row.version)).toEqual(["2026.20"]);
  });
});
