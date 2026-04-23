/**
 * Stats7dSparklines tests — P15 detail-expand fix.
 *
 * Eric's audit (#1) flagged that stats_7d arrays were available on
 * AgentDetailEntry but never rendered. This test asserts:
 *   1. All three sparkline cells render with the expected labels.
 *   2. Each cell's latest-value chip formats per-series (tok/hr, %, ms).
 *   3. Empty arrays still render the cells (no layout shift) and mark
 *      themselves with data-empty="true".
 *   4. A real Sparkline svg is emitted for non-empty series.
 *   5. Aria labels are present on each sparkline (a11y).
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Stats7dSparklines } from "./stats-7d-sparklines";
import type { AgentRosterEntry } from "@/lib/cae-agents-state";

afterEach(() => {
  cleanup();
});

function makeStats(
  over: Partial<AgentRosterEntry["stats_7d"]> = {},
): AgentRosterEntry["stats_7d"] {
  return {
    tokens_per_hour: [10, 20, 30, 25, 40, 50, 45, 60, 55, 75],
    tokens_total: 4_500_000,
    success_rate: 0.92,
    success_history: [1, 0.9, 0.85, 1, 0.95, 0.88, 0.92, 0.9, 0.95, 0.92],
    avg_wall_ms: 30_000,
    wall_history: [25_000, 28_000, 30_000, 32_000, 29_000, 31_000, 30_000, 28_500, 27_000, 26_000],
    ...over,
  };
}

describe("Stats7dSparklines", () => {
  it("renders the three sparkline cells under a 'Last 7 days' heading", () => {
    render(<Stats7dSparklines stats_7d={makeStats()} />);
    expect(screen.getByText(/last 7 days/i)).toBeInTheDocument();
    expect(screen.getByTestId("sparkline-invocations")).toBeInTheDocument();
    expect(screen.getByTestId("sparkline-success")).toBeInTheDocument();
    expect(screen.getByTestId("sparkline-tokens")).toBeInTheDocument();
  });

  it("renders the latest activity value formatted as tok/hr", () => {
    render(<Stats7dSparklines stats_7d={makeStats({ tokens_per_hour: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1500] })} />);
    expect(screen.getByTestId("sparkline-invocations")).toHaveTextContent("1.5k tok/hr");
  });

  it("renders the latest success-rate value as a whole percent", () => {
    render(<Stats7dSparklines stats_7d={makeStats({ success_history: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.87] })} />);
    expect(screen.getByTestId("sparkline-success")).toHaveTextContent("87%");
  });

  it("renders latest wall time formatted in seconds when ≥1000ms", () => {
    render(<Stats7dSparklines stats_7d={makeStats({ wall_history: [0, 0, 0, 0, 0, 0, 0, 0, 0, 4500] })} />);
    expect(screen.getByTestId("sparkline-tokens")).toHaveTextContent("4.5s");
  });

  it("emits an SVG sparkline for each non-empty series", () => {
    const { container } = render(<Stats7dSparklines stats_7d={makeStats()} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(3);
  });

  it("marks cells as data-empty when all values are zero", () => {
    const stats = makeStats({
      tokens_per_hour: new Array(10).fill(0),
      success_history: new Array(10).fill(0),
      wall_history: new Array(10).fill(0),
    });
    render(<Stats7dSparklines stats_7d={stats} />);
    expect(screen.getByTestId("sparkline-invocations").getAttribute("data-empty")).toBe("true");
    expect(screen.getByTestId("sparkline-success").getAttribute("data-empty")).toBe("true");
    expect(screen.getByTestId("sparkline-tokens").getAttribute("data-empty")).toBe("true");
  });

  it("attaches an aria-label to each sparkline for screen readers", () => {
    const { container } = render(<Stats7dSparklines stats_7d={makeStats()} />);
    const svgs = Array.from(container.querySelectorAll("svg"));
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-label")).toMatch(/sparkline/);
    }
  });

  it("handles empty arrays gracefully (no crash, cells still render)", () => {
    const stats = makeStats({
      tokens_per_hour: [],
      success_history: [],
      wall_history: [],
    });
    render(<Stats7dSparklines stats_7d={stats} />);
    expect(screen.getByTestId("sparkline-invocations")).toBeInTheDocument();
    expect(screen.getByTestId("sparkline-success")).toBeInTheDocument();
    expect(screen.getByTestId("sparkline-tokens")).toBeInTheDocument();
  });
});
