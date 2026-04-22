"use client";

/**
 * FloorCanvas — React client component that owns:
 * - A <canvas> element rendered at full container size
 * - A mutable Scene stored in useRef (D-05: never in React state)
 * - A single requestAnimationFrame loop: drain events → step(scene, dt) → render(ctx, scene, vp)
 * - An SSE subscription to /api/tail on the selected project's circuit-breakers.jsonl (D-04)
 * - Queue caps: QUEUE_CAP=500 (drop-oldest) and EFFECTS_CAP=10 (drop-oldest) (D-14)
 * - SSE line size cap: reject frames > MAX_LINE_BYTES=4096 (D-15)
 * - Paused gate: when props.paused, RAF loop skips drain + step + render (D-05)
 * - Reduced-motion gate: passes reducedMotion flag to mapEvent; effects suppressed (D-13)
 * - ResizeObserver: recomputes viewport on canvas resize
 */

import React, { useEffect, useRef, useState } from "react";
import { createScene, type Scene } from "@/lib/floor/scene";
import { step } from "@/lib/floor/state";
import { parseEvent, mapEvent } from "@/lib/floor/event-adapter";
import { render, type Viewport } from "@/lib/floor/renderer";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { useDevMode } from "@/lib/providers/dev-mode";
import type { CbEvent } from "@/lib/cae-types";

// ---------------------------------------------------------------------------
// Constants (exported for test seams)
// ---------------------------------------------------------------------------

export const QUEUE_CAP = 500;
export const EFFECTS_CAP = 10;
export const MAX_LINE_BYTES = 4096;

/**
 * Named export for testing — gives test access to cap constants without
 * importing internal implementation.
 */
export const __test = {
  QUEUE_CAP,
  EFFECTS_CAP,
  MAX_LINE_BYTES,
} as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FloorCanvasProps {
  /** Absolute path to a circuit-breakers.jsonl under an ALLOWED_ROOT. */
  cbPath: string;
  /**
   * When true: pause RAF loop — drainEvents, step(), and render() are skipped.
   * Scene freezes on the last rendered frame.
   */
  paused?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FloorCanvas({ cbPath, paused = false }: FloorCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene>(createScene());
  const queueRef = useRef<CbEvent[]>([]);
  const rafRef = useRef<number | null>(null);

  const reducedMotion = usePrefersReducedMotion();
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

  // ---------------------------------------------------------------------------
  // Effect 1: RAF loop — drain events → step → render
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

        // Drain queue: apply MappedEffects to scene
        const pending = queueRef.current.splice(0);
        for (const cbEvent of pending) {
          const effects = mapEvent(cbEvent, { reducedMotion });
          for (const mapped of effects) {
            if (mapped.kind === "status") {
              sceneRef.current.stations[mapped.station].status = mapped.status;
            } else if (mapped.kind === "effect") {
              sceneRef.current.effects.push(mapped.effect);
              // Drop oldest when effects exceed cap
              while (sceneRef.current.effects.length > EFFECTS_CAP) {
                sceneRef.current.effects.shift();
              }
            }
          }
        }

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
    // Re-run when reducedMotion or paused flips, or viewport changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, paused, viewport]);

  // ---------------------------------------------------------------------------
  // Effect 2: SSE subscription
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const es = new EventSource("/api/tail?path=" + encodeURIComponent(cbPath));

    es.onmessage = (e: MessageEvent) => {
      // D-15: reject frames > MAX_LINE_BYTES
      if (typeof e.data === "string" && e.data.length > MAX_LINE_BYTES) return;

      const parsed = parseEvent(e.data as string);
      if (!parsed) return;

      queueRef.current.push(parsed);
      // D-14: drop oldest when queue exceeds cap
      while (queueRef.current.length > QUEUE_CAP) {
        queueRef.current.shift();
      }
    };

    return () => {
      es.close();
    };
  }, [cbPath]);

  // ---------------------------------------------------------------------------
  // Effect 3: ResizeObserver — recompute viewport on canvas resize
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
