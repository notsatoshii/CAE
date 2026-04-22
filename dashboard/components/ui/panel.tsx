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
 */

import type { ReactNode } from "react";

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
}

export function Panel({
  title,
  subtitle,
  children,
  headingId,
  className = "",
  testId,
  as: Tag = "section",
}: PanelProps) {
  // Derive a stable id from the title when not provided.
  const id =
    headingId ??
    "panel-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  return (
    <Tag
      aria-labelledby={id}
      data-testid={testId}
      className={
        "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 " +
        className
      }
    >
      <header className="mb-4 flex items-baseline justify-between gap-2">
        <h2
          id={id}
          className="text-[15px] font-semibold text-[color:var(--text)]"
        >
          {title}
        </h2>
        {subtitle != null && (
          <span className="text-[12px] text-[color:var(--text-muted)]">
            {subtitle}
          </span>
        )}
      </header>
      {children}
    </Tag>
  );
}
