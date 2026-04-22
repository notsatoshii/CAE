"use client";
import { useEffect, useState } from "react";

/**
 * LastUpdated — tiny freshness chip rendered next to any "live" panel.
 *
 * Renders a colored dot + relative-time text that ticks every second.
 * Color encoding:
 *   - green (--success)  : delta ≤ threshold_ms           → "fresh"
 *   - amber (--warning)  : delta ≤ 3 × threshold_ms       → "stale"
 *   - red   (--danger)   : delta > 3 × threshold_ms       → "dead"
 *
 * When `at` is null (e.g. no poll has completed yet), renders "—".
 *
 * @param at          Unix-ms timestamp of last successful update, or null.
 * @param threshold_ms Freshness threshold in milliseconds (e.g. 6000 for 3s polls).
 * @param className   Optional extra classes forwarded to the root <span>.
 *
 * Phase 13 Plan 06 — V2 §2 recipe (verbatim).
 */
export function LastUpdated({
  at,
  threshold_ms,
  className = "",
}: {
  at: number | null;
  threshold_ms: number;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!at) {
    return (
      <span className={`text-xs text-[color:var(--text-dim)] ${className}`}>—</span>
    );
  }

  const delta = now - at;
  const rel =
    delta < 5_000
      ? "just now"
      : delta < 60_000
        ? `${Math.floor(delta / 1000)}s ago`
        : delta < 3_600_000
          ? `${Math.floor(delta / 60_000)}m ago`
          : `${Math.floor(delta / 3_600_000)}h ago`;

  const state =
    delta <= threshold_ms ? "fresh" : delta <= threshold_ms * 3 ? "stale" : "dead";
  const color =
    state === "fresh"
      ? "var(--success)"
      : state === "stale"
        ? "var(--warning)"
        : "var(--danger)";

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[10px] ${className}`}
      title={new Date(at).toLocaleString()}
    >
      <span
        className="inline-block size-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="text-[color:var(--text-muted)]">{rel}</span>
    </span>
  );
}
