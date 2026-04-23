/**
 * /api/state route.test.ts — Class 15A.
 *
 * Scope: verify the `recent_activity` field lands in the response, bounded
 * at ≤20 rows, and a failing getActivityFeed doesn't crash the handler.
 *
 * The rest of /api/state's surface is covered by Phase 7 fixtures — we only
 * add incremental coverage for the Class 15A extension here.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ActivityFeedRow } from "@/lib/cae-activity-feed"

// Mock auth to bypass middleware.
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { name: "test" } })),
}))

// Pass-through for the logger wrapper.
vi.mock("@/lib/with-log", () => ({
  withLog: (handler: (...args: unknown[]) => unknown) => handler,
}))

// All external data sources mocked — tests only care about the shape the
// route assembles, not the correctness of the sources themselves.
vi.mock("@/lib/cae-state", () => ({
  getCircuitBreakerState: vi.fn(async () => ({
    activeForgeCount: 0,
    activeTaskIds: [],
    recentFailures: 0,
    recentPhantomEscalations: 0,
    halted: false,
  })),
  listInbox: vi.fn(async () => []),
  listOutbox: vi.fn(async () => []),
  listPhases: vi.fn(async () => []),
  tailJsonl: vi.fn(async () => []),
}))

vi.mock("@/lib/cae-home-state", () => ({
  getHomeState: vi.fn(async () => ({
    rollup: { shipped_today: 0, tokens_today: 0, in_flight: 0, blocked: 0, warnings: 0 },
    phases: [],
    events_recent: [],
    needs_you: [],
    live_ops_line: "Idle right now.",
  })),
}))

const getActivityFeedMock = vi.fn(async (): Promise<ActivityFeedRow[]> => [])
vi.mock("@/lib/cae-activity-feed", () => ({
  getActivityFeed: () => getActivityFeedMock(),
}))

import { NextRequest } from "next/server"
import { GET } from "./route"

function makeReq(url = "http://localhost/api/state"): NextRequest {
  return new NextRequest(url, { method: "GET" })
}

beforeEach(() => {
  getActivityFeedMock.mockReset()
  getActivityFeedMock.mockResolvedValue([])
})

describe("/api/state recent_activity (Class 15A)", () => {
  it("includes recent_activity in the response, defaulting to []", async () => {
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.recent_activity)).toBe(true)
    expect(body.recent_activity).toEqual([])
  })

  it("caps recent_activity at 20 rows even when the feed returns more", async () => {
    const rows: ActivityFeedRow[] = Array.from({ length: 100 }, (_, i) => ({
      ts: new Date(Date.UTC(2026, 3, 23, 12, 0, i)).toISOString(),
      type: "other",
      source: "test",
      summary: `row-${i}`,
      origin: "activity",
    }))
    getActivityFeedMock.mockResolvedValue(rows)

    const res = await GET(makeReq())
    const body = await res.json()
    expect(body.recent_activity).toHaveLength(20)
    // Feed is already ts-DESC sorted by getActivityFeed; we just slice — so
    // the first row here matches the first row the mock returned.
    expect(body.recent_activity[0].summary).toBe("row-0")
  })

  it("returns [] for recent_activity when getActivityFeed throws", async () => {
    getActivityFeedMock.mockRejectedValueOnce(new Error("fs blew up"))
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recent_activity).toEqual([])
  })
})
