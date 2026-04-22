"use client";

/**
 * FloorClient — client orchestrator for the Live Floor page (D-18, Plan 11-04).
 *
 * Owns:
 *   - Dynamic import of FloorCanvas with { ssr: false } (D-18)
 *   - paused state + minimized state
 *   - metrics state (effectsCount, queueSize, authDrifted) from FloorCanvas onMetrics
 *   - FloorToolbar (hidden when popout + minimized)
 *   - FloorLegend as a floating aside when Explain mode is ON (P11-07)
 *
 * No dollar signs in this file (lint-no-dollar.sh guard).
 */

import dynamic from "next/dynamic";
import React, { useState } from "react";
import { FloorToolbar } from "./floor-toolbar";
import { FloorLegend } from "./floor-legend";
import { useExplainMode } from "@/lib/providers/explain-mode";

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
  /** True when rendered in a pop-out window (page resolved ?popout=1). */
  popout: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FloorClient({ cbPath, projectPath, popout }: FloorClientProps) {
  const [paused, setPaused] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [metrics, setMetrics] = useState({
    effectsCount: 0,
    queueSize: 0,
    authDrifted: false,
  });

  const { explain, toggle: toggleExplain } = useExplainMode();

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
          metrics={metrics}
        />
      )}

      {explain && (
        <aside className="absolute bottom-4 right-4 w-60 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)]/90 p-3 backdrop-blur">
          <FloorLegend />
        </aside>
      )}
    </div>
  );
}
