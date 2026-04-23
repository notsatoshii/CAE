/**
 * Tests for GET /api/activity/live.
 *
 * Coverage:
 *   1. Returns 200 + correct shape on happy path.
 *   2. Returns 401 when unauthenticated.
 *   3. Returns 200 zero-shape (not 500) when getLiveActivity throws.
 *   4. Sets the 5-second Cache-Control header.
 *   5. Shape matches LiveActivity exactly (no surprise fields, all required keys present).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { name: "test" } })),
}))

vi.mock("@/lib/with-log", () => ({
  withLog: (handler: (...args: unknown[]) => unknown) => handler,
}))

vi.mock("@/lib/cae-activity-state", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cae-activity-state")>(
    "@/lib/cae-activity-state",
  )
  return {
    ...actual,
    getLiveActivity: vi.fn(),
  }
})

import { GET } from "./route"
import { auth } from "@/auth"
import { emptyActivity, getLiveActivity } from "@/lib/cae-activity-state"

// `auth` from NextAuth is overloaded with several signatures; the test only
// needs the session-getter shape, so cast through unknown for type sanity.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAuth = auth as unknown as { mockResolvedValue: (v: any) => void }
const mockGetLiveActivity = vi.mocked(getLiveActivity)

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { name: "test" } })
})

function makeReq(): Request {
  return new Request("http://localhost/api/activity/live")
}

describe("GET /api/activity/live", () => {
  it("returns 200 + correct shape on happy path", async () => {
    const fixture = {
      tools_per_min_now: 7,
      most_frequent_tool: "Bash",
      last_24h_count: 142,
      sparkline: Array.from({ length: 30 }, (_, i) => ({
        ts: 1700000000000 + i * 60_000,
        count: i,
      })),
      tool_breakdown_5m: { Bash: 12, Edit: 4 },
      last_event_at: 1700000000000,
    }
    mockGetLiveActivity.mockResolvedValue(fixture)

    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(fixture)
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    mockGetLiveActivity.mockResolvedValue(emptyActivity())
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it("returns 200 zero-shape when getLiveActivity throws", async () => {
    mockGetLiveActivity.mockRejectedValue(new Error("boom"))
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tools_per_min_now).toBe(0)
    expect(body.most_frequent_tool).toBeNull()
    expect(body.last_24h_count).toBe(0)
    expect(body.last_event_at).toBeNull()
    expect(body.sparkline).toHaveLength(30)
  })

  it("sets the 5-second Cache-Control header", async () => {
    mockGetLiveActivity.mockResolvedValue(emptyActivity())
    const res = await GET(makeReq())
    expect(res.headers.get("cache-control")).toMatch(/max-age=5/)
  })

  it("shape contains all required LiveActivity keys", async () => {
    mockGetLiveActivity.mockResolvedValue(emptyActivity())
    const res = await GET(makeReq())
    const body = await res.json()
    for (const key of [
      "tools_per_min_now",
      "most_frequent_tool",
      "last_24h_count",
      "sparkline",
      "tool_breakdown_5m",
      "last_event_at",
    ]) {
      expect(body).toHaveProperty(key)
    }
  })
})
