/**
 * LiveActivityPanel tests.
 *
 * Coverage:
 *   1. Loading state — skeleton tiles render before first fetch resolves.
 *   2. Renders 3 tiles + sparkline + breakdown when data is provided.
 *   3. Empty state copy when last_24h_count=0.
 *   4. Status dot is "active" iff last_event_at is within 30s.
 *   5. tools_per_min_now value is rendered.
 *   6. Tool breakdown legend lists kinds with non-zero count.
 */

import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { LiveActivityPanel } from "./live-activity-panel"
import type { LiveActivity } from "@/lib/cae-activity-state"

afterEach(() => cleanup())

function makeActivity(over: Partial<LiveActivity> = {}): LiveActivity {
  const sparkline = Array.from({ length: 30 }, (_, i) => ({
    ts: 1700000000000 + i * 60_000,
    count: 0,
  }))
  return {
    tools_per_min_now: 0,
    most_frequent_tool: null,
    last_24h_count: 0,
    sparkline,
    tool_breakdown_5m: {},
    last_event_at: null,
    ...over,
  }
}

describe("LiveActivityPanel", () => {
  it("1. renders skeleton tiles in loading state", () => {
    render(<LiveActivityPanel disablePolling />)
    const skeletons = screen.getAllByTestId("activity-skeleton-tile")
    expect(skeletons).toHaveLength(3)
  })

  it("2. renders all 3 tiles + sparkline + breakdown when given data", () => {
    const data = makeActivity({
      tools_per_min_now: 7,
      most_frequent_tool: "Bash",
      last_24h_count: 142,
      tool_breakdown_5m: { Bash: 12, Edit: 4 },
      last_event_at: Date.now(),
    })
    render(<LiveActivityPanel initialData={data} disablePolling />)

    expect(screen.getByTestId("activity-tile-tools-per-min")).toBeInTheDocument()
    expect(screen.getByTestId("activity-tile-active-stream")).toBeInTheDocument()
    expect(screen.getByTestId("activity-tile-last-24h")).toBeInTheDocument()
    expect(screen.getByTestId("activity-sparkline")).toBeInTheDocument()
    expect(screen.getByTestId("tool-breakdown")).toBeInTheDocument()
  })

  it("3. shows empty-state tip when last_24h_count=0", () => {
    render(<LiveActivityPanel initialData={makeActivity()} disablePolling />)
    const tip = screen.getByTestId("activity-empty-tip")
    expect(tip).toBeInTheDocument()
    expect(tip.textContent).toMatch(/audit-hook/i)
    expect(tip.textContent).toMatch(/Bash/)
  })

  it("3b. omits empty tip when there is activity", () => {
    const data = makeActivity({
      last_24h_count: 5,
      tools_per_min_now: 1,
      most_frequent_tool: "Bash",
      last_event_at: Date.now(),
    })
    render(<LiveActivityPanel initialData={data} disablePolling />)
    expect(screen.queryByTestId("activity-empty-tip")).not.toBeInTheDocument()
  })

  it("4. status dot reads 'active' when last_event_at within 30s", () => {
    const data = makeActivity({ last_event_at: Date.now() - 5_000 })
    render(<LiveActivityPanel initialData={data} disablePolling />)
    const dot = screen.getByTestId("live-activity-status-dot")
    expect(dot.getAttribute("data-active")).toBe("true")
  })

  it("4b. status dot reads 'idle' when last_event_at older than 30s", () => {
    const data = makeActivity({ last_event_at: Date.now() - 60_000 })
    render(<LiveActivityPanel initialData={data} disablePolling />)
    const dot = screen.getByTestId("live-activity-status-dot")
    expect(dot.getAttribute("data-active")).toBe("false")
  })

  it("4c. status dot reads 'idle' when last_event_at is null", () => {
    render(<LiveActivityPanel initialData={makeActivity()} disablePolling />)
    const dot = screen.getByTestId("live-activity-status-dot")
    expect(dot.getAttribute("data-active")).toBe("false")
  })

  it("5. tools_per_min_now is rendered inside its tile", () => {
    const data = makeActivity({
      tools_per_min_now: 23,
      last_24h_count: 100,
      most_frequent_tool: "Edit",
      last_event_at: Date.now(),
    })
    render(<LiveActivityPanel initialData={data} disablePolling />)
    const tile = screen.getByTestId("activity-tile-tools-per-min")
    expect(tile.textContent).toMatch(/23/)
  })

  it("5b. active-stream tile shows 'Idle' when most_frequent_tool is null", () => {
    render(<LiveActivityPanel initialData={makeActivity()} disablePolling />)
    const tile = screen.getByTestId("activity-tile-active-stream")
    expect(tile.textContent).toMatch(/Idle/)
  })

  it("6. legend shows only tools with non-zero count", () => {
    const data = makeActivity({
      last_24h_count: 16,
      most_frequent_tool: "Bash",
      tool_breakdown_5m: { Bash: 12, Read: 4 },
      last_event_at: Date.now(),
    })
    render(<LiveActivityPanel initialData={data} disablePolling />)
    expect(screen.getByTestId("legend-item-Bash")).toBeInTheDocument()
    expect(screen.getByTestId("legend-item-Read")).toBeInTheDocument()
    expect(screen.queryByTestId("legend-item-Edit")).not.toBeInTheDocument()
    expect(screen.queryByTestId("legend-item-Write")).not.toBeInTheDocument()
  })

  it("6b. heading is 'Live activity'", () => {
    render(<LiveActivityPanel initialData={makeActivity()} disablePolling />)
    expect(screen.getByRole("heading", { name: /live activity/i })).toBeInTheDocument()
  })
})
