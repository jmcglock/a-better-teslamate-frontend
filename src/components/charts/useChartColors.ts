"use client";

import { useEffect, useState } from "react";

export type ChartColors = { blue: string; green: string; orange: string; violet: string; ink2: string; line: string };

const DARK: ChartColors = {
  blue: "#2e7fe0", green: "#1ea65f", orange: "#cc7612", violet: "#8b6fe8",
  ink2: "#9aa0ac", line: "#2a2e37",
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

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(DARK);
  useEffect(() => {
    setColors(read());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setColors(read());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return colors;
}
