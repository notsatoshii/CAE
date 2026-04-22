import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { ScheduledTask } from "@/lib/cae-types"

vi.mock("@/lib/cae-schedule-store", () => ({
  toggleTask: vi.fn(),
  deleteTask: vi.fn(),
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

describe("PATCH /api/schedule/[id]", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("Test 4: toggles enabled to false", async () => {
    const { toggleTask } = await import("@/lib/cae-schedule-store")
    vi.mocked(toggleTask).mockResolvedValue(undefined)

    const { PATCH } = await import("./route")
    const req = new NextRequest("http://localhost/api/schedule/morning-brief", {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "morning-brief" }) })

    expect(res.status).toBe(200)
    expect(toggleTask).toHaveBeenCalledWith("morning-brief", false)
  })

  it("Test 4b: returns 400 for invalid id (path injection)", async () => {
    const { PATCH } = await import("./route")
    const req = new NextRequest("http://localhost/api/schedule/../etc/passwd", {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "../etc/passwd" }) })
    expect(res.status).toBe(400)
  })
})

describe("DELETE /api/schedule/[id]", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("Test 4c: deletes task by id", async () => {
    const { deleteTask } = await import("@/lib/cae-schedule-store")
    vi.mocked(deleteTask).mockResolvedValue(undefined)

    const { DELETE } = await import("./route")
    const req = new NextRequest("http://localhost/api/schedule/morning-brief", {
      method: "DELETE",
    })
    const res = await DELETE(req, { params: Promise.resolve({ id: "morning-brief" }) })

    expect(res.status).toBe(200)
    expect(deleteTask).toHaveBeenCalledWith("morning-brief")
  })
})
