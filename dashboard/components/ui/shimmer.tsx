"use client";

/**
 * Shimmer — shared loading-skeleton primitive (ROADMAP backlog → loading pass).
 *
 * Complement to <Skeleton /> in this directory, not a replacement:
 *   - Skeleton is an a11y-first pulse placeholder keyed off Tailwind's
 *     animate-pulse.
 *   - Shimmer sweeps a diagonal highlight across the placeholder (Linear /
 *     Vercel pattern). Same role + aria contract, different motion signature.
 *
 * Four variants:
 *   <Shimmer width="100%" height={40} variant="text" />
 *   <Shimmer variant="box" />              // default, rounded-md
 *   <Shimmer variant="circle" size={48} />
 *   <Shimmer variant="bar" />              // progress-bar-ish, full-width, 4px
 *
 * All animation is CSS-only — no JS interval, no React state, no ref churn.
 * The keyframes + `.cae-shimmer` rule live in `app/globals.css` so every
 * instance shares one stylesheet rule. Reduced-motion is handled there too:
 * the sweep is halted and the gradient frozen mid-sweep so the placeholder
 * still reads as "something's coming" without motion.
 *
 * Tokens only — no hardcoded hex. `--surface-hover` is the base, and
 * `--border-strong` is the sweep highlight. Both palettes (light / dark)
 * inherit automatically.
 */

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type ShimmerVariant = "text" | "box" | "circle" | "bar";

export interface ShimmerProps {
  /** CSS width (ignored for variant="circle" — use `size`). Defaults 100%. */
  width?: string | number;
  /** CSS height (ignored for variant="circle" and "bar"). */
  height?: string | number;
  /** Only applies to variant="circle"; sets both width + height. */
  size?: string | number;
  /** Render variant — affects border-radius + default dimensions. */
  variant?: ShimmerVariant;
  /** Extra Tailwind classes merged onto the root. */
  className?: string;
  /** data-testid forwarded for vitest queries. */
  testId?: string;
  /** Optional human-readable label announced to AT (default "Loading"). */
  label?: string;
}

function toUnit(v: string | number | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "number" ? `${v}px` : v;
}

/**
 * Shimmer primitive. CSS-only sweep animation defined in globals.css under
 * the `.cae-shimmer` class (keyframes: cae-shimmer-sweep). Consumers compose
 * via width/height/size props.
 */
export function Shimmer({
  width,
  height,
  size,
  variant = "box",
  className,
  testId = "shimmer",
  label = "Loading",
}: ShimmerProps) {
  // Radius per variant.
  const radius =
    variant === "circle" ? "rounded-full" :
    variant === "text"   ? "rounded-sm"   :
    variant === "bar"    ? "rounded-full" :
                           "rounded-md";

  // Dimensions per variant — sensible defaults when props omitted.
  const style: CSSProperties = {};
  if (variant === "circle") {
    const dim = toUnit(size) ?? "32px";
    style.width = dim;
    style.height = dim;
  } else if (variant === "bar") {
    style.width = toUnit(width) ?? "100%";
    style.height = toUnit(height) ?? "4px";
  } else {
    style.width = toUnit(width) ?? "100%";
    style.height = toUnit(height) ?? (variant === "text" ? "12px" : "16px");
  }

  return (
    <div
      data-testid={testId}
      data-variant={variant}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
      className={cn("cae-shimmer", radius, className)}
      style={style}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default Shimmer;
