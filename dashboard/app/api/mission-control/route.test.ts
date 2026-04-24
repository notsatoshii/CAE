/**
 * Tests for GET /api/mission-control (Phase 15 Wave 3.1).
 *
 * Coverage:
 *   1. 200 + correct shape on happy path.
 *   2. 401 when unauthenticated.
 *   3. 200 zero-shape (not 500) when getMissionControlState throws.
 *   4. Sets the 5-second Cache-Control header.
 *   5. Shape contains all required (tokens-only) keys.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { name: "test" } })),
}))

vi.mock("@/lib/with-log", () => ({
  withLog: (handler: (...args: unknown[]) => unknown) => handler,
}))

vi.mock("@/lib/cae-mission-control-state", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cae-mission-control-state")>(
    "@/lib/cae-mission-control-state",
  )
  return {
    ...actual,
    getMissionControlState: vi.fn(),
  }
})

import { GET } from "./route"
import { auth } from "@/auth"
import {
  emptyMissionControl,
  getMissionControlState,
} from "@/lib/cae-mission-control-state"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAuth = auth as unknown as { mockResolvedValue: (v: any) => void }
const mockGetMc = vi.mocked(getMissionControlState)

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { name: "test" } })
})

function makeReq(): Request {
  return new Request("http://localhost/api/mission-control")
}

describe("GET /api/mission-control", () => {
  it("returns 200 + correct shape on happy path", async () => {
    const fixture = emptyMissionControl(Date.parse("2026-04-23T12:00:00Z"))
    fixture.active_count = 4
    fixture.tokens_today = 1_234_000
    mockGetMc.mockResolvedValue(fixture)

    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.active_count).toBe(4)
    expect(body.tokens_today).toBe(1_234_000)
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    mockGetMc.mockResolvedValue(emptyMissionControl())
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it("returns 200 zero-shape when aggregator throws", async () => {
    mockGetMc.mockRejectedValue(new Error("boom"))
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.active_count).toBe(0)
    expect(body.tokens_today).toBe(0)
    expect(body.tokens_burn_per_min).toBe(0)
    expect(body.sparkline_60s).toHaveLength(60)
  })

  it("sets the 5-second Cache-Control header", async () => {
    mockGetMc.mockResolvedValue(emptyMissionControl())
    const res = await GET(makeReq())
    expect(res.headers.get("cache-control")).toMatch(/max-age=5/)
  })

  it("shape contains all required (tokens-only) keys", async () => {
    mockGetMc.mockResolvedValue(emptyMissionControl())
    const res = await GET(makeReq())
    const body = await res.json()
    for (const key of [
      "active_count",
      "tokens_burn_per_min",
      "tokens_today",
      "sparkline_60s",
      "since_you_left",
      "last_event_at",
      "generated_at",
    ]) {
      expect(body).toHaveProperty(key)
    }
    // USD fields are gone from the contract.
    for (const key of [
      "token_burn_usd_per_min",
      "cost_today_usd",
      "daily_budget_usd",
      "cost_pct_of_budget",
    ]) {
      expect(body).not.toHaveProperty(key)
    }
    expect(body.since_you_left).toHaveProperty("tokens_since")
    expect(body.since_you_left).not.toHaveProperty("usd_since")
  })
})
