import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/cae-schedule-parse", () => ({
  parseSchedule: vi.fn(),
}))
vi.mock("@/lib/cae-schedule-describe", () => ({
  describeCron: vi.fn(),
}))

describe("POST /api/schedule/parse", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("Test 1: returns parsed cron + english + nextRun for valid NL", async () => {
    const { parseSchedule } = await import("@/lib/cae-schedule-parse")
    const { describeCron } = await import("@/lib/cae-schedule-describe")
    vi.mocked(parseSchedule).mockResolvedValue({
      cron: "0 9 * * *",
      source: "rule",
      confidence: "high",
    })
    vi.mocked(describeCron).mockReturnValue({
      english: "At 09:00 AM",
      nextRun: new Date("2026-04-23T13:00:00.000Z"),
    })

    const { POST } = await import("./route")
    const req = new NextRequest("http://localhost/api/schedule/parse", {
      method: "POST",
      body: JSON.stringify({ nl: "every morning at 9am", timezone: "America/New_York" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cron).toBe("0 9 * * *")
    expect(body.source).toBe("rule")
    expect(body.english).toBe("At 09:00 AM")
    expect(body.nextRun).toBe("2026-04-23T13:00:00.000Z")
  })

  it("Test 2: returns 400 when nl is missing", async () => {
    const { POST } = await import("./route")
    const req = new NextRequest("http://localhost/api/schedule/parse", {
      method: "POST",
      body: JSON.stringify({ timezone: "UTC" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("Test 2b: returns 400 when nl is empty string", async () => {
    const { POST } = await import("./route")
    const req = new NextRequest("http://localhost/api/schedule/parse", {
      method: "POST",
      body: JSON.stringify({ nl: "  ", timezone: "UTC" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("Test 3: rate limit — 11th request in window returns 429", async () => {
    const { POST } = await import("./route")
    const { parseSchedule } = await import("@/lib/cae-schedule-parse")
    const { describeCron } = await import("@/lib/cae-schedule-describe")
    vi.mocked(parseSchedule).mockResolvedValue({ cron: "0 9 * * *", source: "rule", confidence: "high" })
    vi.mocked(describeCron).mockReturnValue({ english: "At 09:00 AM", nextRun: new Date() })

    // Use a unique IP for this test to avoid state pollution from other tests
    const makeReq = () =>
      new NextRequest("http://localhost/api/schedule/parse", {
        method: "POST",
        body: JSON.stringify({ nl: "every hour", timezone: "UTC" }),
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.0.0.99",
        },
      })

    // First 10 should succeed
    for (let i = 0; i < 10; i++) {
      const res = await POST(makeReq())
      expect(res.status).not.toBe(429)
    }
    // 11th should be rate-limited
    const res = await POST(makeReq())
    expect(res.status).toBe(429)
  })

  it("Test 4: returns 422 when parse throws", async () => {
    const { parseSchedule } = await import("@/lib/cae-schedule-parse")
    vi.mocked(parseSchedule).mockRejectedValue(new Error('Could not parse: "bad input"'))

    const { POST } = await import("./route")
    const req = new NextRequest("http://localhost/api/schedule/parse", {
      method: "POST",
      body: JSON.stringify({ nl: "bad input", timezone: "UTC" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
  })
})
