/**
 * Defense-in-depth role checks for hardened routes
 * Phase 14 Plan 04 — Task 2, Test 8
 *
 * Tests that route handlers themselves reject insufficient roles,
 * independent of middleware (defense-in-depth per STRIDE T-14-04-03).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { Role } from "@/lib/cae-types"

// ── Mock next-auth ──────────────────────────────────────────────────────────
const mockAuthSession = vi.fn()
vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() }),
}))
vi.mock("next-auth/providers/github", () => ({ default: {} }))
vi.mock("next-auth/providers/google", () => ({
  default: (_opts?: unknown) => ({ id: "google", type: "oauth" }),
}))
vi.mock("@/auth", () => ({
  auth: mockAuthSession,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}))

// ── Mock lib dependencies to avoid filesystem hits ──────────────────────────
vi.mock("@/lib/cae-schedule-store", () => ({
  readTasks: vi.fn().mockResolvedValue([]),
  writeTask: vi.fn().mockResolvedValue(undefined),
  toggleTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/cae-schedule-parse", () => ({
  parseSchedule: vi.fn().mockResolvedValue({ cron: "0 9 * * *", confidence: "high" }),
}))
vi.mock("@/lib/cae-skills-install", () => ({
  installSkill: vi.fn().mockReturnValue((async function* () { yield { type: "done", data: "0" } })()),
}))
vi.mock("@/lib/cae-workflows", () => ({
  getWorkflow: vi.fn().mockResolvedValue(null),
}))
vi.mock("@/lib/with-log", () => ({
  withLog: (fn: unknown) => fn,
}))
vi.mock("@/lib/log", () => ({
  log: () => ({ error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}))

function makeSession(role: Role | null) {
  if (!role) return null
  return { user: { email: "test@example.com", role }, expires: "2099-01-01" }
}

function makeReq(url: string, method: string, body?: unknown): NextRequest {
  const init: RequestInit & { signal?: AbortSignal } = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { "Content-Type": "application/json" }
  }
  return new NextRequest(`http://localhost:3000${url}`, init as ConstructorParameters<typeof NextRequest>[1])
}

describe("POST /api/skills/install — defense-in-depth role check", () => {
  beforeEach(() => { vi.resetModules() })

  it("Test 8a: viewer session → 403", async () => {
    mockAuthSession.mockResolvedValue(makeSession("viewer"))
    const { POST } = await import("@/app/api/skills/install/route")
    const req = makeReq("/api/skills/install", "POST", { repo: "owner/skill" })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it("operator session → proceeds (not 403)", async () => {
    mockAuthSession.mockResolvedValue(makeSession("operator"))
    const { POST } = await import("@/app/api/skills/install/route")
    const req = makeReq("/api/skills/install", "POST", { repo: "owner/skill" })
    const res = await POST(req)
    // 200 or SSE stream start — not 403
    expect(res.status).not.toBe(403)
  })
})

describe("POST /api/schedule — defense-in-depth role check", () => {
  beforeEach(() => { vi.resetModules() })

  it("viewer session → 403", async () => {
    mockAuthSession.mockResolvedValue(makeSession("viewer"))
    const { POST } = await import("@/app/api/schedule/route")
    const req = makeReq("/api/schedule", "POST", {
      nl: "every morning at 9am",
      buildplan: "/home/cae/ctrl-alt-elite/test.md",
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it("operator session → proceeds past RBAC check", async () => {
    mockAuthSession.mockResolvedValue(makeSession("operator"))
    const { POST } = await import("@/app/api/schedule/route")
    const req = makeReq("/api/schedule", "POST", {
      nl: "every morning at 9am",
      buildplan: "/home/cae/ctrl-alt-elite/test.md",
    })
    const res = await POST(req)
    // May still return 400/422 for invalid buildplan path in test env, but not 403
    expect(res.status).not.toBe(403)
  })
})

describe("PATCH /api/schedule/[id] — defense-in-depth role check", () => {
  beforeEach(() => { vi.resetModules() })

  it("viewer session → 403 on PATCH", async () => {
    mockAuthSession.mockResolvedValue(makeSession("viewer"))
    const { PATCH } = await import("@/app/api/schedule/[id]/route")
    const req = makeReq("/api/schedule/abc-123", "PATCH", { enabled: true })
    const res = await PATCH(req, { params: Promise.resolve({ id: "abc-123" }) })
    expect(res.status).toBe(403)
  })

  it("viewer session → 403 on DELETE", async () => {
    mockAuthSession.mockResolvedValue(makeSession("viewer"))
    const { DELETE } = await import("@/app/api/schedule/[id]/route")
    const req = makeReq("/api/schedule/abc-123", "DELETE")
    const res = await DELETE(req, { params: Promise.resolve({ id: "abc-123" }) })
    expect(res.status).toBe(403)
  })
})
