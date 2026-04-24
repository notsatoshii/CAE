/**
 * Panel — shared chrome wrapper for elevated content panels.
 *
 * Provides a consistent rounded-lg border + bg-elev container with a
 * standardised header pattern (title + optional subtitle). Adopted by
 * spending/reliability/speed panels and incident stream to eliminate
 * per-panel chrome drift (pillar 3 — consistency).
 *
 * Usage:
 *   <Panel title="Spending" subtitle="Traffic · 42k tok today">
 *     {children}
 *   </Panel>
 *
 * The `as` prop lets callers swap the root element (default: section).
 * The `aria-labelledby` heading id is auto-derived from the title if not
 * overridden — callers relying on a specific id (e.g. existing test
 * selectors) should pass `headingId` explicitly.
 *
 * Class 13A (depth pass — Eric session 12: "UI lacks depth"):
 *   - `elevation` 0..4 wires `box-shadow: var(--elevation-N)` so panels
 *     register z-order visually, not just in code.
 *   - `interactive` bumps elevation-1 → elevation-2 on hover + 1%
 *     scale lift + 150ms ease. Only set it on Panels whose entire card
 *     is clickable.
 *
 * Class 5H (glassmorphic pass — Eric session 13 P2 directive):
 *   - `glass` opts into translucent fill + backdrop-blur + top-edge-brighter
 *     border gradient via the `.glass-surface` utility in globals.css. When
 *     true, the opaque `bg-[color:var(--surface)]` and the solid border are
 *     replaced by the glass tokens. Perf guard at <768px drops the blur
 *     automatically at the utility layer — callers don't need to branch.
 */

import type { ReactNode } from "react";

export type PanelElevation = 0 | 1 | 2 | 3 | 4;

export interface PanelProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Override the generated heading id. */
  headingId?: string;
  /** Extra className appended to the root section. */
  className?: string;
  /** data-testid for the root element. */
  testId?: string;
  /** Root element tag (default: section). */
  as?: "section" | "div" | "article";
  /** C2-wave/Class 3: liveness marker for audit scorer + debug tools. */
  dataLiveness?: "loading" | "empty" | "stale" | "healthy" | "error";
  /**
   * Class 13A — elevation level. `0` (default) preserves the legacy
   * border-only look so existing callers aren't disturbed. Pass `1`
   * for the new depth-aware treatment (recommended for primary cards).
   */
  elevation?: PanelElevation;
  /**
   * Class 13A — when true, Panel behaves as an interactive surface:
   * elevation-1 at rest, elevation-2 on hover, 1% scale lift, 150ms ease.
   * Pair with `role="button"` + `onClick` at the call site for a11y.
   */
  interactive?: boolean;
  /**
   * Class 5H — when true, replaces opaque surface + solid border with the
   * `.glass-surface` utility (translucent fill + backdrop-blur + top-edge-
   * brighter border gradient). Perf guard drops blur <768px. Default off.
   */
  glass?: boolean;
}

const ELEVATION_CLASS: Record<PanelElevation, string> = {
  0: "",
  1: "shadow-elevation-1",
  2: "shadow-elevation-2",
  3: "shadow-elevation-3",
  4: "shadow-elevation-4",
};

export function Panel({
  title,
  subtitle,
  children,
  headingId,
  className = "",
  testId,
  as: Tag = "section",
  dataLiveness,
  elevation = 0,
  interactive = false,
  glass = false,
}: PanelProps) {
  // Derive a stable id from the title when not provided.
  const id =
    headingId ??
    "panel-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const elevationClass = ELEVATION_CLASS[elevation] ?? "";
  // Interactive treatment: elevation-1 resting → elevation-2 hover +
  // 1% scale bump, 150ms ease-out (the spec's tactile cue).
  const interactiveClass = interactive
    ? "shadow-elevation-1 hover:shadow-elevation-2 hover:scale-[1.01] transition-all duration-150 ease-out will-change-transform"
    : "";

  // Class 5H — when glass=true, swap the opaque surface + solid border for
  // the .glass-surface utility. Keep rounded-lg + padding; those don't
  // clash with the glass treatment.
  const surfaceClass = glass
    ? "glass-surface rounded-lg p-6"
    : "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6";

  return (
    <Tag
      aria-labelledby={id}
      data-testid={testId}
      data-liveness={dataLiveness}
      data-elevation={elevation}
      data-interactive={interactive ? "true" : undefined}
      data-glass={glass ? "true" : undefined}
      className={
        surfaceClass + " " +
        (elevationClass ? elevationClass + " " : "") +
        (interactiveClass ? interactiveClass + " " : "") +
        className
      }
    >
      <header className="mb-4 flex items-baseline justify-between gap-2">
        <h2
          id={id}
          className="type-section"
        >
          {title}
        </h2>
        {subtitle != null && (
          <span className="type-meta">
            {subtitle}
          </span>
        )}
      </header>
      {children}
    </Tag>
  );
}
