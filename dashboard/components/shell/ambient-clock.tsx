"use client";

/**
 * AmbientClock — isolated local-time display for top-nav (Plan 13-07, Task 1).
 *
 * Renders current local time as HH:mm:ss, updating every 1 second.
 * Isolated component so that its 1s setInterval never causes the parent
 * nav to re-render (state is entirely local to this component).
 *
 * Reduced-motion accessibility:
 * - When `prefers-reduced-motion: reduce` is set, shows HH:mm only (no seconds)
 *   and ticks at 60s cadence instead of 1s — eliminates the per-second DOM
 *   mutation that can trigger layout recalculation even on hidden elements.
 *
 * MC IA adoption: V2 §5 row 1 — mirrors Mission Control "Live 09:23" ambient
 * clock pattern, adapted for CAE branding.
 */

import { useEffect, useState } from "react";

function getReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function fmt(d: Date, reduceMotion: boolean): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (reduceMotion) return `${hh}:${mm}`;
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function AmbientClock() {
  const reduceMotion = getReducedMotion();
  const intervalMs = reduceMotion ? 60_000 : 1_000;

  const [time, setTime] = useState<string>(() => fmt(new Date(), reduceMotion));

  useEffect(() => {
    // Tick
    const id = setInterval(() => {
      setTime(fmt(new Date(), reduceMotion));
    }, intervalMs);
    return () => clearInterval(id);
    // reduceMotion is read once on mount — it's a constant for the lifetime
    // of the component (matchMedia changes trigger a remount at the page level)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // aria-label uses HH:mm (human-readable minutes granularity is enough)
  const ariaTime = time.slice(0, 5); // "HH:mm" from "HH:mm:ss" or "HH:mm"

  return (
    <span
      className="font-mono text-[10px] text-[color:var(--text-muted)] tabular-nums select-none"
      aria-label={`Local time ${ariaTime}`}
      data-testid="ambient-clock"
    >
      {time}
    </span>
  );
}
