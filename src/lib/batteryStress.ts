export const HIGH_SOC_PCT = 80;
export const LOW_SOC_PCT = 20;
export const HIGH_STRESS_TEMP_C = 30;
export const DEEP_DOD_PCT = 60;
const BUCKET_SIZE = 10;
const BUCKET_COUNT = 100 / BUCKET_SIZE;

export type SocSample = {
  soc: number;
  /** Time this sample represents, in hours. */
  hours: number;
  outsideTempC: number | null;
};

export type DailySocRange = {
  /** YYYY-MM-DD (UTC) */
  date: string;
  minSoc: number;
  maxSoc: number;
};

export type ChargeEndSoc = {
  endSoc: number;
  energyKwh: number | null;
};

export type SocBucket = {
  fromSoc: number;
  toSoc: number;
  label: string;
  hours: number;
  pct: number;
};

export type EndSocBucket = {
  fromSoc: number;
  toSoc: number;
  label: string;
  count: number;
  pct: number;
  energyKwh: number;
};

export type DailyDodPoint = {
  date: string;
  label: string;
  dodPct: number;
};

export type BatteryStress = {
  totalHours: number;
  histogram: SocBucket[];
  pctAbove80: number | null;
  pctBelow20: number | null;
  highTempHighSoc: {
    hours: number;
    pct: number | null;
    tempC: number;
    socPct: number;
  };
  dailyDod: {
    days: number;
    avgPct: number | null;
    maxPct: number | null;
    deepDays: number;
    deepPct: number | null;
    series: DailyDodPoint[];
  };
  energyThroughputKwh: number;
  packKwh: number | null;
  equivalentCycles: number | null;
  endSoc: {
    sessions: number;
    median: number | null;
    pctAtOrAbove80: number | null;
    buckets: EndSocBucket[];
  };
};

const round = (v: number, places: number) => {
  const p = 10 ** places;
  return Math.round(v * p) / p;
};

export function socBucketLabel(fromSoc: number, toSoc: number): string {
  return `${fromSoc}-${toSoc}%`;
}

function bucketIndex(soc: number): number {
  return Math.min(BUCKET_COUNT - 1, Math.max(0, Math.floor(soc / BUCKET_SIZE)));
}

function emptySocBuckets(): SocBucket[] {
  return Array.from({ length: BUCKET_COUNT }, (_, i) => ({
    fromSoc: i * BUCKET_SIZE,
    toSoc: (i + 1) * BUCKET_SIZE,
    label: socBucketLabel(i * BUCKET_SIZE, (i + 1) * BUCKET_SIZE),
    hours: 0,
    pct: 0,
  }));
}

/** Time-weighted SoC histogram plus tail and heat exposure. */
export function buildSocHistogram(samples: readonly SocSample[]): {
  buckets: SocBucket[];
  totalHours: number;
  pctAbove80: number | null;
  pctBelow20: number | null;
  highTempHighSocHours: number;
  highTempHighSocPct: number | null;
} {
  const buckets = emptySocBuckets();
  let totalHours = 0;
  let aboveHours = 0;
  let belowHours = 0;
  let tempHours = 0;
  let hotFullHours = 0;

  for (const sample of samples) {
    if (!Number.isFinite(sample.soc) || !Number.isFinite(sample.hours) || sample.hours <= 0) continue;
    const soc = Math.min(100, Math.max(0, sample.soc));
    const hours = sample.hours;

    buckets[bucketIndex(soc)].hours += hours;
    totalHours += hours;
    if (soc > HIGH_SOC_PCT) aboveHours += hours;
    if (soc < LOW_SOC_PCT) belowHours += hours;

    const temp = sample.outsideTempC;
    if (temp !== null && Number.isFinite(temp)) {
      tempHours += hours;
      if (soc >= HIGH_SOC_PCT && temp >= HIGH_STRESS_TEMP_C) hotFullHours += hours;
    }
  }

  return {
    buckets: buckets.map((bucket) => ({
      ...bucket,
      hours: round(bucket.hours, 2),
      pct: totalHours > 0 ? round((bucket.hours / totalHours) * 100, 1) : 0,
    })),
    totalHours: round(totalHours, 2),
    pctAbove80: totalHours > 0 ? round((aboveHours / totalHours) * 100, 1) : null,
    pctBelow20: totalHours > 0 ? round((belowHours / totalHours) * 100, 1) : null,
    highTempHighSocHours: round(hotFullHours, 2),
    highTempHighSocPct: tempHours > 0 ? round((hotFullHours / tempHours) * 100, 1) : null,
  };
}

