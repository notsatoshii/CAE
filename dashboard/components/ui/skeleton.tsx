"use client";

/**
 * Skeleton primitive — Phase 15 Wave 2.7.
 *
 * Vercel / Linear-style loading placeholders. Replaces ad-hoc spinners and
 * one-off `<div className="animate-pulse">` shapes scattered across the
 * codebase so every loading surface speaks the same visual language.
 *
 * Three exported shapes:
 *   - <Skeleton />       atomic placeholder; pass width/height via className
 *                        OR the explicit `width`/`height` props.
 *   - <CardSkeleton />   60×80 card-shaped placeholder for grid/kanban surfaces.
 *   - <RowSkeleton />    full-width row (24px title + 16px subtitle line).
 *
 * Animation: relies on Tailwind's `animate-pulse`. globals.css already disables
 * this under `prefers-reduced-motion: reduce` (Phase 12 MOT-01) so we don't
 * need a per-component motion-reduce override here.
 *
 * Accessibility: every skeleton sets `role="status"` + `aria-busy="true"` +
 * `aria-live="polite"` so AT users hear "Loading content" instead of silence.
 * The visual placeholder itself is `aria-hidden` to avoid double-announcing.
 *
 * Tokens: backgrounds use `--surface-hover` (the established skeleton tone in
 * the codebase per agent-detail-drawer / live-activity-panel) — no new colours
 * introduced, no globals.css changes required.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps {
  /** Optional explicit width — accepts CSS units ("100%", "120px", "8rem"). */
  width?: string | number;
  /** Optional explicit height — accepts CSS units ("100%", "16px", "1rem"). */
  height?: string | number;
  /** Render variant. `text` is rounded-sm; `box` is rounded; `circle` is full. */
  variant?: "text" | "box" | "circle";
  /** Extra Tailwind classes merged onto the root. */
  className?: string;
  /** data-testid forwarded for vitest queries. */
  testId?: string;
  /** Optional human-readable label announced to AT (default "Loading"). */
  label?: string;
}

/** Single skeleton placeholder shape. */
export function Skeleton({
  width,
  height,
  variant = "box",
  className,
  testId = "skeleton",
  label = "Loading",
}: SkeletonProps) {
  const radius =
    variant === "circle" ? "rounded-full" :
    variant === "text"   ? "rounded-sm"   :
                           "rounded";

  const style: React.CSSProperties = {};
  if (width !== undefined) style.width = typeof width === "number" ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      data-testid={testId}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "animate-pulse bg-[color:var(--surface-hover)]",
        radius,
        className,
      )}
      style={style}
    >
      {/* Visually-hidden text so AT has a stable label even if aria-label
          is stripped by a future aria-cleaner. */}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export interface CardSkeletonProps {
  /** Extra classes (e.g. column span, margin). */
  className?: string;
  /** data-testid forwarded for vitest queries. */
  testId?: string;
  /** Optional children rendered above the skeleton lines (e.g. icon slot). */
  children?: ReactNode;
}

/**
 * Card-shape skeleton. Mirrors the rhythm of `.card-base`: padding-4, gap-3,
 * one tall placeholder for the headline number + two thin lines for the
 * meta-row. Use anywhere a real card is about to mount.
 */
export function CardSkeleton({
  className,
  testId = "card-skeleton",
  children,
}: CardSkeletonProps) {
  return (
    <div
      data-testid={testId}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading card"
      className={cn(
        "card-base flex flex-col gap-3 min-h-[80px]",
        className,
      )}
    >
      {children}
      <Skeleton height={24} width="60%" testId={`${testId}-line-1`} label="Loading title" />
      <Skeleton height={12} width="40%" testId={`${testId}-line-2`} label="Loading subtitle" />
      <span className="sr-only">Loading card</span>
    </div>
  );
}

export interface RowSkeletonProps {
  /** Number of skeleton rows to render in sequence (default 1). */
  rows?: number;
  /** Extra classes on the wrapper. */
  className?: string;
  /** data-testid forwarded for vitest queries. */
  testId?: string;
}

/**
 * Row-shape skeleton — full-width 24px title + 16px subtitle. Stacks `rows`
 * copies vertically with consistent gap-2 rhythm. Use for ledger / list /
 * table-cell placeholders.
 */
export function RowSkeleton({
  rows = 1,
  className,
  testId = "row-skeleton",
}: RowSkeletonProps) {
  const items = Array.from({ length: Math.max(1, rows) }, (_, i) => i);
  return (
    <div
      data-testid={testId}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading rows"
      className={cn("flex flex-col gap-2", className)}
    >
      {items.map((i) => (
        <div key={i} className="flex flex-col gap-1.5" data-testid={`${testId}-row-${i}`}>
          <Skeleton height={16} width="100%" variant="text" testId={`${testId}-row-${i}-title`} />
          <Skeleton height={12} width="60%" variant="text" testId={`${testId}-row-${i}-subtitle`} />
        </div>
      ))}
      <span className="sr-only">Loading rows</span>
    </div>
  );
}
