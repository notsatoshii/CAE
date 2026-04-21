"use client";

import { useCallback } from "react";

const SHAKE_CLASS = "cae-shaking";
const SHAKE_DURATION_MS = 160; // matches 150ms keyframe + small buffer

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useScreenShake(): { shake: () => void } {
  const shake = useCallback(() => {
    if (typeof document === "undefined") return;
    if (prefersReducedMotion()) return;

    const body = document.body;
    // If a previous shake is still running, restart cleanly.
    body.classList.remove(SHAKE_CLASS);
    // Force reflow so the animation re-triggers.
    void body.offsetWidth;
    body.classList.add(SHAKE_CLASS);

    window.setTimeout(() => {
      body.classList.remove(SHAKE_CLASS);
    }, SHAKE_DURATION_MS);
  }, []);

  return { shake };
}
