import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  DEFAULT_FORECAST_TARGET,
  forecastBatteryCapacity,
  linearFit,
  parseForecastTarget,
  tCritical95,
} from "./batteryForecast";

const T0 = Date.UTC(2022, 0, 1);
const YEAR = 365.25 * DAY_MS;

/** Monthly samples losing `kmPerYear`, with optional deterministic jitter. */
function series(months: number, startKm: number, kmPerYear: number, jitter = 0) {
  return Array.from({ length: months }, (_, i) => {
    const t = T0 + (i * YEAR) / 12;
    const noise = jitter ? (i % 2 === 0 ? jitter : -jitter) : 0;
    return { t, v: startKm - (kmPerYear * i) / 12 + noise };
  });
}

describe("parseForecastTarget", () => {
  it("accepts supported targets and falls back to the default", () => {
    expect(parseForecastTarget("70")).toBe(70);
    expect(parseForecastTarget("85")).toBe(85);
    expect(parseForecastTarget("81")).toBe(DEFAULT_FORECAST_TARGET);
    expect(parseForecastTarget(undefined)).toBe(80);
    expect(parseForecastTarget("abc")).toBe(80);
  });
});

describe("linearFit", () => {
  it("recovers an exact line", () => {
    const fit = linearFit([0, 1, 2, 3], [10, 8, 6, 4]);
    expect(fit?.slope).toBeCloseTo(-2);
    expect(fit?.intercept).toBeCloseTo(10);
    expect(fit?.r2).toBeCloseTo(1);
    expect(fit?.s).toBeCloseTo(0);
  });

  it("rejects too few points or constant x", () => {
    expect(linearFit([0, 1], [1, 2])).toBeNull();
    expect(linearFit([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});

describe("tCritical95", () => {
  it("uses the t table for small df and the normal approximation beyond", () => {
    expect(tCritical95(2)).toBeCloseTo(4.303);
    expect(tCritical95(100)).toBe(1.96);
    expect(tCritical95(0)).toBe(Infinity);
  });
});

describe("forecastBatteryCapacity", () => {
  it("projects the 80% crossing for a steady decline", () => {
    // 500 km baseline, losing 10 km/yr from 490 → 400 km (80%) reached 9 years after T0.
    const f = forecastBatteryCapacity(series(24, 490, 10), { baselineKm: 500 });
    expect(f.status).toBe("ok");
    expect(f.targetKm).toBe(400);
    expect(f.slopeKmPerYear).toBeCloseTo(-10, 5);
    expect(f.slopePctPerYear).toBeCloseTo(-2, 5);
    expect((f.projectedAt! - T0) / YEAR).toBeCloseTo(9, 1);
    // Perfect data → confidence range collapses onto the estimate.
    expect(Math.abs(f.earliestAt! - f.projectedAt!)).toBeLessThan(2 * DAY_MS);
    expect(Math.abs(f.latestAt! - f.projectedAt!)).toBeLessThan(2 * DAY_MS);
    expect(f.band.length).toBeGreaterThan(2);
    expect(f.band[f.band.length - 1].t).toBeGreaterThanOrEqual(f.projectedAt!);
  });

  it("widens the confidence range with noisy data and brackets the estimate", () => {
    const f = forecastBatteryCapacity(series(24, 490, 10, 4), { baselineKm: 500 });
    expect(f.status).toBe("ok");
    expect(f.earliestAt!).toBeLessThan(f.projectedAt!);
    expect(f.latestAt!).toBeGreaterThan(f.projectedAt!);
    expect(f.r2!).toBeLessThan(1);
    for (const p of f.band) {
      expect(p.lo).toBeLessThanOrEqual(p.fit);
      expect(p.hi).toBeGreaterThanOrEqual(p.fit);
    }
  });

  it("honours a custom target", () => {
    const f = forecastBatteryCapacity(series(24, 490, 10), { baselineKm: 500, targetPct: 90 });
    expect(f.targetKm).toBe(450);
    expect((f.projectedAt! - T0) / YEAR).toBeCloseTo(4, 1);
  });

  it("falls back to the observed peak when no baseline is known", () => {
    const f = forecastBatteryCapacity(series(24, 500, 20));
    expect(f.baselineKm).toBe(500);
    expect(f.targetKm).toBe(400);
    expect((f.projectedAt! - T0) / YEAR).toBeCloseTo(5, 1);
  });

  it("reports insufficient data for too few points or too short a span", () => {
    expect(forecastBatteryCapacity(series(3, 490, 10), { baselineKm: 500 }).status).toBe("insufficient-data");
    const short = [0, 10, 20, 30, 40].map((d) => ({ t: T0 + d * DAY_MS, v: 480 - d }));
    expect(forecastBatteryCapacity(short, { baselineKm: 500 }).status).toBe("insufficient-data");
    expect(forecastBatteryCapacity([], { baselineKm: 500 }).status).toBe("insufficient-data");
  });

  it("ignores null and non-positive samples", () => {
    const s = [...series(12, 490, 10), { t: T0 + 2 * YEAR, v: null }, { t: T0 + 3 * YEAR, v: 0 }];
    const f = forecastBatteryCapacity(s, { baselineKm: 500 });
    expect(f.points).toBe(12);
    expect(f.status).toBe("ok");
  });

  it("handles a flat or improving trend", () => {
    const f = forecastBatteryCapacity(series(12, 480, -5), { baselineKm: 500 });
    expect(f.status).toBe("not-declining");
    expect(f.projectedAt).toBeNull();
    expect(f.band.length).toBeGreaterThan(0);
  });

  it("flags capacity already under the target", () => {
    const f = forecastBatteryCapacity(series(12, 390, 5), { baselineKm: 500 });
    expect(f.status).toBe("already-below");
    expect(f.projectedAt).toBeNull();
  });

  it("reports beyond-horizon for an extremely slow decline", () => {
    const f = forecastBatteryCapacity(series(24, 499, 0.5), { baselineKm: 500 });
    expect(f.status).toBe("beyond-horizon");
    expect(f.projectedAt).toBeNull();
  });

  it("leaves the latest bound open when the upper band never declines", () => {
    const noisy = series(6, 490, 10).map((p, i) => ({ ...p, v: p.v + (i % 2 === 0 ? 30 : -30) }));
    const f = forecastBatteryCapacity(noisy, { baselineKm: 500 });
    expect(f.status).toBe("ok");
    expect(f.projectedAt).not.toBeNull();
    expect(f.earliestAt).not.toBeNull();
    expect(f.latestAt).toBeNull();
  });
});
