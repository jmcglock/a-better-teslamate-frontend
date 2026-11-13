/** Pure state-time roll-up for TeslaMate's `states` history. */

export const USAGE_STATES = [
  "driving",
  "charging",
  "asleep",
  "online",
  "offline",
  "updating",
] as const;

export type UsageState = (typeof USAGE_STATES)[number];

export type UsageInterval = {
  state: string;
  /** ISO timestamp */
  start: string;
  /** ISO timestamp, or null while the state is still open */
  end: string | null;
};

export type UsageWindow = {
  /** ISO timestamp */
  start: string;
  /** ISO timestamp */
  end: string;
};

export type StateAllocation = {
  state: UsageState;
  seconds: number;
  hours: number;
  pct: number;
};

export type UsageMonthPoint = {
  /** YYYY-MM */
  month: string;
  label: string;
  asleepHours: number;
  awakeHours: number;
  drivingHours: number;
  chargingHours: number;
  wakeups: number;
  wakeupsPerDay: number | null;
};

export type UsageInsights = {
  allocation: StateAllocation[];
  totalHours: number;
  days: number;
  intervalCount: number;
  wakeups: number;
  wakeupsPerDay: number | null;
  longestSleepHours: number | null;
  longestSleepStart: string | null;
  awakeNotDrivingHours: number;
  awakeNotDrivingPct: number | null;
  monthly: UsageMonthPoint[];
  windowStart: string;
  windowEnd: string;
};

const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

const AWAKE = new Set<UsageState>(["driving", "charging", "online", "updating"]);
const ASLEEP = new Set<UsageState>(["asleep", "offline"]);

const round = (v: number, places: number): number => {
  const p = 10 ** places;
  return Math.round(v * p) / p;
};

/**
 * Collapse TeslaMate's state enum into the six analytics buckets.
 * `suspended` is TeslaMate's "falling asleep" transition, and `idle` is an
 * awake-but-parked car. Unknown values are treated as awake/online.
 */
export function normalizeUsageState(state: string): UsageState {
  switch (state) {
    case "driving":
      return "driving";
    case "charging":
    case "supercharging":
      return "charging";
    case "asleep":
    case "suspended":
      return "asleep";
    case "offline":
      return "offline";
    case "updating":
      return "updating";
    default:
      return "online";
  }
}

function parseMs(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function monthKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 7);
}

