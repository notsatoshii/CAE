"use client";

/**
 * LivenessChip — top-nav freshness aggregator.
 *
 * Combines useStatePoll lastUpdated (state-poll 3s cadence) and useSseHealth
 * for a representative SSE stream to produce a single user-visible label:
 *
 *   "Live"    — all sources fresh (green dot)
 *   "Stale"   — at least one source is stale but none dead (amber dot)
 *   "Offline" — at least one source is dead / never received data (red dot)
 *
 * Replaces the old HeartbeatDot "live" lie — HeartbeatDot still renders
 * system-halted state (separate semantic); this chip reflects data freshness.
 *
 * Phase 13 Plan 06 — V2 §2 recipe.
 */

import { useStatePoll } from "@/lib/hooks/use-state-poll";
import { useSseHealth } from "@/lib/hooks/use-sse-health";

type FreshnessState = "fresh" | "stale" | "dead";

function classify(at: number | null, threshold: number): FreshnessState {
  if (!at) return "dead";
  const delta = Date.now() - at;
  if (delta <= threshold) return "fresh";
  if (delta <= threshold * 3) return "stale";
  return "dead";
}

function worst(a: FreshnessState, b: FreshnessState): FreshnessState {
  if (a === "dead" || b === "dead") return "dead";
  if (a === "stale" || b === "stale") return "stale";
  return "fresh";
}

export function LivenessChip() {
  const { lastUpdated } = useStatePoll();
  const tail = useSseHealth("/api/tail");

  // State-poll: 3s interval → threshold 6000ms (2 missed polls = stale)
  const stateFreshness = classify(lastUpdated, 6_000);
  // SSE tail: server-push → threshold 30000ms (no heartbeat for 30s = stale)
  const sseFreshness = classify(tail.lastMessageAt, 30_000);

  const worstState = worst(stateFreshness, sseFreshness);

  const color =
    worstState === "fresh"
      ? "var(--success)"
      : worstState === "stale"
        ? "var(--warning)"
        : "var(--danger)";

  const label =
    worstState === "fresh" ? "Live" : worstState === "stale" ? "Stale" : "Offline";

  // Show time since last state-poll update as a latency hint
  const rtt =
    lastUpdated && lastUpdated > 0
      ? `${Math.max(0, Math.floor((Date.now() - lastUpdated) / 1000))}s`
      : "—";

  const tooltipText = [
    `state-poll: ${stateFreshness} (${lastUpdated ? Math.floor((Date.now() - lastUpdated) / 1000) + "s ago" : "never"})`,
    `sse-tail: ${tail.status}${tail.lastMessageAt ? " (" + Math.floor((Date.now() - tail.lastMessageAt) / 1000) + "s ago)" : " (no data)"}`,
  ].join(" · ");

  return (
    <button
      type="button"
      data-testid="liveness-chip"
      className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] font-mono hover:opacity-80 transition-opacity"
      aria-label={`App liveness: ${label}`}
      title={tooltipText}
    >
      <span
        className="inline-block size-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="text-[color:var(--text-muted)]">{label}</span>
      <span className="text-[color:var(--text-dim)]">· {rtt}</span>
    </button>
  );
}
