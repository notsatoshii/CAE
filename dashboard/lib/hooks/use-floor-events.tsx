"use client";

/**
 * useFloorEvents — Core SSE wiring for the Live Floor.
 *
 * Wraps /api/tail SSE + parseEvent + mapEvent + queue/effects caps +
 * reduced-motion gate + 30s /api/state auth-drift probe.
 *
 * Returns observable counters for the toolbar. The hook does NOT own the RAF
 * loop — that is the canvas component's job — but it DOES own the queue drain
 * into sceneRef.current.effects (so it can enforce EFFECTS_CAP consistently
 * regardless of RAF cadence).
 *
 * Design decisions (see CONTEXT.md open_questions):
 * Q1: drain via queueMicrotask on receipt — decouples from RAF cadence so caps
 *     hold even when canvas is briefly unmounted (e.g. pop-out detach).
 * Q2: auth-drift probes /api/state (pre-existing, auth-gated identically to /api/tail).
 * Q3: canvas owns sceneRef; hook mutates sceneRef.current; RAF reads each tick.
 */

import { useState, useEffect, useRef, useCallback, type MutableRefObject } from "react";
import type { Scene } from "@/lib/floor/scene";
import type { CbEvent } from "@/lib/cae-types";
import { parseEvent, mapEvent } from "@/lib/floor/event-adapter";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const QUEUE_CAP = 500;
export const EFFECTS_CAP = 10;
export const MAX_LINE_BYTES = 4096;
export const AUTH_POLL_MS = 30_000;

/** Test seam — allows tests to assert exact constant values. */
export const __test = {
  QUEUE_CAP,
  EFFECTS_CAP,
  MAX_LINE_BYTES,
  AUTH_POLL_MS,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseFloorEventsOpts {
  /** Absolute path to circuit-breakers.jsonl. null/undefined = no SSE opened (idle). */
  cbPath: string | null;
  /** When true, incoming events are queued but not applied to scene. */
  paused: boolean;
  /** Hook mutates sceneRef.current directly (effects push, status updates). */
  sceneRef: MutableRefObject<Scene>;
}

export interface UseFloorEventsResult {
  /** Count of active effects in scene (updated each React frame via state mirror). */
  effectsCount: number;
  /** Count of pending events in queue (not yet applied). */
  queueSize: number;
  /** Epoch ms of the most recently-applied event, or null if none yet. */
  lastEventTs: number | null;
  /** True when /api/state returned 401 on the drift probe; toolbar shows re-auth banner. */
  authDrifted: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFloorEvents(opts: UseFloorEventsOpts): UseFloorEventsResult {
  const reducedMotion = usePrefersReducedMotion();

  // Capture latest values in refs to avoid stale closures in SSE effect
  const reducedMotionRef = useRef(reducedMotion);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  const pausedRef = useRef(opts.paused);
  useEffect(() => {
    pausedRef.current = opts.paused;
  }, [opts.paused]);

  const sceneRefRef = useRef(opts.sceneRef);
  useEffect(() => {
    sceneRefRef.current = opts.sceneRef;
  });

  // Queue of parsed events not yet applied to scene
  const queueRef = useRef<CbEvent[]>([]);

  // Observable state counters
  const [effectsCount, setEffectsCount] = useState(0);
  const [queueSize, setQueueSize] = useState(0);
  const [lastEventTs, setLastEventTs] = useState<number | null>(null);
  const [authDrifted, setAuthDrifted] = useState(false);

  // Drain queue into scene (apply MappedEffects, enforce caps)
  const drain = useCallback(() => {
    const scene = sceneRefRef.current.current;
    while (queueRef.current.length > 0 && !pausedRef.current) {
      const e = queueRef.current.shift()!;
      const mapped = mapEvent(e, { reducedMotion: reducedMotionRef.current });
      for (const m of mapped) {
        if (m.kind === "status") {
          scene.stations[m.station].status = m.status;
        } else {
          scene.effects.push(m.effect);
          // Drop oldest when effects exceed cap (D-14)
          while (scene.effects.length > EFFECTS_CAP) {
            scene.effects.shift();
          }
        }
      }
      setLastEventTs(Date.now());
    }
    setEffectsCount(sceneRefRef.current.current.effects.length);
    setQueueSize(queueRef.current.length);
  }, []);

  // Drain on unpause (flush accumulated queue)
  useEffect(() => {
    if (!opts.paused) {
      drain();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.paused, drain]);

  // SSE subscription (re-runs when cbPath changes)
  useEffect(() => {
    if (!opts.cbPath) return;

    const es = new EventSource("/api/tail?path=" + encodeURIComponent(opts.cbPath));

    es.onmessage = (e: MessageEvent) => {
      // D-15: reject frames > MAX_LINE_BYTES
      if (typeof e.data !== "string" || e.data.length > MAX_LINE_BYTES) return;

      // D-16: parse + allowlist check (parseEvent handles both)
      const parsed = parseEvent(e.data);
      if (!parsed) return;

      // Push to queue, enforce QUEUE_CAP (drop-oldest)
      queueRef.current.push(parsed);
      while (queueRef.current.length > QUEUE_CAP) {
        queueRef.current.shift();
      }

      // Update queueSize synchronously via microtask
      queueMicrotask(drain);
    };

    return () => {
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.cbPath, drain]);

  // Auth-drift probe: poll /api/state every 30s while SSE is open (T-11-05)
  useEffect(() => {
    if (!opts.cbPath) return;

    let cancelled = false;
    const cbPath = opts.cbPath;

    const probe = async () => {
      try {
        // Strip the /.cae/metrics/circuit-breakers.jsonl suffix to get the project path
        const projectPath = cbPath.replace("/.cae/metrics/circuit-breakers.jsonl", "");
        const res = await fetch("/api/state?project=" + encodeURIComponent(projectPath));
        if (cancelled) return;
        if (res.status === 401) {
          setAuthDrifted(true);
        } else if (res.ok) {
          setAuthDrifted(false);
        }
      } catch {
        // Network blip — ignore; do not set authDrifted on transient errors
      }
    };

    void probe(); // CR-02: fire immediately on mount so expired sessions surface at once
    const id = setInterval(probe, AUTH_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.cbPath]);

  return { effectsCount, queueSize, lastEventTs, authDrifted };
}
