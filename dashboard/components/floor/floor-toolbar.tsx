"use client";

/**
 * FloorToolbar — 5-control overlay for the Live Floor page (P11-04, D-06, D-20).
 *
 * Controls:
 *   1. Pause toggle (Pause/Play icon)
 *   2. Minimize toggle — visible ONLY when popout=true
 *   3. Pop-out button — visible ONLY when popout=false; calls window.open (D-06)
 *   4. Legend toggle — aria-pressed reflects legendOpen; fires onToggleLegend
 *   5. Re-auth banner — shown when metrics.authDrifted=true (T-11-05)
 *
 * Dev-mode counter strip shows queueSize + effectsCount when dev=true (D-20).
 * All user-visible strings route through labelFor(dev) (D-20).
 *
 * No dollar signs in this file (lint-no-dollar.sh guard).
 */

import { Pause, Play, Minimize2, ExternalLink, HelpCircle } from "lucide-react";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FloorToolbarProps {
  paused: boolean;
  onTogglePause: () => void;
  /** When true, popout is active — show Minimize, hide Pop-out. */
  popout: boolean;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  /** Absolute project path for pop-out URL building. */
  projectPath: string | null;
  /** Reflects current explain state into the legend toggle button's pressed state. */
  legendOpen: boolean;
  onToggleLegend: () => void;
  /** Live metrics from useFloorEvents (via FloorClient). */
  metrics: { effectsCount: number; queueSize: number; authDrifted: boolean };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FloorToolbar({
  paused,
  onTogglePause,
  popout,
  minimized = false,
  onToggleMinimize,
  projectPath,
  legendOpen,
  onToggleLegend,
  metrics,
}: FloorToolbarProps) {
  const { dev } = useDevMode();
  const L = labelFor(dev);

  function handlePopOut() {
    if (!projectPath) return;
    // Trade-off: intentionally omitting "noopener,noreferrer" so that the pop-out window
    // retains window.opener. This is required for two features:
    //   1. floor-client.tsx returnToMain() — focuses the opener tab and closes the pop-out.
    //   2. floor-popout-host.tsx Escape handler — calls window.close() which only works
    //      when the window was opened via window.open (not affected by opener).
    // Risk is low: /floor/popout is same-origin, session-authenticated, and must never
    // navigate cross-origin or load third-party scripts. If that constraint changes,
    // replace opener reliance with BroadcastChannel (see WR-02 in 11-REVIEW.md).
    window.open(
      "/floor/popout?project=" + encodeURIComponent(projectPath),
      "cae-live-floor",
      "width=960,height=720"
    );
  }

  const btnClass =
    "inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--text-muted)] " +
    "transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] " +
    "focus-visible:outline-2 focus-visible:outline-[color:var(--accent)] " +
    "disabled:pointer-events-none disabled:opacity-40";

  return (
    <div
      role="toolbar"
      className="absolute top-2 right-2 flex items-center gap-1 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)]/90 p-1 backdrop-blur"
    >
      {/* 1. Pause toggle */}
      <button
        aria-label={paused ? (dev ? "Resume" : "Resume animations") : L.floorPause}
        title={paused ? (dev ? "Resume" : "Resume animations") : L.floorPause}
        onClick={onTogglePause}
        className={btnClass}
      >
        {paused ? (
          <Play className="size-3.5" aria-hidden="true" />
        ) : (
          <Pause className="size-3.5" aria-hidden="true" />
        )}
      </button>

      {/* 2. Minimize — only when popout */}
      {popout && (
        <button
          aria-label={L.floorMinimize}
          title={L.floorMinimize}
          onClick={onToggleMinimize}
          className={btnClass}
          data-minimized={minimized ? "true" : "false"}
        >
          <Minimize2 className="size-3.5" aria-hidden="true" />
        </button>
      )}

      {/* 3. Pop-out — only when NOT popout */}
      {!popout && (
        <button
          aria-label={L.floorPopOut}
          title={L.floorPopOut}
          onClick={handlePopOut}
          disabled={!projectPath}
          className={btnClass}
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </button>
      )}

      {/* 4. Legend toggle */}
      <button
        aria-label={L.floorLegend}
        title={L.floorLegend}
        onClick={onToggleLegend}
        aria-pressed={legendOpen}
        className={
          btnClass +
          (legendOpen
            ? " bg-[color:var(--surface-hover)] text-[color:var(--accent)]"
            : "")
        }
      >
        <HelpCircle className="size-3.5" aria-hidden="true" />
      </button>

      {/* Dev-mode counter strip */}
      {dev && (
        <span
          data-testid="floor-debug-strip"
          className="ml-1 font-mono text-xs text-[color:var(--text-dim)]"
        >
          q:{metrics.queueSize} fx:{metrics.effectsCount}
        </span>
      )}

      {/* 5. Re-auth banner */}
      {metrics.authDrifted && (
        <div
          role="alert"
          className="absolute top-10 right-0 z-10 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2 text-xs text-[color:var(--text)]"
        >
          {L.floorAuthDriftNotice}
        </div>
      )}
    </div>
  );
}
