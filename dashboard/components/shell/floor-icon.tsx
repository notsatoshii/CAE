"use client";

/**
 * FloorIcon — top-nav link to /floor (P11-01, D-19).
 *
 * Mirrors ChatPopOutIcon exactly:
 *   - next/link to /floor
 *   - lucide Gamepad2 size-4
 *   - 7x7 rounded hover target, text-muted -> text transition
 *   - ExplainTooltip wrapper using labelFor(dev).floorExplainHub
 *   - aria-label + title from labelFor(dev).floorPageTitle
 *   - data-testid="floor-icon"
 *
 * No dollar signs in this file (D-13 / lint-no-dollar.sh).
 */

import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { ExplainTooltip } from "@/components/ui/explain-tooltip";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";

export function FloorIcon() {
  const { dev } = useDevMode();
  const t = labelFor(dev);
  // C2 fix-wave Class 7: inline label beside the icon.
  return (
    <div className="flex items-center gap-1">
      <Link
        href="/floor"
        aria-label={t.floorPageTitle}
        data-testid="floor-icon"
        className="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
      >
        <Gamepad2 className="size-4" aria-hidden="true" />
        <span
          data-testid="floor-icon-label"
          className="hidden font-mono text-[11px] tracking-wide text-current md:inline"
        >
          {t.floorPageTitle}
        </span>
      </Link>
      <ExplainTooltip text={t.floorExplainHub} />
    </div>
  );
}
