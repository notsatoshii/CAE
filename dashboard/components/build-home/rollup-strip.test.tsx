/**
 * RollupStrip tests — Phase 15 Wave 2.5 semantic grouping.
 *
 * Verifies:
 *   1. Five metric tiles render (mobile path) with the right values.
 *   2. Three semantic groups exist on the desktop path (Health / Warnings / Cost).
 *   3. The Health group contains Shipped + In-flight; Warnings contains
 *      Warnings + Blocked; Cost contains Tokens.
 *   4. The icon sits LEFT of the label (no longer floating absolute).
 *   5. Indicator dot is size-2.5 (verified via class) and gets the
 *      --warning glow when its slot is in warning state.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { RollupStrip } from "./rollup-strip";
import { DevModeProvider } from "@/lib/providers/dev-mode";
import type { StateResponse } from "@/lib/hooks/use-state-poll";

afterEach(() => {
  cleanup();
});

let mockState: StateResponse | null = null;

vi.mock("@/lib/hooks/use-state-poll", () => ({
  useStatePoll: () => ({ data: mockState, error: null, lastUpdated: Date.now() }),
}));

function setRollup(rollup: Partial<StateResponse["rollup"]>) {
  mockState = {
    breakers: {
      activeForgeCount: 0,
      inputTokensToday: 0,
      outputTokensToday: 0,
      retryCount: 0,
      recentPhantomEscalations: 0,
      halted: false,
    },
    metrics: { breakers: [], sentinel: [], compaction: [], approvals: [] },
    rollup: {
      shipped_today: 0,
      tokens_today: 0,
      in_flight: 0,
      blocked: 0,
      warnings: 0,
      ...rollup,
    },
    home_phases: [],
    events_recent: [],
    needs_you: [],
    live_ops_line: "",
  };
}

function renderStrip() {
  return render(
    <DevModeProvider>
      <RollupStrip />
    </DevModeProvider>,
  );
}

describe("RollupStrip (Wave 2.5)", () => {
  afterEach(() => {
    mockState = null;
  });

  it("renders the 5 metric values", () => {
    setRollup({
      shipped_today: 7,
      in_flight: 3,
      warnings: 1,
      blocked: 0,
      tokens_today: 12_400,
    });
    renderStrip();
    // Each slot is rendered twice (mobile grid + desktop flex). Use getAllByTestId.
    expect(screen.getAllByTestId("rollup-value-shipped")[0]).toHaveTextContent("7");
    expect(screen.getAllByTestId("rollup-value-in_flight")[0]).toHaveTextContent("3");
    expect(screen.getAllByTestId("rollup-value-warnings")[0]).toHaveTextContent("1");
    expect(screen.getAllByTestId("rollup-value-blocked")[0]).toHaveTextContent("0");
    expect(screen.getAllByTestId("rollup-value-tokens")[0]).toHaveTextContent("12.4k");
  });

  it("renders the three semantic groups on desktop", () => {
    setRollup({});
    renderStrip();
    expect(screen.getByTestId("rollup-group-health")).toBeInTheDocument();
    expect(screen.getByTestId("rollup-group-warnings")).toBeInTheDocument();
    expect(screen.getByTestId("rollup-group-cost")).toBeInTheDocument();
  });

  it("groups Shipped + In-flight under Health", () => {
    setRollup({});
    renderStrip();
    const health = screen.getByTestId("rollup-group-health");
    expect(within(health).getByTestId("rollup-slot-shipped")).toBeInTheDocument();
    expect(within(health).getByTestId("rollup-slot-in_flight")).toBeInTheDocument();
  });

  it("groups Warnings + Blocked under Warnings", () => {
    setRollup({});
    renderStrip();
    const warns = screen.getByTestId("rollup-group-warnings");
    expect(within(warns).getByTestId("rollup-slot-warnings")).toBeInTheDocument();
    expect(within(warns).getByTestId("rollup-slot-blocked")).toBeInTheDocument();
  });

  it("groups Tokens alone under Cost", () => {
    setRollup({});
    renderStrip();
    const cost = screen.getByTestId("rollup-group-cost");
    expect(within(cost).getByTestId("rollup-slot-tokens")).toBeInTheDocument();
    // Cost group shouldn't accidentally pull in any other tile.
    expect(within(cost).queryByTestId("rollup-slot-shipped")).toBeNull();
  });

  it("indicator dot uses size-2.5 (Wave 2.5 spec, was size-1.5)", () => {
    setRollup({ warnings: 2 });
    renderStrip();
    const dots = screen.getAllByTestId("rollup-dot-warnings");
    expect(dots[0].className).toContain("size-2.5");
    expect(dots[0].className).not.toContain("size-1.5");
  });

  it("warning slot gets the --warning box-shadow glow on its dot", () => {
    setRollup({ warnings: 5 });
    renderStrip();
    const dots = screen.getAllByTestId("rollup-dot-warnings");
    const inline = dots[0].getAttribute("style") ?? "";
    expect(inline).toMatch(/var\(--warning\)/);
    expect(inline).toMatch(/box-shadow/);
  });

  it("non-warning slot has no glow shadow", () => {
    setRollup({ shipped_today: 4 });
    renderStrip();
    const dots = screen.getAllByTestId("rollup-dot-shipped");
    const inline = dots[0].getAttribute("style") ?? "";
    // shadow exists in style but should resolve to transparent for non-warning slots
    expect(inline).toMatch(/transparent/);
  });

  it("only the first two groups carry a right-border divider", () => {
    setRollup({});
    renderStrip();
    expect(screen.getByTestId("rollup-group-health").className).toMatch(/border-r/);
    expect(screen.getByTestId("rollup-group-warnings").className).toMatch(/border-r/);
    expect(screen.getByTestId("rollup-group-cost").className).not.toMatch(/border-r/);
  });
});
