"use client";

/**
 * FloorCanvas — React client component (thinned after Plan 11-03 refactor).
 *
 * Owns:
 * - <canvas> element at full container size
 * - sceneRef (useRef<Scene>) — mutable, never React state (D-05)
 * - RAF loop: step(scene, dt) + render(ctx, scene, vp) each tick
 * - ResizeObserver: recomputes viewport on canvas resize
 *
 * Delegates to useFloorEvents:
 * - SSE subscription to /api/tail (D-04)
 * - Queue caps: QUEUE_CAP=500, EFFECTS_CAP=10 (D-14)
 * - SSE line size cap: MAX_LINE_BYTES=4096 (D-15)
 * - Event parse + map + scene mutation
 * - Paused queue (deferred drain)
 * - Reduced-motion gate (D-13)
 * - 30s /api/state auth-drift probe (T-11-05)
 *
 * cbPath widened from string to string | null — null = idle scene, no SSE.
 */

import React, { useEffect, useRef, useState } from "react";
import { createScene, type Scene } from "@/lib/floor/scene";
import { step } from "@/lib/floor/state";
import { render, type Viewport } from "@/lib/floor/renderer";
import { useDevMode } from "@/lib/providers/dev-mode";
import { useFloorEvents, __test as hookTest } from "@/lib/hooks/use-floor-events";

// ---------------------------------------------------------------------------
// Re-export cap constants for backward compatibility with Plan 02 tests
// ---------------------------------------------------------------------------

export const QUEUE_CAP = hookTest.QUEUE_CAP;
export const EFFECTS_CAP = hookTest.EFFECTS_CAP;
export const MAX_LINE_BYTES = hookTest.MAX_LINE_BYTES;

export const __test = {
  QUEUE_CAP,
  EFFECTS_CAP,
  MAX_LINE_BYTES,
} as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FloorCanvasProps {
  /**
   * Absolute path to circuit-breakers.jsonl under an ALLOWED_ROOT.
   * null = idle scene — no SSE opened (e.g. no project selected).
   */
  cbPath: string | null;
  /**
   * When true: pause RAF loop — step() and render() are skipped.
   * Events are still queued by useFloorEvents and drained on unpause.
   */
  paused?: boolean;
  /**
   * Optional — parent (Plan 04) can opt-in to read live counters.
   * Called each React render with the latest hook values.
   */
  onMetrics?: (m: { effectsCount: number; queueSize: number; authDrifted: boolean }) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FloorCanvas({ cbPath, paused = false, onMetrics }: FloorCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene>(createScene());
  const rafRef = useRef<number | null>(null);

  const { dev } = useDevMode();

  // Viewport lives in state — only updated on resize (O(once per event), not per-frame)
  const [viewport, setViewport] = useState<Viewport>({
    width: 960,
    height: 720,
    cx: 480,
    cy: 280,
    devLabels: false,
  });

  // Sync devLabels to the current dev flag
  useEffect(() => {
    setViewport((prev) => ({ ...prev, devLabels: dev }));
  }, [dev]);

  // Delegate SSE + event handling to the hook
  const { effectsCount, queueSize, authDrifted } = useFloorEvents({
    cbPath,
    paused,
    sceneRef,
  });

  // Forward observable counters to parent (for toolbar / debug UI)
  useEffect(() => {
    onMetrics?.({ effectsCount, queueSize, authDrifted });
  }, [effectsCount, queueSize, authDrifted, onMetrics]);

  // ---------------------------------------------------------------------------
  // RAF loop — step → render (canvas owns this; hook owns event application)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return;
    const safeCtx: CanvasRenderingContext2D = ctx;

    let lastTs = performance.now();
    let animId: number;

    function tick(ts: number) {
      if (!paused) {
        const dt = Math.min((ts - lastTs) / 1000, 0.1);
        lastTs = ts;

        step(sceneRef.current, dt);
        render(safeCtx, sceneRef.current, viewport);
      }

      animId = requestAnimationFrame(tick);
      rafRef.current = animId;
    }

    animId = requestAnimationFrame(tick);
    rafRef.current = animId;

    return () => {
      cancelAnimationFrame(animId);
      rafRef.current = null;
    };
    // Re-run when paused or viewport changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, viewport]);

  // ---------------------------------------------------------------------------
  // ResizeObserver — recompute viewport on canvas resize
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setViewport((prev) => ({
          ...prev,
          width,
          height,
          cx: width / 2,
          cy: height / 2 - 80,
        }));
      }
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="floor-canvas"
      className="block h-full w-full"
    />
  );
}
