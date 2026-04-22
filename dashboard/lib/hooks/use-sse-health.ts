"use client";
import { useEffect, useState } from "react";

/**
 * useSseHealth — tracks the liveness of an EventSource (SSE) connection.
 *
 * Returns:
 *   - lastMessageAt: Unix-ms of the last received message frame, or null.
 *   - status: "connecting" | "open" | "closed"
 *
 * Consumers mount a <LastUpdated at={lastMessageAt} threshold_ms={N}/> chip
 * in their header to give the user a visible staleness signal.
 *
 * The EventSource is opened on mount and closed on unmount (or when `path`
 * changes). Status reflects the EventSource lifecycle events.
 *
 * Phase 13 Plan 06 — V2 §2 recipe (verbatim).
 */

type SseHealthState = {
  lastMessageAt: number | null;
  status: "connecting" | "open" | "closed";
};

export function useSseHealth(path: string): SseHealthState {
  const [state, setState] = useState<SseHealthState>({
    lastMessageAt: null,
    status: "connecting",
  });

  useEffect(() => {
    const es = new EventSource(path);

    es.onopen = () => setState((s) => ({ ...s, status: "open" }));

    es.onmessage = () =>
      setState((s) => ({ ...s, lastMessageAt: Date.now() }));

    es.onerror = () => setState((s) => ({ ...s, status: "closed" }));

    return () => es.close();
  }, [path]);

  return state;
}
