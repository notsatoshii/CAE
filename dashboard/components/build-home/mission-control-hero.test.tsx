/**
 * MissionControlHero tests (Phase 15 Wave 3.1).
 *
 * Coverage:
 *   1. Loading state -> aria-busy + heading present.
 *   2. Active count tile renders the count.
 *   3. Token burn tile renders the bar + per-minute label.
 *   4. Cost radial renders the percent.
 *   5. Sparkline tile renders.
 *   6. Since-you-left tile shows ONLY when syl.show=true.
 *   7. Empty-state placeholders render when their slot is zero (active=0).
 *   8. All tiles are wrapped in <a> with href and an aria-label.
 *   9. Heading text is "Mission Control".
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import type { MissionControlState } from "@/lib/cae-mission-control-state";
import { emptyMissionControl } from "@/lib/cae-mission-control-state";

afterEach(() => cleanup());

// next/link -> plain anchor so testing-library can find role=link.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children?: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { MissionControlHero } from "./mission-control-hero";

function makeState(over: Partial<MissionControlState> = {}): MissionControlState {
  return {
    ...emptyMissionControl(Date.parse("2026-04-23T12:00:00Z")),
    ...over,
  };
}

describe("MissionControlHero", () => {
  it("1. loading state: aria-busy + heading", () => {
    render(<MissionControlHero disablePolling />);
    const root = screen.getByTestId("mission-control-hero");
    expect(root.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("heading", { name: /mission control/i })).toBeInTheDocument();
  });

  it("2. active-count tile renders the count", () => {
    const data = makeState({ active_count: 4, last_event_at: Date.now() });
    render(<MissionControlHero initialData={data} disablePolling />);
    const tile = screen.getByTestId("mc-tile-active");
    // The animated number eventually renders the value; on first render the
    // initial state of useState is set to value.toString(), so "4" is present.
    expect(tile.textContent).toMatch(/4/);
    expect(tile.textContent).toMatch(/agents working/i);
  });

  it("3. token burn tile renders the bar + per-minute label", () => {
    const data = makeState({ token_burn_usd_per_min: 0.42, cost_today_usd: 5, daily_budget_usd: 50 });
    render(<MissionControlHero initialData={data} disablePolling />);
    expect(screen.getByTestId("mc-token-burn-bar")).toBeInTheDocument();
    expect(screen.getByTestId("mc-burn-fill")).toBeInTheDocument();
    const tile = screen.getByTestId("mc-tile-burn");
    expect(tile.textContent).toMatch(/\/min/);
  });

  it("4. cost radial tile renders the percent + svg", () => {
    const data = makeState({
      cost_today_usd: 25,
      daily_budget_usd: 50,
      cost_pct_of_budget: 0.5,
    });
    render(<MissionControlHero initialData={data} disablePolling />);
    const radial = screen.getByTestId("mc-cost-radial");
    expect(radial).toBeInTheDocument();
    expect(radial.textContent).toMatch(/50%/);
  });

  it("5. sparkline tile renders the SVG", () => {
    const sparkline = Array.from({ length: 60 }, (_, i) => ({ ts: i * 1000, count: i % 3 }));
    const data = makeState({ sparkline_60s: sparkline });
    render(<MissionControlHero initialData={data} disablePolling />);
    expect(screen.getByTestId("mc-sparkline-60s")).toBeInTheDocument();
  });

  it("6a. since-you-left tile is hidden when show=false", () => {
    const data = makeState();
    render(<MissionControlHero initialData={data} disablePolling />);
    expect(screen.queryByTestId("mc-tile-since")).not.toBeInTheDocument();
  });

  it("6b. since-you-left tile renders when show=true", () => {
    const data = makeState({
      since_you_left: {
        show: true,
        last_seen_at: Date.now() - 2 * 60 * 60 * 1000,
        tool_calls_since: 12,
        usd_since: 1.5,
        tasks_touched: 3,
      },
    });
    render(<MissionControlHero initialData={data} disablePolling />);
    const tile = screen.getByTestId("mc-tile-since");
    expect(tile).toBeInTheDocument();
    expect(tile.textContent).toMatch(/3 tasks/);
    expect(tile.textContent).toMatch(/12 tool calls/);
  });

  it("7. empty-state placeholder renders when active_count=0", () => {
    const data = makeState({ active_count: 0 });
    render(<MissionControlHero initialData={data} disablePolling />);
    const empty = screen.getByTestId("mc-tile-active-empty");
    expect(empty).toBeInTheDocument();
    expect(empty.textContent).toMatch(/picks up work/i);
  });

  it("8. all tiles are anchors with hrefs + aria-labels", () => {
    const data = makeState({ active_count: 1 });
    render(<MissionControlHero initialData={data} disablePolling />);
    for (const id of ["mc-tile-active", "mc-tile-burn", "mc-tile-cost", "mc-tile-sparkline"]) {
      const tile = screen.getByTestId(id);
      expect(tile.tagName.toLowerCase()).toBe("a");
      expect(tile.getAttribute("href")).toBeTruthy();
      expect(tile.getAttribute("aria-label")).toBeTruthy();
    }
  });

  it("9. heading text is 'Mission Control'", () => {
    render(<MissionControlHero disablePolling />);
    expect(screen.getByRole("heading", { name: /mission control/i })).toBeInTheDocument();
  });
});
