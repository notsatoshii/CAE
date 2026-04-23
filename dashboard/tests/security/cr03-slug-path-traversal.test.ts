/**
 * tests/security/cr03-slug-path-traversal.test.ts
 *
 * Regression tests for CR-03: SLUG_RE in /api/security/scan/[name] allowed `..`
 * and `.`, permitting arbitrary-directory gitleaks scans via operator role.
 *
 * Also covers the trust-override SLUG_RE tightening (consistent hardening).
 *
 * Each test constructs the attack string documented in the review and asserts
 * that the route returns 400 before any scan executes.
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

// ── Mock scanSkill so no real gitleaks process is spawned ────────────────────
const mockScanSkill = vi.fn()
const mockAppendScan = vi.fn().mockResolvedValue(undefined)
vi.mock("@/lib/cae-secrets-scan", () => ({
  scanSkill: mockScanSkill,
  appendScan: mockAppendScan,
}))

// ── Mock trust-overrides lib ─────────────────────────────────────────────────
vi.mock("@/lib/cae-trust-overrides", () => ({
  writeOverride: vi.fn().mockResolvedValue(undefined),
  overrideKey: (owner: string, name: string) => `${owner}/${name}`,
}))

function makeOperatorSession(role: Role = "operator") {
  return { user: { email: "op@diiant.com", role }, expires: "2099-01-01" }
}

function makeAdminSession() {
  return { user: { email: "admin@diiant.com", role: "admin" as Role }, expires: "2099-01-01" }
}

// ── /api/security/scan/[name] ────────────────────────────────────────────────
describe("CR-03: POST /api/security/scan/[name] — rejects path-traversal names", () => {
  beforeEach(() => {
    vi.resetModules()
    mockScanSkill.mockReset()
    mockAuthSession.mockResolvedValue(makeOperatorSession())
  })

  it("CR-03a: name='..' → 400, scanSkill never called", async () => {
    const { POST } = await import("@/app/api/security/scan/[name]/route")
    const req = new NextRequest("http://localhost/api/security/scan/..", { method: "POST" })
    const res = await POST(req, { params: Promise.resolve({ name: ".." }) })
    expect(res.status).toBe(400)
    expect(mockScanSkill).not.toHaveBeenCalled()
  })

  it("CR-03b: name='.' → 400, scanSkill never called", async () => {
    const { POST } = await import("@/app/api/security/scan/[name]/route")
    const req = new NextRequest("http://localhost/api/security/scan/.", { method: "POST" })
    const res = await POST(req, { params: Promise.resolve({ name: "." }) })
    expect(res.status).toBe(400)
    expect(mockScanSkill).not.toHaveBeenCalled()
  })

  it("CR-03c: name='.hidden' (leading dot) → 400", async () => {
    const { POST } = await import("@/app/api/security/scan/[name]/route")
    const req = new NextRequest("http://localhost/api/security/scan/.hidden", { method: "POST" })
    const res = await POST(req, { params: Promise.resolve({ name: ".hidden" }) })
    expect(res.status).toBe(400)
    expect(mockScanSkill).not.toHaveBeenCalled()
  })

  it("CR-03d: name='-xfoo' (leading dash) → 400", async () => {
    const { POST } = await import("@/app/api/security/scan/[name]/route")
    const req = new NextRequest("http://localhost/api/security/scan/-xfoo", { method: "POST" })
    const res = await POST(req, { params: Promise.resolve({ name: "-xfoo" }) })
    expect(res.status).toBe(400)
    expect(mockScanSkill).not.toHaveBeenCalled()
  })

  it("CR-03e: valid name 'my-skill' → passes validation (scanSkill called)", async () => {
    mockScanSkill.mockResolvedValue({ available: true, findings: [], scannedAt: new Date().toISOString() })
    const { POST } = await import("@/app/api/security/scan/[name]/route")
    const req = new NextRequest("http://localhost/api/security/scan/my-skill", { method: "POST" })
    const res = await POST(req, { params: Promise.resolve({ name: "my-skill" }) })
    // Should not be 400 (may be 200 or any non-400 status)
    expect(res.status).not.toBe(400)
    expect(mockScanSkill).toHaveBeenCalled()
  })
})

// ── /api/security/trust-override ─────────────────────────────────────────────
describe("CR-03: POST /api/security/trust-override — rejects dot/dash owner or name", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthSession.mockResolvedValue(makeAdminSession())
  })

  function makeTrustReq(owner: string, name: string) {
    return new NextRequest("http://localhost/api/security/trust-override", {
      method: "POST",
      body: JSON.stringify({ owner, name, trusted: true }),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("CR-03f: owner='..' → 400", async () => {
    const { POST } = await import("@/app/api/security/trust-override/route")
    const res = await POST(makeTrustReq("..", "skill"))
    expect(res.status).toBe(400)
  })

  it("CR-03g: name='..' → 400", async () => {
    const { POST } = await import("@/app/api/security/trust-override/route")
    const res = await POST(makeTrustReq("owner", ".."))
    expect(res.status).toBe(400)
  })

  it("CR-03h: owner='-evil' (leading dash) → 400", async () => {
    const { POST } = await import("@/app/api/security/trust-override/route")
    const res = await POST(makeTrustReq("-evil", "skill"))
    expect(res.status).toBe(400)
  })

  it("CR-03i: valid owner/name → 200", async () => {
    const { POST } = await import("@/app/api/security/trust-override/route")
    const res = await POST(makeTrustReq("vercel-labs", "agent-skills"))
    expect(res.status).toBe(200)
  })
})
