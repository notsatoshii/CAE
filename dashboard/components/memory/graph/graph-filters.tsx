"use client";

/**
 * Phase 8 Wave 3 (MEM-06, D-04): 4-chip filter bar for the memory graph.
 *
 * Renders EXACTLY 4 chips: phases / agents / notes / PRDs — matching the
 * 4 members of the NodeKind union. The 5th category decision in D-04 is
 * deliberately absent from both the union and this chip row.
 *
 * Each chip is a button:
 *   - Active  → cyan border + accent-muted background.
 *   - Inactive → border-subtle only.
 *   - Trailing `(count)` suffix shows pre-filter node count for the kind.
 *   - Keyboard: Tab to focus; Space/Enter toggles (native button semantics).
 */

import type { NodeKind } from "@/lib/cae-graph-state";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";

interface GraphFiltersProps {
  selected: Set<NodeKind>;
  onToggle: (kind: NodeKind) => void;
  counts: Record<NodeKind, number>;
}

// D-04: exactly 4 kinds. Re-listed here in render order for deterministic
// ordering in the UI (the NodeKind union itself is defined in lib/cae-graph-state).
const FILTER_ORDER: readonly NodeKind[] = [
  "phases",
  "agents",
  "notes",
  "PRDs",
];

export function GraphFilters({
  selected,
  onToggle,
  counts,
}: GraphFiltersProps) {
  const { dev } = useDevMode();
  const L = labelFor(dev);

  const labelMap: Record<NodeKind, string> = {
    phases: L.memoryGraphFilterPhases,
    agents: L.memoryGraphFilterAgents,
    notes: L.memoryGraphFilterNotes,
    PRDs: L.memoryGraphFilterPrds,
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Graph filter chips"
      data-testid="memory-graph-filters"
    >
      {FILTER_ORDER.map((kind) => {
        const active = selected.has(kind);
        const count = counts[kind] ?? 0;
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onToggle(kind)}
            aria-pressed={active}
            data-kind={kind}
            data-testid={"memory-graph-filter-" + kind}
            className={
              "rounded-full border px-2.5 py-1 text-[11px] transition-colors " +
              (active
                ? "border-[color:var(--accent)] bg-[color:var(--accent-muted)] text-[color:var(--text)]"
                : "border-[color:var(--border)] bg-transparent text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]")
            }
          >
            {labelMap[kind]}
            <span className="ml-1 text-[10px] text-[color:var(--text-muted)]">
              ({count})
            </span>
          </button>
        );
      })}
    </div>
  );
}
