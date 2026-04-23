"use client";

/**
 * FloorClient — client orchestrator for the Live Floor page (D-18, Plan 11-04).
 *
 * Owns:
 *   - Dynamic import of FloorCanvas with { ssr: false } (D-18)
 *   - paused state + minimized state
 *   - hasOpener state — SSR-safe detection of window.opener (Task 3, Plan 11-05)
 *   - metrics state (effectsCount, queueSize, authDrifted, lastHeartbeatMs)
 *   - FloorToolbar (hidden when popout + minimized)
 *   - FloorLegend as a floating aside when Explain mode is ON (P11-07)
 *   - FloorLivenessBadge — F3 (Wave 1.5), surfaces synthetic heartbeat as
 *     "system online — last heartbeat Ns ago" so the canvas never looks dead
 *   - "Return to main window" button when popout=true AND window.opener != null (Plan 11-05)
 *
 * No dollar signs in this file (lint-no-dollar.sh guard).
 */

import dynamic from "next/dynamic";
import React, { useState, useEffect } from "react";
import { FloorToolbar } from "./floor-toolbar";
import { FloorLegend } from "./floor-legend";
import { FloorLivenessBadge } from "./floor-liveness-badge";
import { useExplainMode } from "@/lib/providers/explain-mode";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";

// ---------------------------------------------------------------------------
// Dynamic import — ssr: false (D-18, canvas APIs unavailable on server)
// ---------------------------------------------------------------------------

const FloorCanvas = dynamic(() => import("./floor-canvas"), { ssr: false });

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FloorClientProps {
  cbPath: string | null;
  projectPath: string | null;
  /** True when rendered in a pop-out window (FloorPopoutHost sets this). */
  popout: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FloorClient({ cbPath, projectPath, popout }: FloorClientProps) {
  const [paused, setPaused] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [metrics, setMetrics] = useState<{
    effectsCount: number;
    queueSize: number;
    authDrifted: boolean;
    lastHeartbeatMs: number | null;
  }>({
    effectsCount: 0,
    queueSize: 0,
    authDrifted: false,
    lastHeartbeatMs: null,
  });

  // SSR-safe opener detection — set in useEffect so server render is unaffected
  const [hasOpener, setHasOpener] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setHasOpener(window.opener != null);
    }
  }, []);

  const { explain, toggle: toggleExplain } = useExplainMode();
  const { dev } = useDevMode();
  const L = labelFor(dev);

  const returnToMain = () => {
    if (typeof window === "undefined") return;
    window.opener?.focus?.();
    window.close();
  };

  // FloorToolbar still expects the original 3-field shape; pass a narrowed view
  // so we don't have to widen its prop in this wave.
  const toolbarMetrics = {
    effectsCount: metrics.effectsCount,
    queueSize: metrics.queueSize,
    authDrifted: metrics.authDrifted,
  };

  return (
    <div className="relative h-full w-full bg-[color:var(--bg)]">
      <FloorCanvas cbPath={cbPath} paused={paused} onMetrics={setMetrics} />

      {!(popout && minimized) && (
        <FloorToolbar
          paused={paused}
          onTogglePause={() => setPaused((p) => !p)}
          popout={popout}
          minimized={minimized}
          onToggleMinimize={() => setMinimized((m) => !m)}
          projectPath={projectPath}
          legendOpen={explain}
          onToggleLegend={toggleExplain}
          metrics={toolbarMetrics}
        />
      )}

      {/* F3 (Wave 1.5): liveness badge — keeps Floor visibly alive when no
          real GSD activity is firing. Hides itself automatically while real
          effects are rendering (no need to say "no agent active" then). */}
      {!(popout && minimized) && (
        <FloorLivenessBadge
          lastHeartbeatMs={metrics.lastHeartbeatMs}
          hasActiveEffects={metrics.effectsCount > 0}
        />
      )}

      {/* Return-to-main-window affordance — only in pop-out mode when opener is present */}
      {popout && hasOpener && !minimized && (
        <button
          type="button"
          className="absolute top-2 left-2 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)]/90 px-2 py-1 text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text)] backdrop-blur"
          onClick={returnToMain}
          aria-label={L.floorReturnToMain}
        >
          {L.floorReturnToMain}
        </button>
      )}

      {explain && (
        <aside className="absolute bottom-4 right-4 w-60 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)]/90 p-3 backdrop-blur">
          <FloorLegend />
        </aside>
      )}
    </div>
  );
}
