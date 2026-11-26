/**
 * Battery capacity forecast: least-squares linear trend over monthly full-pack
 * range samples, projected forward to the date capacity crosses a target % of
 * the baseline, with a 95% confidence band on the fitted trend.
 */

export const DAY_MS = 86_400_000;
export const FORECAST_TARGETS = [70, 75, 80, 85, 90] as const;
export const DEFAULT_FORECAST_TARGET = 80;
export const MIN_FORECAST_POINTS = 4;
export const MIN_FORECAST_SPAN_DAYS = 90;
/** Projections beyond this are reported as "beyond horizon". */
export const FORECAST_HORIZON_YEARS = 25;

export type ForecastStatus =
  | "ok"
  | "insufficient-data"
  | "already-below"
  | "not-declining"
  | "beyond-horizon";

export type ForecastBandPoint = { t: number; fit: number; lo: number; hi: number };

export type BatteryForecast = {
  status: ForecastStatus;
  targetPct: number;
  /** Baseline (km) the target % applies to: new-car range, else observed peak */
  baselineKm: number | null;
  targetKm: number | null;
  /** Number of samples used in the fit */
  points: number;
  /** Fitted trend slope, km per year (negative = losing range) */
  slopeKmPerYear: number | null;
  /** Fitted trend slope as % of baseline per year */
  slopePctPerYear: number | null;
  /** Coefficient of determination of the fit, 0..1 */
  r2: number | null;
  /** Central estimate of when the trend reaches targetKm */
  projectedAt: number | null;
  /** Earliest plausible crossing (lower confidence bound) */
  earliestAt: number | null;
  /** Latest plausible crossing (upper confidence bound); null when not bounded within horizon */
  latestAt: number | null;
  /** Fitted trend + confidence band, from first sample through the projection horizon shown */
  band: ForecastBandPoint[];
};

export function parseForecastTarget(raw: string | undefined | null): number {
  const n = Number(raw);
  return (FORECAST_TARGETS as readonly number[]).includes(n) ? n : DEFAULT_FORECAST_TARGET;
}

/** Two-sided 95% Student-t critical values for df 1..30; normal approx beyond. */
const T95 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
  2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086,
  2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];
export function tCritical95(df: number): number {
  if (df < 1) return Infinity;
  return df <= 30 ? T95[df - 1] : 1.96;
}

export type LinearFit = {
  n: number;
  slope: number;
  intercept: number;
  xMean: number;
  sxx: number;
  /** Residual standard error */
  s: number;
  r2: number;
};

/** Ordinary least squares y = intercept + slope * x. Requires n >= 3 and non-constant x. */
export function linearFit(xs: number[], ys: number[]): LinearFit | null {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const r = ys[i] - (intercept + slope * xs[i]);
    sse += r * r;
  }
  const s = Math.sqrt(sse / (n - 2));
  const r2 = syy === 0 ? 1 : Math.max(0, 1 - sse / syy);
  return { n, slope, intercept, xMean, sxx, s, r2 };
}

function bandAt(fit: LinearFit, x: number, tc: number): { fit: number; lo: number; hi: number } {
  const y = fit.intercept + fit.slope * x;
  const half = tc * fit.s * Math.sqrt(1 / fit.n + (x - fit.xMean) ** 2 / fit.sxx);
  return { fit: y, lo: y - half, hi: y + half };
}

/** First x (days) in [from, to] where f(x) <= target, found by stepping then bisecting. */
function firstCrossing(f: (x: number) => number, target: number, from: number, to: number, step: number): number | null {
  let prev = from;
  if (f(prev) <= target) return prev;
  for (let x = from + step; x <= to + step; x += step) {
    const cur = Math.min(x, to);
    if (f(cur) <= target) {
      let a = prev;
      let b = cur;
      for (let i = 0; i < 40; i++) {
        const m = (a + b) / 2;
        if (f(m) <= target) b = m;
        else a = m;
      }
      return b;
    }
    prev = cur;
    if (cur === to) break;
  }
  return null;
}

