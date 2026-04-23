import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { ScheduledTask } from "@/lib/cae-types"

// Mock next-auth and @/auth so route handlers don't pull in the NextAuth runtime
vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() }),
}))
vi.mock("next-auth/providers/github", () => ({ default: {} }))
vi.mock("next-auth/providers/google", () => ({
  default: (_opts?: unknown) => ({ id: "google", type: "oauth" }),
}))
// Default: operator session so existing tests pass the role gate
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { email: "test@example.com", role: "operator" },
    expires: "2099-01-01",
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}))

vi.mock("@/lib/cae-schedule-store", () => ({
  readTasks: vi.fn(),
  writeTask: vi.fn(),
}))
vi.mock("@/lib/cae-schedule-parse", () => ({
  parseSchedule: vi.fn(),
}))

const SAMPLE_TASK: ScheduledTask = {
  id: "morning-brief",
  nl: "every morning at 9am",
  cron: "0 9 * * *",
  timezone: "America/New_York",
  buildplan: "/home/cae/ctrl-alt-elite/tasks/morning-brief.md",
  enabled: true,
  lastRun: 0,
  createdAt: 1714000000,
  createdBy: "test@test.com",
}

describe("GET /api/schedule", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("Test 3: returns task list", async () => {
    const { readTasks } = await import("@/lib/cae-schedule-store")
    vi.mocked(readTasks).mockResolvedValue([SAMPLE_TASK])

    const { GET } = await import("./route")
    const req = new NextRequest("http://localhost/api/schedule")
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe("morning-brief")
  })
})

describe("POST /api/schedule", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("Test 3b: creates task and returns 201", async () => {
    const { readTasks, writeTask } = await import("@/lib/cae-schedule-store")
    const { parseSchedule } = await import("@/lib/cae-schedule-parse")
    vi.mocked(readTasks).mockResolvedValue([])
    vi.mocked(writeTask).mockResolvedValue(undefined)
    vi.mocked(parseSchedule).mockResolvedValue({
      cron: "0 9 * * *",
      source: "rule",
      confidence: "high",
    })

    const { POST } = await import("./route")
    const caeRoot = process.env.CAE_ROOT ?? "/home/cae/ctrl-alt-elite"
    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({
        nl: "every morning at 9am",
        timezone: "America/New_York",
        buildplan: `${caeRoot}/tasks/plan.md`,
      }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeTruthy()
    expect(body.cron).toBe("0 9 * * *")
  })

  it("Test 3c: returns 400 when nl is missing", async () => {
    const { POST } = await import("./route")
    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({ timezone: "UTC", buildplan: "/home/cae/ctrl-alt-elite/tasks/plan.md" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("Test 3d: returns 400 when buildplan path is outside CAE_ROOT (path traversal)", async () => {
    const { POST } = await import("./route")
    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({
        nl: "every hour",
        timezone: "UTC",
        buildplan: "/etc/passwd",
      }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
