"use client";

import { useEffect, useState } from "react";

export type ChartColors = { blue: string; green: string; orange: string; violet: string; ink2: string; line: string };

/** SVG presentation attributes honor these, so charts follow the theme without a hydration swap. */
export const chartColor: ChartColors = {
  blue: "var(--chart-blue)",
  green: "var(--chart-green)",
  orange: "var(--chart-orange)",
  violet: "var(--chart-violet)",
  ink2: "var(--ink-2)",
  line: "var(--line)",
};

const DARK: ChartColors = {
  blue: "#3b9eff", green: "#12c96a", orange: "#f5a524", violet: "#a78bfa",
  ink2: "#8b8b93", line: "#2a2a2e",
};

function read(): ChartColors {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    blue: v("--chart-blue", DARK.blue),
    green: v("--chart-green", DARK.green),
    orange: v("--chart-orange", DARK.orange),
    violet: v("--chart-violet", DARK.violet),
    ink2: v("--ink-2", DARK.ink2),
    line: v("--line", DARK.line),
  };
}

function same(a: ChartColors, b: ChartColors): boolean {
  return a.blue === b.blue && a.green === b.green && a.orange === b.orange
    && a.violet === b.violet && a.ink2 === b.ink2 && a.line === b.line;
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(DARK);
  useEffect(() => {
    const apply = () => {
      const next = read();
      setColors((prev) => (same(prev, next) ? prev : next));
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return colors;
}
