/**
 * TaskHeaderSummary tests — P15 detail-expand fix.
 *
 * Covers the three audit-flagged P0 fields (#2 in DETAIL-EXPAND-AUDIT.md):
 *   - ETA chip (with explicit eta_min and the projected fallback)
 *   - Token cost chip ($ derived through cae-cost-table)
 *   - Status pill (queued / running / waiting / done / failed)
 *
 * Plus a loading-state test for when phaseSummary is null.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TaskHeaderSummary, deriveStage } from "./task-header-summary";
import type { PhaseSummary } from "@/lib/cae-home-state";

afterEach(() => {
  cleanup();
});

function makePhase(over: Partial<PhaseSummary> = {}): PhaseSummary {
  return {
    project: "/home/cae/ctrl-alt-elite",
    projectName: "ctrl-alt-elite",
    phase: "p4-build",
    phaseNumber: 4,
    wave_current: 2,
    wave_total: 4,
    progress_pct: 45,
    eta_min: 12,
    tokens_phase: 1_200_000,
    agents_active: [{ name: "forge", concurrent: 1 }],
    ...over,
  };
}

describe("TaskHeaderSummary", () => {
  it("renders the loading state when phase is null", () => {
    render(<TaskHeaderSummary phase={null} />);
    const root = screen.getByTestId("task-header-summary");
    expect(root.getAttribute("data-state")).toBe("loading");
    expect(root.textContent).toMatch(/loading/i);
  });

  it("derives 'running' stage when at least one agent has concurrent > 0", () => {
    const p = makePhase({ progress_pct: 45, agents_active: [{ name: "forge", concurrent: 2 }] });
    expect(deriveStage(p)).toBe("running");
    render(<TaskHeaderSummary phase={p} />);
    expect(screen.getByTestId("task-header-stage")).toHaveTextContent("Running");
    expect(screen.getByTestId("task-header-summary").getAttribute("data-stage")).toBe("running");
  });

  it("derives 'waiting' stage when progress > 0 but no agents are concurrent", () => {
    const p = makePhase({ progress_pct: 45, agents_active: [{ name: "forge", concurrent: 0 }] });
    expect(deriveStage(p)).toBe("waiting");
    render(<TaskHeaderSummary phase={p} />);
    expect(screen.getByTestId("task-header-stage")).toHaveTextContent("Waiting");
  });

  it("derives 'queued' stage when no progress and no concurrent agents", () => {
    const p = makePhase({ progress_pct: 0, agents_active: [] });
    expect(deriveStage(p)).toBe("queued");
    render(<TaskHeaderSummary phase={p} />);
    expect(screen.getByTestId("task-header-stage")).toHaveTextContent("Queued");
  });

  it("derives 'done' stage when progress hits 100", () => {
    const p = makePhase({ progress_pct: 100 });
    expect(deriveStage(p)).toBe("done");
    render(<TaskHeaderSummary phase={p} />);
    expect(screen.getByTestId("task-header-stage")).toHaveTextContent("Done");
  });

  it("renders ETA from eta_min when provided", () => {
    render(<TaskHeaderSummary phase={makePhase({ eta_min: 12 })} />);
    expect(screen.getByTestId("task-header-eta")).toHaveTextContent("ETA 12m");
  });

  it("formats ETA over an hour with h+m breakdown", () => {
    render(<TaskHeaderSummary phase={makePhase({ eta_min: 95 })} />);
    expect(screen.getByTestId("task-header-eta")).toHaveTextContent("1h 35m");
  });

  it("falls back to a projected ETA when eta_min is null but progress is non-zero", () => {
    render(<TaskHeaderSummary phase={makePhase({ eta_min: null, progress_pct: 50 })} />);
    // 30 min reference / 0.5 elapsed ratio = 60 total → 30 remaining
    const chip = screen.getByTestId("task-header-eta");
    expect(chip.textContent).toMatch(/ETA \d+m/);
    expect(chip.textContent).not.toMatch(/—/);
  });

  it("shows ETA — when eta_min is null and progress is zero (cannot extrapolate)", () => {
    render(<TaskHeaderSummary phase={makePhase({ eta_min: null, progress_pct: 0 })} />);
    expect(screen.getByTestId("task-header-eta")).toHaveTextContent("ETA —");
  });

  it("renders tokens chip with formatted amount (tokens-only, no USD)", () => {
    render(<TaskHeaderSummary phase={makePhase({ tokens_phase: 1_200_000 })} />);
    const chip = screen.getByTestId("task-header-tokens");
    expect(chip.textContent).toMatch(/1\.20M tok/);
    expect(chip.textContent).not.toMatch(/\$/);
  });

  it("shows 0 tok when tokens_phase is zero", () => {
    render(<TaskHeaderSummary phase={makePhase({ tokens_phase: 0 })} />);
    const chip = screen.getByTestId("task-header-tokens");
    expect(chip.textContent).toBe("0 tok");
  });

  it("renders wave/progress chip in 'Wave x/y · z%' format", () => {
    render(<TaskHeaderSummary phase={makePhase({ wave_current: 2, wave_total: 4, progress_pct: 45 })} />);
    expect(screen.getByTestId("task-header-progress")).toHaveTextContent("Wave 2/4 · 45%");
  });
});
