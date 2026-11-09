"use client";

/**
 * Live figures (speed, power, SoC) used to crossfade by hiding the old value
 * for 90ms. Updates arrive faster than that, so the number stayed blank or
 * stale. Show the current value immediately; tabular nums keep the width still.
 */
export default function AnimatedNumber({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  return <span className={`anim-num ${className}`.trim()}>{value}</span>;
}
