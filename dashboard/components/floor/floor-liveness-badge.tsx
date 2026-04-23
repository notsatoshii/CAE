"use client";

/**
 * FloorLivenessBadge — F3 (Wave 1.5)
 *
 * Renders a small pulsing-dot badge on the Live Floor that communicates
 * "no agent active right now — system online, last heartbeat Ns ago" when
 * the canvas would otherwise look frozen.
 *
 * Why: Floor depends on circuit-breakers.jsonl events. During long stretches
 * of no real GSD activity the canvas stops animating and looks dead. The
 * heartbeat-emitter cron (scripts/heartbeat-emitter.sh @ 30s) injects
 * synthetic heartbeats; this badge surfaces the most recent one as a
 * human-readable status string.
 *
 * Behaviour:
 *   - lastHeartbeatMs === null AND no recent activity → "waiting for first heartbeat…"
 *   - lastHeartbeatMs set, < 90s ago → "system online — last heartbeat 12s ago"
 *   - lastHeartbeatMs > 90s ago → "system unresponsive — last heartbeat 4m ago"
 *     (heartbeats arrive every 30s so > 90s = >= 3 missed pulses)
 *
 * Re-renders every second via setInterval to keep the relative time fresh.
 * No dollar signs in this file (lint-no-dollar.sh guard).
 */

import { useState, useEffect } from "react";

/** Seconds until we declare the system unresponsive (3 missed heartbeats @ 30s). */
const STALE_THRESHOLD_SECONDS = 90;

export interface FloorLivenessBadgeProps {
  /** Epoch ms of the most recent heartbeat, or null when never received. */
  lastHeartbeatMs: number | null;
  /**
   * True when the floor canvas has at least one active visible effect — used
   * to suppress the badge during real activity (no need to show "no agent
   * active right now" when something IS active).
   */
  hasActiveEffects: boolean;
}

function formatAgo(seconds: number): string {
  if (seconds < 60) return seconds + "s ago";
  const m = Math.floor(seconds / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  return h + "h ago";
}

export function FloorLivenessBadge({
  lastHeartbeatMs,
  hasActiveEffects,
}: FloorLivenessBadgeProps) {
  // Tick every second to keep "Ns ago" fresh.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Suppress the badge when actual activity is rendering — the canvas already
  // shows liveness, no need for a redundant status string.
  if (hasActiveEffects) return null;

  let label: string;
  let stale: boolean;
  if (lastHeartbeatMs === null) {
    label = "waiting for first heartbeat";
    stale = true;
  } else {
    const ageSec = Math.max(0, Math.floor((now - lastHeartbeatMs) / 1000));
    stale = ageSec > STALE_THRESHOLD_SECONDS;
    if (stale) {
      label = "system unresponsive — last heartbeat " + formatAgo(ageSec);
    } else {
      label = "no agent active right now — system online, last heartbeat " + formatAgo(ageSec);
    }
  }

  // Dot colour conveys liveness; pulse animation is `animate-pulse` (Tailwind).
  // When stale we drop the pulse and switch to amber so the user can see at a
  // glance that nothing is arriving.
  const dotClass = stale
    ? "size-2 rounded-full bg-amber-400"
    : "size-2 rounded-full bg-emerald-400 animate-pulse";

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="floor-liveness-badge"
      data-stale={stale ? "true" : "false"}
      className="absolute bottom-2 left-2 z-10 flex items-center gap-2 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)]/90 px-2 py-1 text-xs text-[color:var(--text-muted)] backdrop-blur"
    >
      <span className="sr-only" data-truth={stale ? "floor.stale" : "floor.liveness-ok"}>
        yes
      </span>
      <span aria-hidden="true" className={dotClass} />
      <span>{label}</span>
    </div>
  );
}
