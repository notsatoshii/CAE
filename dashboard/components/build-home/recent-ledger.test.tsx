/**
 * RecentLedger tests — P15 detail-expand fix.
 *
 * Eric's audit (#11) flagged that ledger rows looked clickable but did
 * nothing. Fix wires each row through to the TaskDetailSheet via the same
 * URL-state contract the QueueCard + ActivePhaseCards use:
 *   ?sheet=open&phase={n}&project={path}&plan={planId}&task={planId}
 *
 * Assertions:
 *   1. Empty state renders the "nothing yet" copy without rows.
 *   2. Each row is a real `<button>` (clickable, focusable, keyboard-OK).
 *   3. Clicking a row pushes the expected URL params (phase, project, plan).
 *   4. Phase number falls back to the leading task-id segment if
 *      `phase` is the empty string (a real edge case for legacy events).
 *   5. Each row exposes an aria-label that includes status + agent + plan
 *      so screen-reader users know the click target's purpose.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RecentLedger } from "./recent-ledger";
import { DevModeProvider } from "@/lib/providers/dev-mode";
import type { RecentEvent } from "@/lib/cae-home-state";
import type { StateResponse } from "@/lib/hooks/use-state-poll";

afterEach(() => {
  cleanup();
});

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({ toString: () => "", get: () => null }),
  usePathname: () => "/build",
}));

let mockState: StateResponse | null = null;

vi.mock("@/lib/hooks/use-state-poll", () => ({
  useStatePoll: () => ({ data: mockState, error: null, lastUpdated: Date.now() }),
}));

function makeEvent(over: Partial<RecentEvent> = {}): RecentEvent {
  return {
    ts: "2026-04-23T14:32:01Z",
    project: "/home/cae/ctrl-alt-elite",
    projectName: "ctrl-alt-elite",
    phase: "p4",
    plan: "p4-pl01-t1",
    status: "shipped",
    commits: 8,
    agent: "forge",
    model: "claude-sonnet-4-6",
    tokens: 12_345,
    ...over,
  };
}

function renderLedger() {
  return render(
    <DevModeProvider>
      <RecentLedger />
    </DevModeProvider>,
  );
}

function setEvents(events: RecentEvent[]) {
  if (events.length === 0) {
    mockState = null;
    return;
  }
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
    home_phases: [],
    events_recent: events,
    needs_you: [],
    live_ops_line: "",
  };
}

describe("RecentLedger", () => {
  afterEach(() => {
    pushMock.mockClear();
    mockState = null;
  });

  it("renders the empty state when no events are present", () => {
    setEvents([]);
    renderLedger();
    expect(screen.getByText(/nothing shipped yet|no events logged/i)).toBeInTheDocument();
    expect(screen.queryByTestId("recent-row-0")).toBeNull();
  });

  it("renders each event as a button (clickable + focusable)", () => {
    setEvents([makeEvent(), makeEvent({ plan: "p4-pl01-t2", status: "aborted" })]);
    renderLedger();
    const row0 = screen.getByTestId("recent-row-0");
    const row1 = screen.getByTestId("recent-row-1");
    expect(row0.tagName).toBe("BUTTON");
    expect(row1.tagName).toBe("BUTTON");
    expect(row0).toHaveAttribute("type", "button");
  });

  it("opens TaskDetailSheet via URL params when a row is clicked", () => {
    setEvents([makeEvent()]);
    renderLedger();
    fireEvent.click(screen.getByTestId("recent-row-0"));
    expect(pushMock).toHaveBeenCalledTimes(1);
    const url = pushMock.mock.calls[0][0] as string;
    expect(url).toMatch(/^\/build\?/);
    expect(url).toContain("sheet=open");
    expect(url).toContain("phase=4");
    expect(url).toContain("project=" + encodeURIComponent("/home/cae/ctrl-alt-elite"));
    expect(url).toContain("plan=" + encodeURIComponent("p4-pl01-t1"));
    expect(url).toContain("task=" + encodeURIComponent("p4-pl01-t1"));
  });

  it("derives phase number from the plan id when the phase label is missing", () => {
    setEvents([makeEvent({ phase: "", plan: "p9-plA-t3" })]);
    renderLedger();
    fireEvent.click(screen.getByTestId("recent-row-0"));
    const url = pushMock.mock.calls[0][0] as string;
    expect(url).toContain("phase=9");
  });

  it("exposes an aria-label that names status + plan + agent", () => {
    setEvents([makeEvent({ agent: "forge", plan: "p4-pl01-t1", status: "shipped" })]);
    renderLedger();
    const row = screen.getByTestId("recent-row-0");
    const label = row.getAttribute("aria-label") ?? "";
    expect(label).toMatch(/shipped/);
    expect(label).toContain("p4-pl01-t1");
    expect(label).toMatch(/builder|forge/);
  });
});
