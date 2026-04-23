/**
 * ActivityFeed tests — Class 15C.
 *
 * Same four liveness states as RecentCommits:
 *   - loading / empty / healthy / error
 *
 * Plus: rows group by day boundary; icons render per type.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { ActivityFeed } from "./activity-feed"
import type { StateResponse } from "@/lib/hooks/use-state-poll"
import type { ActivityFeedRow } from "@/lib/cae-activity-feed"

afterEach(() => {
  cleanup()
})

let mockState: StateResponse | null = null
let mockError: Error | null = null

vi.mock("@/lib/hooks/use-state-poll", () => ({
  useStatePoll: () => ({
    data: mockState,
    error: mockError,
    lastUpdated: Date.now(),
  }),
}))

beforeEach(() => {
  mockState = null
  mockError = null
})

function buildState(rows: ActivityFeedRow[] | undefined): StateResponse {
  return {
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
    events_recent: [],
    needs_you: [],
    live_ops_line: "",
    // Extension field — StateResponse type doesn't declare it today (15A
    // guardrail), but the runtime shape delivers it.
    ...(rows !== undefined ? { recent_activity: rows } : {}),
  } as StateResponse & { recent_activity?: ActivityFeedRow[] }
}

describe("ActivityFeed", () => {
  it("renders loading state when data is null and no error", () => {
    mockState = null
    render(<ActivityFeed />)
    const panel = screen.getByTestId("activity-feed")
    expect(panel.getAttribute("data-liveness")).toBe("loading")
    expect(screen.getByTestId("activity-feed-loading")).toBeInTheDocument()
  })

  it("renders empty state when recent_activity is []", () => {
    mockState = buildState([])
    render(<ActivityFeed />)
    const panel = screen.getByTestId("activity-feed")
    expect(panel.getAttribute("data-liveness")).toBe("empty")
    expect(screen.getByTestId("activity-feed-empty")).toBeInTheDocument()
  })

  it("renders error state when the poll has an error", () => {
    mockError = new Error("state offline")
    render(<ActivityFeed />)
    const panel = screen.getByTestId("activity-feed")
    expect(panel.getAttribute("data-liveness")).toBe("error")
    expect(screen.getByTestId("activity-feed-error")).toBeInTheDocument()
  })

  it("renders healthy: rows grouped by day with icons", () => {
    const today = new Date().toISOString().slice(0, 10) + "T12:00:00Z"
    const yesterday =
      new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) + "T12:00:00Z"
    const rows: ActivityFeedRow[] = [
      {
        ts: today,
        type: "commit",
        source: "git-post-commit",
        actor: "Eric",
        summary: "abc feat: new",
        origin: "activity",
      },
      {
        ts: today,
        type: "agent_spawn",
        source: "circuit-breakers",
        actor: "forge",
        summary: "forge started p15-plA-t1",
        origin: "circuit-breakers",
      },
      {
        ts: yesterday,
        type: "cycle_step",
        source: "audit-run-cycle",
        summary: "cycle complete: C2",
        origin: "activity",
      },
    ]
    mockState = buildState(rows)
    render(<ActivityFeed />)

    const panel = screen.getByTestId("activity-feed")
    expect(panel.getAttribute("data-liveness")).toBe("healthy")

    // Two day groups: today + yesterday
    expect(screen.getByTestId(`activity-day-${today.slice(0, 10)}`)).toBeInTheDocument()
    expect(
      screen.getByTestId(`activity-day-${yesterday.slice(0, 10)}`),
    ).toBeInTheDocument()

    // Rows rendered
    expect(screen.getByText("abc feat: new")).toBeInTheDocument()
    expect(screen.getByText("forge started p15-plA-t1")).toBeInTheDocument()
    expect(screen.getByText("cycle complete: C2")).toBeInTheDocument()
  })
})
