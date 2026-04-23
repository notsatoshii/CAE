/**
 * tests/security/wr02-workflow-slug-injection.test.ts
 *
 * Regression tests for WR-02: /api/workflows/[slug]/run lacked slug validation.
 * Phase 14 added an operator-role gate but not slug hardening. A workflow file
 * named with shell metacharacters (legal Linux filename) would inject into the
 * tmux `"cae execute-buildplan " + taskId` shell string → RCE.
 *
 * Fix: SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/ validated before getWorkflow().
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

// ── Mock workflow + infra deps ───────────────────────────────────────────────
vi.mock("@/lib/cae-workflows", () => ({
  getWorkflow: vi.fn().mockResolvedValue(null), // 404 for all — we only test slug gate
}))
vi.mock("@/lib/cae-config", () => ({
  INBOX_ROOT: "/tmp/test-inbox",
}))
vi.mock("@/lib/with-log", () => ({
  withLog: (fn: unknown) => fn,
}))
vi.mock("@/lib/log", () => ({
  log: () => ({ error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}))

function makeOperatorSession() {
  return { user: { email: "op@diiant.com", role: "operator" as Role }, expires: "2099-01-01" }
}

function makeRunReq(slug: string) {
  return new NextRequest(`http://localhost/api/workflows/${slug}/run`, { method: "POST" })
}

describe("WR-02: POST /api/workflows/[slug]/run — slug validation", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthSession.mockResolvedValue(makeOperatorSession())
  })

  it("WR-02a: slug with semicolon → 400", async () => {
    const { POST } = await import("@/app/api/workflows/[slug]/run/route")
    const res = await POST(makeRunReq("ok;id"), { params: Promise.resolve({ slug: "ok;id" }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid workflow slug/)
  })

  it("WR-02b: slug with space → 400", async () => {
    const { POST } = await import("@/app/api/workflows/[slug]/run/route")
    const res = await POST(makeRunReq("ok slug"), { params: Promise.resolve({ slug: "ok slug" }) })
    expect(res.status).toBe(400)
  })

  it("WR-02c: slug with ampersand → 400", async () => {
    const { POST } = await import("@/app/api/workflows/[slug]/run/route")
    const res = await POST(makeRunReq("wf&id"), { params: Promise.resolve({ slug: "wf&id" }) })
    expect(res.status).toBe(400)
  })

  it("WR-02d: slug with leading hyphen → 400", async () => {
    const { POST } = await import("@/app/api/workflows/[slug]/run/route")
    const res = await POST(makeRunReq("-flag"), { params: Promise.resolve({ slug: "-flag" }) })
    expect(res.status).toBe(400)
  })

  it("WR-02e: slug with dollar sign → 400", async () => {
    const { POST } = await import("@/app/api/workflows/[slug]/run/route")
    const res = await POST(makeRunReq("wf$(id)"), { params: Promise.resolve({ slug: "wf$(id)" }) })
    expect(res.status).toBe(400)
  })

  it("WR-02f: valid slug passes validation (404 because workflow not found, not 400)", async () => {
    const { POST } = await import("@/app/api/workflows/[slug]/run/route")
    const res = await POST(makeRunReq("my-workflow"), { params: Promise.resolve({ slug: "my-workflow" }) })
    // Passes slug check, hits getWorkflow → 404 (mocked to return null)
    expect(res.status).toBe(404)
  })

  it("WR-02g: valid slug with numbers passes validation", async () => {
    const { POST } = await import("@/app/api/workflows/[slug]/run/route")
    const res = await POST(makeRunReq("deploy-v2"), { params: Promise.resolve({ slug: "deploy-v2" }) })
    expect(res.status).toBe(404) // passes slug gate, hits 404
  })
})
