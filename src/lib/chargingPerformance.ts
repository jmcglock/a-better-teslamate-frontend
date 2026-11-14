export type ChargeLabSession = {
  id: number;
  location: string;
  peakPowerKw: number | null;
  timeTo80Min: number | null;
  energyAddedKwh: number;
  /** Null when TeslaMate did not record wall energy for the session. */
  energyUsedKwh: number | null;
  durationMin: number | null;
};

export type SocBin = {
  binStart: number;
  avgPowerKw: number | null;
  samples: number;
  sessions: number;
};

export type SiteScore = {
  location: string;
  sessions: number;
  avgPeakPowerKw: number | null;
  avgTimeTo80Min: number | null;
  energyAddedKwh: number;
  energyUsedKwh: number;
  lossPct: number | null;
};

export type ChargeLabInsights = {
  summary: {
    sessions: number;
    sessionsWithCurve: number;
    avgPeakPowerKw: number | null;
    medianTimeTo80Min: number | null;
    lossPct: number | null;
    dcSessions: number;
  };
  socBins: SocBin[];
  sessions: ChargeLabSession[];
  sites: SiteScore[];
};

const round = (v: number, places: number) => Math.round(v * 10 ** places) / 10 ** places;

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((s, v) => s + v, 0) / values.length, 2);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return round(value, 1);
}

function lossPct(added: number, used: number): number | null {
  if (used <= 0) return null;
  return round(((used - added) / used) * 100, 1);
}

// Only sessions with metered wall energy count toward loss; mixing in
// unmetered ones (used unknown) would drag the percentage toward zero.
function meteredLoss(list: ChargeLabSession[]): { used: number; lossPct: number | null } {
  let added = 0;
  let used = 0;
  for (const s of list) {
    if (s.energyUsedKwh === null) continue;
    added += s.energyAddedKwh;
    used += s.energyUsedKwh;
  }
  return { used: round(used, 1), lossPct: lossPct(round(added, 1), round(used, 1)) };
}

export function buildChargingPerformance(
  sessions: ChargeLabSession[],
  socBins: SocBin[],
): ChargeLabInsights {
  const bins = [...socBins].sort((a, b) => a.binStart - b.binStart);
  const times = sessions
    .map((s) => s.timeTo80Min)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const peaks = sessions
    .map((s) => s.peakPowerKw)
    .filter((v): v is number => v !== null && Number.isFinite(v));

  const bySite = new Map<string, ChargeLabSession[]>();
  for (const session of sessions) {
    const list = bySite.get(session.location) ?? [];
    list.push(session);
    bySite.set(session.location, list);
  }
  const sites: SiteScore[] = [...bySite.entries()]
    .map(([location, list]) => {
      const energyAdded = round(list.reduce((s, x) => s + x.energyAddedKwh, 0), 1);
      const metered = meteredLoss(list);
      return {
        location,
        sessions: list.length,
        avgPeakPowerKw: avg(list.map((x) => x.peakPowerKw).filter((v): v is number => v !== null)),
        avgTimeTo80Min: avg(list.map((x) => x.timeTo80Min).filter((v): v is number => v !== null)),
        energyAddedKwh: energyAdded,
        energyUsedKwh: metered.used,
        lossPct: metered.lossPct,
      };
    })
    .sort((a, b) => b.sessions - a.sessions || b.energyAddedKwh - a.energyAddedKwh);


  return {
    summary: {
      sessions: sessions.length,
      sessionsWithCurve: sessions.filter((s) => s.peakPowerKw !== null).length,
      avgPeakPowerKw: avg(peaks),
      medianTimeTo80Min: median(times),
      lossPct: meteredLoss(sessions).lossPct,
      dcSessions: sessions.filter((s) => s.peakPowerKw !== null && s.peakPowerKw >= 20).length,
    },
    socBins: bins,
    sessions: [...sessions].sort((a, b) => b.energyAddedKwh - a.energyAddedKwh),
    sites,
  };
}