/** Daily depth of discharge from each day's observed SoC range. */
export function buildDailyDod(rows: readonly DailySocRange[]): {
  days: number;
  avgPct: number | null;
  maxPct: number | null;
  deepDays: number;
  deepPct: number | null;
  series: DailyDodPoint[];
} {
  const series = rows
    .filter(
      (row) =>
        Number.isFinite(row.minSoc) &&
        Number.isFinite(row.maxSoc) &&
        row.maxSoc >= row.minSoc,
    )
    .map((row) => ({
      date: row.date,
      label: row.date.slice(5),
      dodPct: round(row.maxSoc - row.minSoc, 1),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (series.length === 0) {
    return { days: 0, avgPct: null, maxPct: null, deepDays: 0, deepPct: null, series };
  }

  const sum = series.reduce((total, point) => total + point.dodPct, 0);
  const deepDays = series.filter((point) => point.dodPct >= DEEP_DOD_PCT).length;
  return {
    days: series.length,
    avgPct: round(sum / series.length, 1),
    maxPct: round(Math.max(...series.map((point) => point.dodPct)), 1),
    deepDays,
    deepPct: round((deepDays / series.length) * 100, 1),
    series,
  };
}

/** Distribution of the SoC a charging session ended at. */
export function buildEndSocDistribution(charges: readonly ChargeEndSoc[]): {
  sessions: number;
  median: number | null;
  pctAtOrAbove80: number | null;
  buckets: EndSocBucket[];
} {
  const buckets: EndSocBucket[] = Array.from({ length: BUCKET_COUNT }, (_, i) => ({
    fromSoc: i * BUCKET_SIZE,
    toSoc: (i + 1) * BUCKET_SIZE,
    label: socBucketLabel(i * BUCKET_SIZE, (i + 1) * BUCKET_SIZE),
    count: 0,
    pct: 0,
    energyKwh: 0,
  }));

  const values: number[] = [];
  for (const charge of charges) {
    if (!Number.isFinite(charge.endSoc)) continue;
    const soc = Math.min(100, Math.max(0, charge.endSoc));
    const bucket = buckets[bucketIndex(soc)];
    bucket.count += 1;
    bucket.energyKwh += Number.isFinite(charge.energyKwh) ? Math.max(0, charge.energyKwh ?? 0) : 0;
    values.push(soc);
  }

  const sessions = values.length;
  values.sort((a, b) => a - b);
  const median =
    sessions === 0
      ? null
      : sessions % 2 === 1
        ? round(values[(sessions - 1) / 2], 1)
        : round((values[sessions / 2 - 1] + values[sessions / 2]) / 2, 1);
  const atOrAbove80 = values.filter((soc) => soc >= HIGH_SOC_PCT).length;

  return {
    sessions,
    median,
    pctAtOrAbove80: sessions > 0 ? round((atOrAbove80 / sessions) * 100, 1) : null,
    buckets: buckets.map((bucket) => ({
      ...bucket,
      pct: sessions > 0 ? round((bucket.count / sessions) * 100, 1) : 0,
      energyKwh: round(bucket.energyKwh, 1),
    })),
  };
}

/** Equivalent full cycles from energy throughput and usable pack size. */
export function equivalentFullCycles(
  energyThroughputKwh: number,
  packKwh: number | null,
): number | null {
  if (packKwh === null || !Number.isFinite(packKwh) || packKwh <= 0) return null;
  if (!Number.isFinite(energyThroughputKwh) || energyThroughputKwh <= 0) return 0;
  return round(energyThroughputKwh / packKwh, 2);
}

/** Pure roll-up so the page math is unit-testable without Postgres. */
export function buildBatteryStress(input: {
  samples: readonly SocSample[];
  daily: readonly DailySocRange[];
  endSocs: readonly ChargeEndSoc[];
  energyThroughputKwh: number;
  packKwh: number | null;
}): BatteryStress {
  const histogram = buildSocHistogram(input.samples);
  const dailyDod = buildDailyDod(input.daily);
  const endSoc = buildEndSocDistribution(input.endSocs);
  const energyThroughputKwh = round(Math.max(0, input.energyThroughputKwh), 1);

  return {
    totalHours: histogram.totalHours,
    histogram: histogram.buckets,
    pctAbove80: histogram.pctAbove80,
    pctBelow20: histogram.pctBelow20,
    highTempHighSoc: {
      hours: histogram.highTempHighSocHours,
      pct: histogram.highTempHighSocPct,
      tempC: HIGH_STRESS_TEMP_C,
      socPct: HIGH_SOC_PCT,
    },
    dailyDod,
    energyThroughputKwh,
    packKwh: input.packKwh,
    equivalentCycles: equivalentFullCycles(energyThroughputKwh, input.packKwh),
    endSoc,
  };
}
