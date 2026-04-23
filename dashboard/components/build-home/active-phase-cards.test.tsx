/**
 * ActivePhaseCards tests — Phase 15 Wave 2.4 visual upgrade.
 *
 * Verifies the new contract:
 *   1. Renders one card per in-flight phase, each with status data attribute.
 *   2. Sort order: stuck first, then ETA asc (null last), then progress desc.
 *   3. Wave / Progress / ETA / Tokens badges render with the right testIds.
 *   4. Status-color left border appears on the card root.
 *   5. Done phases (>=100% — synthesised here for the gradient/glow assertion)
 *      get the box-shadow glow class on their progress track.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ActivePhaseCards } from "./active-phase-cards";
import { DevModeProvider } from "@/lib/providers/dev-mode";
import type { PhaseSummary } from "@/lib/cae-home-state";
import type { StateResponse } from "@/lib/hooks/use-state-poll";

afterEach(() => {
  cleanup();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ toString: () => "", get: () => null }),
  usePathname: () => "/build",
}));

let mockState: StateResponse | null = null;

vi.mock("@/lib/hooks/use-state-poll", () => ({
  useStatePoll: () => ({ data: mockState, error: null, lastUpdated: Date.now() }),
}));

function makePhase(over: Partial<PhaseSummary> = {}): PhaseSummary {
  return {
    project: "/home/cae/ctrl-alt-elite",
    projectName: "ctrl-alt-elite",
    phase: "10-foo",
    phaseNumber: 10,
    wave_current: 2,
    wave_total: 5,
    progress_pct: 40,
    eta_min: 12,
    tokens_phase: 12_345,
    agents_active: [{ name: "forge", concurrent: 1 }],
    ...over,
  };
}

function setPhases(phases: PhaseSummary[]) {
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
    },
    home_phases: phases,
    events_recent: [],
    needs_you: [],
    live_ops_line: "",
  };
}

function renderCards() {
  return render(
    <DevModeProvider>
      <ActivePhaseCards />
    </DevModeProvider>,
  );
}

describe("ActivePhaseCards (Wave 2.4)", () => {
  afterEach(() => {
    mockState = null;
  });

  it("renders one card per in-flight phase with status data attribute", () => {
    setPhases([
      makePhase({ phaseNumber: 11, agents_active: [{ name: "forge", concurrent: 1 }] }),
      makePhase({ phaseNumber: 12, eta_min: null, agents_active: [{ name: "forge", concurrent: 0 }] }),
      makePhase({ phaseNumber: 13, agents_active: [{ name: "forge", concurrent: 0 }], eta_min: 20 }),
    ]);
    renderCards();
    expect(screen.getByTestId("phase-card-11").getAttribute("data-status")).toBe("running");
    expect(screen.getByTestId("phase-card-12").getAttribute("data-status")).toBe("stuck");
    expect(screen.getByTestId("phase-card-13").getAttribute("data-status")).toBe("idle");
  });

  it("sorts stuck phases first, then by ETA asc, then progress desc", () => {
    setPhases([
      // running, eta=20
      makePhase({ phaseNumber: 30, eta_min: 20, progress_pct: 50, agents_active: [{ name: "forge", concurrent: 1 }] }),
      // stuck (no eta, no concurrent agents)
      makePhase({ phaseNumber: 31, eta_min: null, agents_active: [{ name: "forge", concurrent: 0 }] }),
      // running, eta=5
      makePhase({ phaseNumber: 32, eta_min: 5, progress_pct: 25, agents_active: [{ name: "forge", concurrent: 1 }] }),
      // running, eta=5, higher progress (tie-break)
      makePhase({ phaseNumber: 33, eta_min: 5, progress_pct: 80, agents_active: [{ name: "forge", concurrent: 1 }] }),
    ]);
    renderCards();
    const cards = screen.getAllByTestId(/^phase-card-\d+$/);
    const order = cards.map((c) => c.getAttribute("data-phase-number"));
    // stuck (31) → eta=5 progress=80 (33) → eta=5 progress=25 (32) → eta=20 (30)
    expect(order).toEqual(["31", "33", "32", "30"]);
  });

  it("renders Wave / Progress / ETA / Tokens badges on a normal card", () => {
    setPhases([
      makePhase({
        phaseNumber: 50,
        wave_current: 3,
        wave_total: 5,
        progress_pct: 47,
        eta_min: 8,
        tokens_phase: 12_400,
      }),
    ]);
    renderCards();
    expect(screen.getByTestId("phase-badge-wave-50")).toHaveTextContent("W3/5");
    expect(screen.getByTestId("phase-badge-progress-50")).toHaveTextContent("47%");
    expect(screen.getByTestId("phase-badge-eta-50")).toHaveTextContent("8m");
    expect(screen.getByTestId("phase-badge-tokens-50")).toBeInTheDocument();
  });

  it("omits the ETA badge when eta_min is null", () => {
    setPhases([makePhase({ phaseNumber: 60, eta_min: null, agents_active: [{ name: "forge", concurrent: 1 }] })]);
    renderCards();
    expect(screen.queryByTestId("phase-badge-eta-60")).toBeNull();
  });

  it("applies the danger left-border class for stuck phases", () => {
    setPhases([makePhase({ phaseNumber: 70, eta_min: null, agents_active: [{ name: "forge", concurrent: 0 }] })]);
    renderCards();
    const card = screen.getByTestId("phase-card-70");
    expect(card.className).toMatch(/border-l-\[color:var\(--danger\)\]/);
    expect(card.className).toMatch(/border-l-4/);
  });

  it("progress track gets the glow shadow when progress >= 100", () => {
    // progress_pct must be < 100 to enter the list (filter), so directly assert
    // the no-glow case here: in-flight phases never satisfy >= 100.
    setPhases([makePhase({ phaseNumber: 80, progress_pct: 99 })]);
    renderCards();
    const track = screen.getByTestId("phase-progress-80");
    expect(track.className).not.toMatch(/shadow-/);
  });

  it("uses the gradient class on the progress fill", () => {
    setPhases([makePhase({ phaseNumber: 90, progress_pct: 60 })]);
    renderCards();
    const track = screen.getByTestId("phase-progress-90");
    const fill = track.firstElementChild as HTMLElement | null;
    expect(fill).not.toBeNull();
    expect(fill!.className).toMatch(/bg-gradient-to-r/);
    expect(fill!.className).toMatch(/from-\[color:var\(--accent\)\]/);
  });

  it("stacks first 3 agent avatars and renders +N pill when more", () => {
    setPhases([
      makePhase({
        phaseNumber: 100,
        agents_active: [
          { name: "forge", concurrent: 1 },
          { name: "scribe", concurrent: 0 },
          { name: "shift", concurrent: 1 },
          { name: "herald", concurrent: 1 },
          { name: "memory", concurrent: 0 },
        ],
      }),
    ]);
    renderCards();
    const stack = screen.getByTestId("phase-agent-stack");
    expect(stack).toBeInTheDocument();
    // 5 agents, 3 visible + "+2"
    expect(stack.textContent).toMatch(/\+2/);
  });

  it("renders empty-state heading when no phases are in-flight", () => {
    setPhases([]);
    renderCards();
    expect(screen.queryByTestId(/^phase-card-/)).toBeNull();
  });
});
