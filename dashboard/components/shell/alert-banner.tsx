"use client";

/**
 * AlertBanner — persistent amber alert bar (Plan 13-07, Task 2).
 *
 * Renders between TopNav and main content when circuit-breaker state
 * indicates a problem. Stays hidden when all clear.
 *
 * Trigger conditions (from existing /api/state, zero new endpoints):
 *   - breakers.halted === true
 *   - breakers.retryCount > 0
 *   - breakers.recentPhantomEscalations > 0
 *
 * Fingerprint-based dismissal:
 *   - Fingerprint = `{h_flag}|{retryCount}|{phantomEscalations}`
 *   - Stored in localStorage key `p13-alert-dismissed` as `{ fingerprint }`
 *   - Banner re-appears when fingerprint changes (new/worse trigger)
 *
 * MC IA adoption: V2 §5 row 2 — mirrors Mission Control amber alert bar
 * with inline CTAs.
 *
 * Styled with CSS variables only — no Tailwind amber utilities that might
 * not be in the purge allowlist; uses var(--warning) from the design system.
 */

import { useState } from "react";
import { useStatePoll } from "@/lib/hooks/use-state-poll";
import type { StateResponse } from "@/lib/hooks/use-state-poll";

// LS key for dismissed fingerprint
const LS_KEY = "p13-alert-dismissed";

function fingerprint(b: StateResponse["breakers"]): string {
  return `${b.halted ? "h" : ""}|${b.retryCount}|${b.recentPhantomEscalations}`;
}

function getDismissedFp(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fingerprint?: string };
    return parsed.fingerprint ?? null;
  } catch {
    return null;
  }
}

function saveDismissedFp(fp: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ fingerprint: fp }));
  } catch {
    // best-effort
  }
}

function getCopy(b: StateResponse["breakers"]): string {
  if (b.halted) {
    return "Something paused progress. Click to see what's blocking.";
  }
  if (b.retryCount > 0) {
    return `A task retried (${b.retryCount}). Usually self-heals — click for details.`;
  }
  if (b.recentPhantomEscalations > 0) {
    return `A background gate was escalated (${b.recentPhantomEscalations}). Click to review.`;
  }
  return "";
}

function isTriggered(b: StateResponse["breakers"]): boolean {
  return b.halted || b.retryCount > 0 || b.recentPhantomEscalations > 0;
}

export function AlertBanner() {
  const { data } = useStatePoll();
  const [dismissed, setDismissed] = useState<string | null>(() => getDismissedFp());

  if (!data?.breakers) return null;

  const b = data.breakers;

  if (!isTriggered(b)) return null;

  const fp = fingerprint(b);

  // If dismissed fingerprint matches current trigger, stay hidden
  if (dismissed === fp) return null;

  const copy = getCopy(b);

  function handleDismiss() {
    saveDismissedFp(fp);
    setDismissed(fp);
  }

  return (
    <div
      data-testid="alert-banner"
      role="alert"
      aria-live="polite"
      style={{
        background: "color-mix(in srgb, var(--warning, #f59e0b) 10%, transparent)",
        borderBottom: "1px solid var(--warning, #f59e0b)",
        color: "var(--text, #e5e5e5)",
      }}
      className="flex w-full items-center justify-between gap-3 px-4 py-2 text-sm"
    >
      {/* Icon + copy */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          aria-hidden
          style={{ color: "var(--warning, #f59e0b)" }}
          className="text-base flex-shrink-0"
        >
          ⚠
        </span>
        <span className="truncate">{copy}</span>
      </div>

      {/* CTAs */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <a
          href="/build"
          className="text-xs underline underline-offset-2 hover:opacity-80 transition-opacity"
          style={{ color: "var(--warning, #f59e0b)" }}
          data-testid="alert-banner-details"
        >
          Show details
        </a>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss alert"
          className="ml-2 rounded px-2 py-0.5 text-xs transition-opacity hover:opacity-70"
          style={{
            border: "1px solid var(--warning, #f59e0b)",
            color: "var(--warning, #f59e0b)",
          }}
          data-testid="alert-banner-dismiss"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
