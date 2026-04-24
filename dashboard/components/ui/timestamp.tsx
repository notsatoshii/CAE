"use client";

import React from "react";

/**
 * Timestamp — shared, non-fuzzy timestamp primitive.
 *
 * Eric's rule (session 13 UI directives): timestamps must NEVER be fuzzy and
 * must ALWAYS surface the absolute ISO string on hover. Rendering "today" or
 * "yesterday" is banned. We render a precise relative string like "3h ago"
 * and put the full ISO in the `title` attribute so hover reveals the truth.
 *
 * Usage:
 *   <Timestamp iso="2026-04-17T02:40:37+09:00" />  → "7d ago" (hover: ISO)
 *   <Timestamp iso={null} />                       → "—"
 *   <Timestamp iso={iso} prefix="updated " />      → "updated 7d ago"
 *
 * Why a static server render?
 *   - This primitive renders statically on the server; no ticking state.
 *   - For "live" freshness with a colored dot + tick-every-second, see
 *     components/ui/last-updated.tsx (different use case).
 *
 * @param iso      ISO 8601 string from the server, or null when unknown.
 * @param now      Optional "now" override for deterministic testing.
 * @param prefix   Optional prefix string rendered before the relative text.
 * @param className Forwarded to the root <time>.
 */
export function Timestamp({
  iso,
  now,
  prefix = "",
  className = "",
}: {
  iso: string | null | undefined;
  now?: number;
  prefix?: string;
  className?: string;
}) {
  if (!iso) {
    return (
      <span
        className={`text-xs text-[color:var(--text-dim,#71717a)] ${className}`}
        data-testid="timestamp-empty"
      >
        —
      </span>
    );
  }

  const parsed = new Date(iso).getTime();
  if (!Number.isFinite(parsed)) {
    return (
      <span
        className={`text-xs text-[color:var(--text-dim,#71717a)] ${className}`}
        data-testid="timestamp-invalid"
      >
        —
      </span>
    );
  }

  const reference = typeof now === "number" ? now : Date.now();
  const rel = formatRelative(parsed, reference);

  return (
    <time
      dateTime={iso}
      title={iso}
      className={`text-xs text-[color:var(--text-muted,#a1a1aa)] ${className}`}
      data-testid="timestamp"
    >
      {prefix}
      {rel}
    </time>
  );
}

/**
 * Format a past-ish delta in the Eric-approved compact form.
 * Never fuzzy ("today", "yesterday" banned), always a precise count.
 */
export function formatRelative(atMs: number, nowMs: number): string {
  const delta = nowMs - atMs;
  if (delta < 0) {
    // Future timestamps — rare, but render as "just now" rather than
    // throwing or pretending the future already happened.
    return "just now";
  }
  if (delta < 60_000) {
    const s = Math.max(1, Math.floor(delta / 1_000));
    return `${s}s ago`;
  }
  if (delta < 3_600_000) {
    const m = Math.floor(delta / 60_000);
    return `${m}m ago`;
  }
  if (delta < 86_400_000) {
    const h = Math.floor(delta / 3_600_000);
    return `${h}h ago`;
  }
  if (delta < 30 * 86_400_000) {
    const d = Math.floor(delta / 86_400_000);
    return `${d}d ago`;
  }
  if (delta < 365 * 86_400_000) {
    const mo = Math.floor(delta / (30 * 86_400_000));
    return `${mo}mo ago`;
  }
  const y = Math.floor(delta / (365 * 86_400_000));
  return `${y}y ago`;
}
