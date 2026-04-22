"use client";

/**
 * FloorPopoutHost — client wrapper for the /floor/popout route (Plan 11-05, Task 2).
 *
 * Responsibilities:
 *   (a) Sets document.title = floorPageTitle + " — pop out" on mount; restores on unmount
 *   (b) Best-effort window.resizeTo(960, 720) when window.opener is set (some browsers ignore)
 *   (c) Binds Escape keydown to window.close() ONLY when window.opener is set —
 *       prevents accidentally closing a bookmarked tab opened directly
 *   (d) Aria-hides the TopNav on mount (accessibility followup to Task 1 CSS hide)
 *
 * Zero dollar signs in this file (lint-no-dollar.sh guard).
 */

import { useEffect } from "react";
import FloorClient from "./floor-client";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";

export interface FloorPopoutHostProps {
  cbPath: string | null;
  projectPath: string | null;
}

export function FloorPopoutHost({ cbPath, projectPath }: FloorPopoutHostProps) {
  const { dev } = useDevMode();
  const L = labelFor(dev);

  // Title + resize + aria-hide effect
  useEffect(() => {
    const prevTitle = document.title;
    document.title = L.floorPageTitle + " — pop out";

    if (typeof window !== "undefined" && window.opener != null) {
      // Best-effort size nudge — browsers may silently ignore
      try {
        window.resizeTo(960, 720);
      } catch {
        // ignore — some browsers block resizeTo
      }
      // Accessibility: aria-hide the TopNav that CSS display:none already hides visually
      const topNav = document.querySelector('[data-testid="top-nav"]');
      if (topNav) {
        topNav.setAttribute("aria-hidden", "true");
      }
    }

    return () => {
      document.title = prevTitle;
    };
  }, [L.floorPageTitle]);

  // Escape-to-close effect — only active when this is a true pop-out (opener set)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.opener == null) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.opener?.focus?.();
        window.close();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return <FloorClient cbPath={cbPath} projectPath={projectPath} popout={true} />;
}

export default FloorPopoutHost;
