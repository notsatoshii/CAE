"use client";

/**
 * RollupStrip — Phase 15 Wave 2.5 semantic grouping.
 *
 * Source: .planning/phases/15-screenshot-truth-harness/WAVE-2-PLAN.md §2.5
 *
 * Problem: 5 metric tiles all sat at peer level with no semantic grouping,
 * tiny indicator dots (size-1.5), small icons (size-3), and the icon was
 * floated to the top-right of each card — visually disconnected from the
 * label. Eric flagged this as part of the "looks basic" critique.
 *
 * Fix:
 *   - Three groups: Health (Shipped + In-flight) | Warnings (Warnings +
 *     Blocked) | Cost (Tokens). Subtle vertical dividers between groups.
 *   - text-3xl tabular-nums values (was text-2xl/[32px]).
 *   - Icons bumped to size-4 (was size-3 / size-16) and repositioned LEFT
 *     of the label, not floating right of the card.
 *   - Indicator dots size-2.5 (was size-1.5) with a subtle box-shadow
 *     glow tinted by the dot color.
 *   - Mobile/tablet keep the existing 2/3 col grid; desktop (lg+) switches
 *     to a flex layout with sub-group dividers so the grouping is only
 *     visual where horizontal space allows.
 */

import {
  Package,
  Zap,
  AlertTriangle,
  CircleDollarSign,
  PauseCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useStatePoll } from "@/lib/hooks/use-state-poll";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { LastUpdated } from "@/components/ui/last-updated";

function formatTok(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

interface Slot {
  key: string;
  Icon: LucideIcon;
  value: string | number;
  label: string;
  /** Renders the indicator dot in --warning + glow when true. */
  warning: boolean;
}

interface SlotGroup {
  key: "health" | "warnings" | "cost";
  slots: Slot[];
}

function SlotTile({ slot }: { slot: Slot }) {
  const dotColor = slot.warning ? "var(--warning)" : "var(--text-dim)";
  return (
    <div
      data-testid={"rollup-slot-" + slot.key}
      className="card-base"
    >
      {/* Header: icon LEFT of label (no longer floating right of the card). */}
      <div className="flex items-center gap-1.5 text-[color:var(--text-muted)]">
        <slot.Icon aria-hidden size={16} className="size-4 shrink-0" />
        <span className="text-[13px]">{slot.label}</span>
      </div>
      {/* Value: text-3xl tabular nums, dominant. */}
      <div
        data-testid={"rollup-value-" + slot.key}
        data-truth={"rollup." + slot.key}
        className="mt-2 text-3xl font-semibold tabular-nums leading-none text-[color:var(--text)]"
      >
        {slot.value}
      </div>
      {/* Status dot: size-2.5 with subtle glow blur. */}
      <div className="mt-2 flex items-center gap-1.5">
        <span
          aria-hidden
          data-testid={"rollup-dot-" + slot.key}
          className="inline-block size-2.5 rounded-full"
          style={{
            backgroundColor: dotColor,
            boxShadow: "0 0 6px " + (slot.warning ? "color-mix(in oklch, var(--warning) 30%, transparent)" : "transparent"),
          }}
        />
        <span className="text-[11px] text-[color:var(--text-dim)] uppercase tracking-wide">
          {slot.warning ? "needs attention" : "nominal"}
        </span>
      </div>
    </div>
  );
}

export function RollupStrip() {
  const { data, lastUpdated } = useStatePoll();
  const { dev } = useDevMode();
  const t = labelFor(dev);

  const rollup = data?.rollup ?? {
    shipped_today: 0,
    tokens_today: 0,
    in_flight: 0,
    blocked: 0,
    warnings: 0,
  };

  const shipped: Slot = {
    key: "shipped",
    Icon: Package,
    value: rollup.shipped_today,
    label: t.rollupShippedLabel,
    warning: false,
  };
  const inFlight: Slot = {
    key: "in_flight",
    Icon: Zap,
    value: rollup.in_flight,
    label: t.rollupInFlightLabel,
    warning: false,
  };
  const warnings: Slot = {
    key: "warnings",
    Icon: AlertTriangle,
    value: rollup.warnings,
    label: "warnings",
    warning: rollup.warnings > 0,
  };
  const blocked: Slot = {
    key: "blocked",
    Icon: PauseCircle,
    value: rollup.blocked,
    label: t.rollupBlockedLabel,
    warning: rollup.blocked > 0,
  };
  const tokens: Slot = {
    key: "tokens",
    Icon: CircleDollarSign,
    value: formatTok(rollup.tokens_today),
    label: t.rollupTokensLabel,
    warning: false,
  };

  const groups: SlotGroup[] = [
    { key: "health", slots: [shipped, inFlight] },
    { key: "warnings", slots: [warnings, blocked] },
    { key: "cost", slots: [tokens] },
  ];
  const flatSlots: Slot[] = groups.flatMap((g) => g.slots);

  const rollupLoading = !data;

  return (
    <div data-testid="rollup-strip" className="mb-6">
      <span className="sr-only" data-truth={rollupLoading ? "rollup.loading" : "rollup.healthy"}>
        yes
      </span>
      {/* Mobile + tablet: simple grid, no group dividers. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:hidden">
        {flatSlots.map((s) => (
          <SlotTile key={s.key} slot={s} />
        ))}
      </div>

      {/* Desktop: 3 semantic groups with vertical dividers between them.
          Each group is itself a sub-grid sized by its number of slots so
          tiles stay equal-width within a group. */}
      <div className="hidden lg:flex lg:items-stretch lg:gap-4">
        {groups.map((g, i) => (
          <div
            key={g.key}
            data-testid={"rollup-group-" + g.key}
            className={
              "flex-1 grid gap-3 " +
              (g.slots.length === 1 ? "grid-cols-1" : "grid-cols-2") +
              (i < groups.length - 1
                ? " border-r border-[color:var(--border-subtle)] pr-4"
                : "")
            }
          >
            {g.slots.map((s) => (
              <SlotTile key={s.key} slot={s} />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex justify-end">
        <LastUpdated at={lastUpdated} threshold_ms={6000} />
      </div>
    </div>
  );
}