export function usageMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${month} ${String(y).slice(-2)}`;
}

type Clipped = { state: UsageState; start: number; end: number };

function clipIntervals(intervals: UsageInterval[], windowStart: number, windowEnd: number): Clipped[] {
  const out: Clipped[] = [];
  for (const interval of intervals) {
    const start = parseMs(interval.start);
    if (start === null) continue;
    const rawEnd = interval.end === null ? windowEnd : parseMs(interval.end);
    if (rawEnd === null) continue;
    const clippedStart = Math.max(start, windowStart);
    const clippedEnd = Math.min(rawEnd, windowEnd);
    if (clippedEnd <= clippedStart) continue;
    out.push({
      state: normalizeUsageState(interval.state),
      start: clippedStart,
      end: clippedEnd,
    });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Merge back-to-back rows for the same state so sleep runs stay contiguous. */
function mergeIntervals(intervals: Clipped[]): Clipped[] {
  const out: Clipped[] = [];
  for (const interval of intervals) {
    const last = out[out.length - 1];
    if (last && last.state === interval.state && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      out.push({ ...interval });
    }
  }
  return out;
}

/** Calendar months touched by the window, oldest first. */
function windowMonths(windowStart: number, windowEnd: number): string[] {
  const out: string[] = [];
  const start = new Date(windowStart);
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  while (Date.UTC(year, month, 1) < windowEnd) {
    out.push(`${year}-${String(month + 1).padStart(2, "0")}`);
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  return out;
}

function monthBounds(key: string): { start: number; end: number } {
  const [year, month] = key.split("-").map(Number);
  return {
    start: Date.UTC(year, (month || 1) - 1, 1),
    end: Date.UTC(year, month || 1, 1),
  };
}

/** Split a clipped interval at UTC month boundaries. */
function splitByMonth(start: number, end: number): { month: string; seconds: number }[] {
  const out: { month: string; seconds: number }[] = [];
  let cursor = start;
  while (cursor < end) {
    const d = new Date(cursor);
    const nextMonth = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    const chunkEnd = Math.min(end, nextMonth);
    out.push({ month: monthKey(cursor), seconds: (chunkEnd - cursor) / 1000 });
    cursor = chunkEnd;
  }
  return out;
}

type MonthBucket = {
  asleep: number;
  awake: number;
  driving: number;
  charging: number;
  wakeups: number;
  days: number;
};

/**
 * Roll TeslaMate state intervals into the analytics shown on /usage:
 * time allocation, wakeups per day, longest sleep, awake-not-driving time,
 * and a monthly trend. Intervals are clipped to the requested window and open
 * states are closed at the window end.
 */
export function buildUsageInsights(
  intervals: UsageInterval[],
  window: UsageWindow,
): UsageInsights {
  const windowStart = parseMs(window.start);
  const windowEnd = parseMs(window.end);

  if (windowStart === null || windowEnd === null || windowEnd <= windowStart) {
    return {
      allocation: USAGE_STATES.map((state) => ({ state, seconds: 0, hours: 0, pct: 0 })),
      totalHours: 0,
      days: 0,
      intervalCount: 0,
      wakeups: 0,
      wakeupsPerDay: null,
      longestSleepHours: null,
      longestSleepStart: null,
      awakeNotDrivingHours: 0,
      awakeNotDrivingPct: null,
      monthly: [],
      windowStart: window.start,
      windowEnd: window.end,
    };
  }

  const clipped = mergeIntervals(clipIntervals(intervals, windowStart, windowEnd));

  const byState = new Map<UsageState, number>(USAGE_STATES.map((state) => [state, 0]));
  let totalSeconds = 0;
  for (const interval of clipped) {
    const seconds = (interval.end - interval.start) / 1000;
    byState.set(interval.state, (byState.get(interval.state) ?? 0) + seconds);
    totalSeconds += seconds;
  }

  const allocation: StateAllocation[] = USAGE_STATES.map((state) => {
    const seconds = byState.get(state) ?? 0;
    return {
      state,
      seconds: Math.round(seconds),
      hours: round(seconds / 3600, 2),
      pct: totalSeconds > 0 ? round((seconds / totalSeconds) * 100, 1) : 0,
    };
  });

  const days = (windowEnd - windowStart) / MS_DAY;
  const monthKeys = windowMonths(windowStart, windowEnd);
  const buckets = new Map<string, MonthBucket>(
    monthKeys.map((key) => {
      const bounds = monthBounds(key);
      const overlapStart = Math.max(bounds.start, windowStart);
      const overlapEnd = Math.min(bounds.end, windowEnd);
      return [
        key,
        {
          asleep: 0,
          awake: 0,
          driving: 0,
          charging: 0,
          wakeups: 0,
          days: Math.max(0, overlapEnd - overlapStart) / MS_DAY,
        },
      ];
    }),
  );

  let wakeups = 0;
  let longestSleep = 0;
  let longestSleepStart: string | null = null;
  let previous: UsageState | null = null;

  for (const interval of clipped) {
    for (const part of splitByMonth(interval.start, interval.end)) {
      const bucket = buckets.get(part.month);
      if (!bucket) continue;
      if (interval.state === "asleep") {
        bucket.asleep += part.seconds;
      } else if (AWAKE.has(interval.state)) {
        bucket.awake += part.seconds;
        if (interval.state === "driving") bucket.driving += part.seconds;
        if (interval.state === "charging") bucket.charging += part.seconds;
      }
    }

    if (interval.state === "asleep") {
      const seconds = (interval.end - interval.start) / 1000;
      if (seconds > longestSleep) {
        longestSleep = seconds;
        longestSleepStart = new Date(interval.start).toISOString();
      }
    }

    if (previous !== null && ASLEEP.has(previous) && AWAKE.has(interval.state)) {
      wakeups += 1;
      const bucket = buckets.get(monthKey(interval.start));
      if (bucket) bucket.wakeups += 1;
    }
    previous = interval.state;
  }

  const monthly: UsageMonthPoint[] = monthKeys.map((key) => {
    const bucket = buckets.get(key);
    const monthDays = bucket?.days ?? 0;
    return {
      month: key,
      label: usageMonthLabel(key),
      asleepHours: round((bucket?.asleep ?? 0) / 3600, 2),
      awakeHours: round((bucket?.awake ?? 0) / 3600, 2),
      drivingHours: round((bucket?.driving ?? 0) / 3600, 2),
      chargingHours: round((bucket?.charging ?? 0) / 3600, 2),
      wakeups: bucket?.wakeups ?? 0,
      wakeupsPerDay:
        monthDays > 0 ? round((bucket?.wakeups ?? 0) / monthDays, 2) : null,
    };
  });

  const awakeNotDrivingSeconds =
    (byState.get("online") ?? 0) + (byState.get("charging") ?? 0) + (byState.get("updating") ?? 0);
  const awakeSeconds = awakeNotDrivingSeconds + (byState.get("driving") ?? 0);

  return {
    allocation,
    totalHours: round(totalSeconds / 3600, 2),
    days: round(days, 2),
    intervalCount: clipped.length,
    wakeups,
    wakeupsPerDay: days > 0 ? round(wakeups / days, 2) : null,
    longestSleepHours: longestSleep > 0 ? round(longestSleep / 3600, 2) : null,
    longestSleepStart,
    awakeNotDrivingHours: round(awakeNotDrivingSeconds / 3600, 2),
    awakeNotDrivingPct:
      awakeSeconds > 0 ? round((awakeNotDrivingSeconds / awakeSeconds) * 100, 1) : null,
    monthly: clipped.length > 0 ? monthly : [],
    windowStart: new Date(windowStart).toISOString(),
    windowEnd: new Date(windowEnd).toISOString(),
  };
}
