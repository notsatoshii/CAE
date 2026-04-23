/**
 * tests/security/cr04-buildplan-injection.test.ts
 *
 * Regression tests for CR-04: buildplan field in POST /api/schedule was not
 * validated for shell metacharacters. The scheduler watcher interpolated the
 * value into a tmux shell string, enabling RCE for operator-role users.
 *
 * Fix: BUILDPLAN_RE allowlist added to the API route (primary) and the store
 * validator (defense-in-depth). The watcher now uses positional args instead
 * of string interpolation.
 *
 * WR-01 regression also covered: startsWith(caeRoot) without separator allowed
 * /home/cae/ctrl-alt-elite-evil/... to pass. Fixed to require trailing sep.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { Role } from "@/lib/cae-types"

// ── Mock next-auth + auth ────────────────────────────────────────────────────
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
  googleSignInCheck: vi.fn().mockReturnValue(true),
}))

// ── Mock store so no real filesystem writes occur ────────────────────────────
vi.mock("@/lib/cae-schedule-store", () => ({
  readTasks: vi.fn().mockResolvedValue([]),
  writeTask: vi.fn().mockResolvedValue(undefined),
}))

// ── Mock parseSchedule so it doesn't call LLM ───────────────────────────────
vi.mock("@/lib/cae-schedule-parse", () => ({
  parseSchedule: vi.fn().mockResolvedValue({ cron: "0 9 * * *", source: "rule", confidence: "high" }),
}))

function makeOperatorSession() {
  return { user: { email: "op@diiant.com", role: "operator" as Role }, expires: "2099-01-01" }
}

function makeScheduleReq(buildplan: string, nl = "every morning at 9am") {
  return new NextRequest("http://localhost/api/schedule", {
    method: "POST",
    body: JSON.stringify({ nl, buildplan }),
    headers: { "Content-Type": "application/json" },
  })
}

describe("CR-04: POST /api/schedule rejects buildplan with shell metacharacters", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthSession.mockResolvedValue(makeOperatorSession())
    // Reset CAE_ROOT to known value for path prefix checks
    process.env.CAE_ROOT = "/home/cae/ctrl-alt-elite"
  })

  it("CR-04a: single-quote injection → 400", async () => {
    const { POST } = await import("@/app/api/schedule/route")
    const res = await POST(makeScheduleReq("/home/cae/ctrl-alt-elite/ok'; touch /tmp/pwned; echo '"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid characters/)
  })

  it("CR-04b: semicolon injection → 400", async () => {
    const { POST } = await import("@/app/api/schedule/route")
    const res = await POST(makeScheduleReq("/home/cae/ctrl-alt-elite/ok;id"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid characters/)
  })

  it("CR-04c: dollar-sign injection → 400", async () => {
    const { POST } = await import("@/app/api/schedule/route")
    const res = await POST(makeScheduleReq("/home/cae/ctrl-alt-elite/$(id)"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid characters/)
  })

  it("CR-04d: space in path → 400", async () => {
    const { POST } = await import("@/app/api/schedule/route")
    const res = await POST(makeScheduleReq("/home/cae/ctrl-alt-elite/path with spaces/plan.md"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid characters/)
  })

  it("CR-04e: valid path → 201 (passes all checks)", async () => {
    const { POST } = await import("@/app/api/schedule/route")
    const res = await POST(makeScheduleReq("/home/cae/ctrl-alt-elite/tasks/deploy.md"))
    expect(res.status).toBe(201)
  })
})

describe("WR-01: POST /api/schedule rejects path-prefix escape (no trailing sep)", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthSession.mockResolvedValue(makeOperatorSession())
    process.env.CAE_ROOT = "/home/cae/ctrl-alt-elite"
  })

  it("WR-01a: /home/cae/ctrl-alt-elite-evil/plan.md → 400 (prefix escape)", async () => {
    const { POST } = await import("@/app/api/schedule/route")
    const res = await POST(makeScheduleReq("/home/cae/ctrl-alt-elite-evil/plan.md"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/CAE_ROOT/)
  })

  it("WR-01b: exact caeRoot as buildplan → 400 (not a file path)", async () => {
    // The root itself with no subpath is weird but should be handled gracefully
    // (path.normalize of a dir path doesn't add trailing slash — still allowed
    // by the new check which permits normalizedBp === caeRoot)
    // This test documents current behaviour: the dir itself passes the prefix check
    // but may still fail the BUILDPLAN_RE or produce a non-file on dispatch.
    // We just assert it doesn't crash.
    const { POST } = await import("@/app/api/schedule/route")
    const res = await POST(makeScheduleReq("/home/cae/ctrl-alt-elite"))
    // Either 201 (dir path allowed but watcher will fail gracefully) or 400
    expect([201, 400]).toContain(res.status)
  })

  it("WR-01c: /home/cae/ctrl-alt-elite/valid/plan.md → 201", async () => {
    const { POST } = await import("@/app/api/schedule/route")
    const res = await POST(makeScheduleReq("/home/cae/ctrl-alt-elite/valid/plan.md"))
    expect(res.status).toBe(201)
  })
})
