"use client";

/**
 * EmptyState primitive — Phase 12 Plan 03, EMP-01.
 *
 * A single well-tested empty-state primitive so every route renders the same
 * visual rhythm + guided CTAs. Variants: "empty" (default) and "error".
 *
 * Usage:
 *   <EmptyState
 *     icon={Inbox}
 *     heading={L.emptyBuildHomeHeading}
 *     body={L.emptyBuildHomeBody}
 *     actions={
 *       <EmptyStateActions>
 *         <Button variant="secondary" onClick={...}>{L.emptyBuildHomeCtaPlan}</Button>
 *       </EmptyStateActions>
 *     }
 *   />
 *
 * Security: NO dangerouslySetInnerHTML — React auto-escapes all strings. (T-12-10)
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Optional lucide glyph rendered at 48px above the heading. */
  icon?: LucideIcon;
  /** Required short string — rendered as <h3>. Founder-first copy. */
  heading: string;
  /** Optional paragraph below heading. */
  body?: string;
  /** Optional actions row — pass <Button>s or the <EmptyStateActions> helper. */
  actions?: ReactNode;
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
  testId,
  variant = "empty",
  className,
}: EmptyStateProps) {
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
        {heading}
      </h3>
      {body ? (
        <p className="text-xs text-[color:var(--text-muted)]">{body}</p>
      ) : null}
      {actions ? (
        <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>
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
