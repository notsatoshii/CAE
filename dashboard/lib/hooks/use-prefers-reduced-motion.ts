"use client";

/**
 * matchMedia-backed reduced-motion boolean hook (D-13).
 *
 * Mirrors the `use-screen-shake.ts` matchMedia idiom exactly.
 * SSR-safe: returns false when window is undefined.
 * Subscribes to prefers-reduced-motion changes and re-renders on change.
 *
 * Usage:
 *   const reduced = usePrefersReducedMotion();
 *   if (!reduced) { spawn fireworks... }
 */

import { useState, useEffect } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Pure helper — reads current matchMedia state.
 * SSR-safe: returns false on server (window undefined).
 * Exported for unit testability.
 */
export function prefersReducedMotionInitial(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * React hook — subscribes to prefers-reduced-motion changes.
 * Returns true while the user has reduced motion enabled.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState<boolean>(
    prefersReducedMotionInitial,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(QUERY);

    const handleChange = (e: { matches: boolean }) => {
      setPrefersReduced(e.matches);
    };

    mql.addEventListener("change", handleChange);
    // Sync in case it changed between initial render and effect
    setPrefersReduced(mql.matches);

    return () => {
      mql.removeEventListener("change", handleChange);
    };
  }, []);

  return prefersReduced;
}
