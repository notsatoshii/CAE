"use client";

/**
 * EmptyState primitive — Phase 12 Plan 03 (EMP-01) + Phase 15 Wave 2.6.
 *
 * A single well-tested empty-state primitive so every route renders the same
 * visual rhythm + guided CTAs. Variants: "empty" (default) and "error".
 *
 * Two API shapes are supported, both backwards compatible:
 *
 *  - Original (Phase 12 — `heading` / `body` / `actions`):
 *    <EmptyState
 *      icon={Inbox}
 *      heading="Nothing here yet."
 *      body="Try refreshing."
 *      actions={<Button>Refresh</Button>}
 *    />
 *
 *  - Wave 2.6 (`title` / `description` / `cta` / `tip`) — used with the
 *    EMPTY_COPY map in lib/copy/empty-states.ts for character-rich copy
 *    across surfaces:
 *    <EmptyState
 *      {...EMPTY_COPY.queue}
 *      icon={Inbox}
 *      testId="queue-empty"
 *    />
 *
 * If both shapes are passed (e.g. body and description), the original
 * (heading/body/actions) wins to preserve current snapshot semantics.
 *
 * Security: NO dangerouslySetInnerHTML — React auto-escapes all strings. (T-12-10)
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Optional lucide glyph rendered at 48px above the heading. */
  icon?: LucideIcon;

  // ── Original API (Phase 12 — kept for back-compat) ─────────────────────
  /** Required short string — rendered as <h3>. Founder-first copy. */
  heading?: string;
  /** Optional paragraph below heading. */
  body?: string;
  /** Optional actions row — pass <Button>s or the <EmptyStateActions> helper. */
  actions?: ReactNode;

  // ── Wave 2.6 alias API (character copy from EMPTY_COPY) ────────────────
  /** Alias for `heading`. Used by EMPTY_COPY map. */
  title?: string;
  /** Alias for `body`. Used by EMPTY_COPY map. */
  description?: string;
  /** Single CTA — renders as an <a> linking to `href` (or onClick). */
  cta?: { label: string; onClick?: () => void; href?: string };
  /** Subtle tip text rendered below the CTA. */
  tip?: string;

  // ── Common ─────────────────────────────────────────────────────────────
  /** Exposes data-testid="…" for vitest queries. Default: "empty-state". */
  testId?: string;
  /** "empty" (default) or "error". Affects hero-icon colour only. */
  variant?: "empty" | "error";
  /** Extra className merged onto the root (card wrapper). */
  className?: string;
}

export function EmptyState({
  icon: Icon,
  heading,
  body,
  actions,
  title,
  description,
  cta,
  tip,
  testId,
  variant = "empty",
  className,
}: EmptyStateProps) {
  // Resolve heading / body — original wins, then alias.
  const resolvedHeading = heading ?? title ?? "";
  const resolvedBody = body ?? description;

  const iconClass =
    variant === "error"
      ? "size-12 text-[color:var(--danger)]"
      : "size-12 text-[color:var(--text-dim)]";

  return (
    <div
      data-testid={testId ?? "empty-state"}
      data-variant={variant}
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg",
        "border border-[color:var(--border-subtle)] bg-[color:var(--surface)]",
        "p-8 text-center",
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className={iconClass} /> : null}
      <h3 className="text-sm font-medium text-[color:var(--text)]">
        {resolvedHeading}
      </h3>
      {resolvedBody ? (
        <p className="max-w-prose text-xs text-[color:var(--text-muted)]">
          {resolvedBody}
        </p>
      ) : null}
      {actions ? (
        <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>
      ) : null}
      {/* Wave 2.6 single-CTA shorthand — only renders when `cta` prop set
          AND no `actions` slot (actions wins for back-compat). */}
      {!actions && cta ? (
        <a
          href={cta.href}
          onClick={cta.onClick}
          className={cn(
            "mt-1 inline-flex items-center gap-1.5 rounded",
            "border border-[color:var(--accent)] bg-transparent px-3 py-1.5",
            "text-xs font-medium text-[color:var(--accent)]",
            "transition-colors hover:bg-[color:var(--accent)] hover:text-[color:var(--accent-foreground)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]",
          )}
        >
          {cta.label}
        </a>
      ) : null}
      {tip ? (
        <p className="mt-2 text-[11px] text-[color:var(--text-dim)]">{tip}</p>
      ) : null}
    </div>
  );
}

/** Small flex-wrap row for CTA buttons. Accepts any ReactNodes (typically <Button>s). */
export function EmptyStateActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {children}
    </div>
  );
}
