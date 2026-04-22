/**
 * Phase 8 Wave 3 (MEM-06, D-04): GraphFilters tests.
 *
 * Run via `pnpm test -- components/memory/graph/graph-filters.test.tsx`.
 *
 * Assertions:
 *   1. Renders EXACTLY 4 chips (D-04: no commits chip).
 *   2. No chip labeled "commits" in any casing.
 *   3. Clicking a chip invokes `onToggle(kind)` with the correct kind.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DevModeProvider } from "@/lib/providers/dev-mode";
import type { NodeKind } from "@/lib/cae-graph-state";
import { GraphFilters } from "./graph-filters";

afterEach(() => {
  cleanup();
});

function renderFilters(
  selected: Set<NodeKind>,
  onToggle: (k: NodeKind) => void,
  counts?: Partial<Record<NodeKind, number>>,
) {
  const defaultCounts: Record<NodeKind, number> = {
    phases: 0,
    agents: 0,
    notes: 0,
    PRDs: 0,
    ...counts,
  };
  return render(
    <DevModeProvider>
      <GraphFilters
        selected={selected}
        onToggle={onToggle}
        counts={defaultCounts}
      />
    </DevModeProvider>,
  );
}

describe("GraphFilters", () => {
  it("renders exactly 4 chips", () => {
    renderFilters(new Set<NodeKind>(["phases", "agents", "notes", "PRDs"]), () => {});
    const group = screen.getByTestId("memory-graph-filters");
    const chips = group.querySelectorAll("button");
    expect(chips).toHaveLength(4);
  });

  it("does NOT render a Commits chip (D-04)", () => {
    renderFilters(new Set<NodeKind>(["phases", "agents", "notes", "PRDs"]), () => {});
    expect(screen.queryByText(/commits/i)).toBeNull();
    expect(
      screen.queryByTestId("memory-graph-filter-commits"),
    ).toBeNull();
  });

  it("invokes onToggle(kind) with the correct kind on click", () => {
    const onToggle = vi.fn();
    renderFilters(new Set<NodeKind>(["phases", "agents", "notes", "PRDs"]), onToggle);
    fireEvent.click(screen.getByTestId("memory-graph-filter-phases"));
    fireEvent.click(screen.getByTestId("memory-graph-filter-PRDs"));
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).toHaveBeenNthCalledWith(1, "phases");
    expect(onToggle).toHaveBeenNthCalledWith(2, "PRDs");
  });
});
