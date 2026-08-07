"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Soft crossfade when the displayed string changes (SoC, speed, etc.).
 * Respects prefers-reduced-motion via CSS (no JS skip needed for opacity).
 */
export default function AnimatedNumber({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const [flipping, setFlipping] = useState(false);
  const prev = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === prev.current) return;
    prev.current = value;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setDisplay(value);
      return;
    }

    setFlipping(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDisplay(value);
      setFlipping(false);
    }, 90);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value]);

  return (
    <span className={`anim-num ${flipping ? "is-flipping" : ""} ${className}`.trim()}>
      {display}
    </span>
  );
}
