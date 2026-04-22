"use client";

/**
 * Phase 7 — ExplainTooltip (REQ-7-FOUNDER, D-11).
 *
 * Renders a small "?" button that opens a base-ui Popover containing a
 * per-metric explanation. Anchor points live next to confusing labels
 * across the three panels (P50/P95, success rate, projected, queue depth,
 * retry heatmap, time-to-merge).
 *
 * Design notes:
 * - Trigger is ALWAYS rendered so keyboard users can always reach the
 *   explanation. When explain-mode is off (Ctrl+E), the trigger dims to
 *   30% opacity instead of disappearing.
 * - Popup carries `role="tooltip"` for a11y.
 * - base-ui does NOT support `asChild` (AGENTS.md gotcha) — we use
 *   className on the Popover.Trigger directly.
 *
 * (D-15): relocated to components/ui/ in Phase 8 Wave 0 for cross-phase reuse.
 */

import { Popover } from "@base-ui/react/popover";
import { HelpCircle } from "lucide-react";
import { useExplainMode } from "@/lib/providers/explain-mode";

interface ExplainTooltipProps {
  text: string;
  ariaLabel?: string;
}

export function ExplainTooltip({ text, ariaLabel }: ExplainTooltipProps) {
  const { explain } = useExplainMode();

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={ariaLabel ?? "Explain this metric"}
        className={
          (explain
            ? "opacity-70 hover:opacity-100 "
            : "opacity-30 hover:opacity-100 ") +
          "inline-flex h-4 w-4 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-opacity hover:text-[color:var(--accent)] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]"
        }
        data-testid="explain-trigger"
      >
        <HelpCircle className="size-3.5" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6}>
          <Popover.Popup
            role="tooltip"
            className="max-w-[260px] rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-xs text-[color:var(--text)] shadow-lg"
            data-testid="explain-popup"
          >
            {text}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
