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

  // C2-wave/Class 3: richer liveness state machine for Floor:
  //   - authDrifted           → error
  //   - never got heartbeat   → loading
  //   - no effects rendered   → empty (canvas up, quiet system)
  //   - last heartbeat > 60s  → stale
  //   - else                  → healthy
  const STALE_MS = 60_000;
  const now = Date.now();
  const floorLiveness: "loading" | "empty" | "stale" | "healthy" | "error" =
    metrics.authDrifted
      ? "error"
      : metrics.lastHeartbeatMs === null
        ? "loading"
        : metrics.effectsCount === 0 && now - metrics.lastHeartbeatMs > STALE_MS
          ? "stale"
          : metrics.effectsCount === 0
            ? "empty"
            : "healthy";
  // Retained for back-compat with the previous floor.loading marker.
  const floorLoading = floorLiveness === "loading";

  return (
    <div
      className="relative h-full w-full bg-[color:var(--bg)]"
      data-testid="floor-client"
      data-liveness={floorLiveness}
    >
      <span
        className="sr-only"
        data-truth={floorLoading ? "floor.loading" : "floor.healthy"}
      >
        yes
      </span>
      <span className="sr-only" data-truth={"floor-canvas." + floorLiveness}>yes</span>
      {floorLiveness === "empty" && (
        <span className="sr-only" data-truth="floor.empty">yes</span>
      )}
      {floorLiveness === "stale" && (
        <span className="sr-only" data-truth="floor.stale">yes</span>
      )}
      <span className="sr-only" data-truth="floor.effects-count">
        {metrics.effectsCount}
      </span>
      <span className="sr-only" data-truth="floor.queue-size">
        {metrics.queueSize}
      </span>
      <span className="sr-only" data-truth="floor.last-heartbeat-ms">
        {metrics.lastHeartbeatMs ?? 0}
      </span>
      <span className="sr-only" data-truth="floor.paused">
        {paused ? "true" : "false"}
      </span>
      <span className="sr-only" data-truth="floor.minimized">
        {minimized ? "true" : "false"}
      </span>
      <span className="sr-only" data-truth="floor.popout">
        {popout ? "true" : "false"}
      </span>
      <span className="sr-only" data-truth="floor.explain">
        {explain ? "on" : "off"}
      </span>
      <span className="sr-only" data-truth="floor.auth-drifted">
        {metrics.authDrifted ? "true" : "false"}
      </span>
      {metrics.authDrifted && (
        <span className="sr-only" data-truth="floor.error">auth-drift</span>
      )}
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
        // Class 5D: constrain legend to the floor container so it never
        // escapes the parent card. max-w and max-h hard-cap the popover
        // inside the relative wrapper. z-20 raises it above the
        // FloorLivenessBadge (z-10) when they share a corner, and
        // overflow-y-auto keeps long legend lists scrollable instead of
        // bleeding out.
        <aside className="absolute bottom-4 right-4 z-20 w-60 max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] overflow-y-auto rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)]/90 p-3 backdrop-blur">
          <FloorLegend />
        </aside>
      )}
    </div>
  );
}