export function forecastBatteryCapacity(
  series: { t: number; v: number | null }[],
  opts: { baselineKm?: number | null; targetPct?: number; now?: number } = {},
): BatteryForecast {
  const targetPct = opts.targetPct ?? DEFAULT_FORECAST_TARGET;
  const pts = series
    .filter((p): p is { t: number; v: number } => p.v !== null && Number.isFinite(p.v) && p.v > 0 && Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  const peak = pts.length ? Math.max(...pts.map((p) => p.v)) : null;
  const baselineKm = opts.baselineKm && opts.baselineKm > 0 ? opts.baselineKm : peak;
  const targetKm = baselineKm ? (baselineKm * targetPct) / 100 : null;
  const empty: BatteryForecast = {
    status: "insufficient-data", targetPct, baselineKm, targetKm, points: pts.length,
    slopeKmPerYear: null, slopePctPerYear: null, r2: null,
    projectedAt: null, earliestAt: null, latestAt: null, band: [],
  };
  if (pts.length < MIN_FORECAST_POINTS || targetKm === null || baselineKm === null) return empty;

  const t0 = pts[0].t;
  const spanDays = (pts[pts.length - 1].t - t0) / DAY_MS;
  if (spanDays < MIN_FORECAST_SPAN_DAYS) return empty;

  const xs = pts.map((p) => (p.t - t0) / DAY_MS);
  const fit = linearFit(xs, pts.map((p) => p.v));
  if (!fit) return empty;

  const tc = tCritical95(fit.n - 2);
  const toT = (x: number) => Math.round(t0 + x * DAY_MS);
  const slopeKmPerYear = fit.slope * 365.25;
  const base: BatteryForecast = {
    ...empty,
    slopeKmPerYear,
    slopePctPerYear: (slopeKmPerYear / baselineKm) * 100,
    r2: fit.r2,
  };

  const nowX = Math.max(xs[xs.length - 1], ((opts.now ?? pts[pts.length - 1].t) - t0) / DAY_MS);
  const horizonX = nowX + FORECAST_HORIZON_YEARS * 365.25;
  const step = 30;
  const center = (x: number) => bandAt(fit, x, tc).fit;
  const lower = (x: number) => bandAt(fit, x, tc).lo;
  const upper = (x: number) => bandAt(fit, x, tc).hi;

  const lastX = xs[xs.length - 1];
  const buildBand = (endX: number): ForecastBandPoint[] => {
    const out: ForecastBandPoint[] = [];
    const end = Math.max(endX, lastX);
    const n = Math.max(2, Math.min(120, Math.ceil(end / step) + 1));
    for (let i = 0; i < n; i++) {
      const x = (end * i) / (n - 1);
      const b = bandAt(fit, x, tc);
      out.push({ t: toT(x), fit: b.fit, lo: b.lo, hi: b.hi });
    }
    return out;
  };

  if (center(lastX) <= targetKm) {
    return { ...base, status: "already-below", band: buildBand(lastX) };
  }
  if (fit.slope >= 0) {
    return { ...base, status: "not-declining", band: buildBand(lastX + 365.25) };
  }

  const projX = firstCrossing(center, targetKm, lastX, horizonX, step);
  const earliestX = firstCrossing(lower, targetKm, lastX, horizonX, step);
  if (projX === null) {
    return {
      ...base, status: "beyond-horizon",
      earliestAt: earliestX === null ? null : toT(earliestX),
      band: buildBand(lastX + 2 * 365.25),
    };
  }
  const latestX = firstCrossing(upper, targetKm, lastX, horizonX, step);
  const shownEnd = Math.min(latestX ?? projX * 1.5, horizonX);
  return {
    ...base,
    status: "ok",
    projectedAt: toT(projX),
    earliestAt: earliestX === null ? null : toT(earliestX),
    latestAt: latestX === null ? null : toT(latestX),
    band: buildBand(Math.max(shownEnd, projX)),
  };
}
