/**
 * Tests for GET /api/security/audit
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() }),
}))
vi.mock("next-auth/providers/github", () => ({ default: {} }))
vi.mock("next-auth/providers/google", () => ({
  default: (_opts?: unknown) => ({ id: "google", type: "oauth" }),
}))

const mockAuth = vi.fn()
vi.mock("@/auth", () => ({
  auth: mockAuth,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}))

vi.mock("@/lib/cae-audit-log", () => ({
  readAuditLog: vi.fn().mockResolvedValue({
    entries: [
      { ts: "2026-04-23T10:00:00Z", task: "t1", tool: "Bash", cwd: "/home/cae" },
    ],
    total: 1,
  }),
}))

describe("GET /api/security/audit", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("Test 5: operator gets 200 with entries + total", async () => {
    mockAuth.mockResolvedValue({
      user: { email: "op@example.com", role: "operator" },
      expires: "2099-01-01",
    })
    const { GET } = await import("./route")
    const req = new NextRequest(
      "http://localhost/api/security/audit?tool=Bash&limit=100"
    )
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.entries)).toBe(true)
    expect(typeof body.total).toBe("number")
  })

  it("Test 5b: viewer gets 403", async () => {
    mockAuth.mockResolvedValue({
      user: { email: "v@example.com", role: "viewer" },
      expires: "2099-01-01",
    })
    const { GET } = await import("./route")
    const req = new NextRequest("http://localhost/api/security/audit")
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it("Test 5c: unauthenticated gets 403", async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import("./route")
    const req = new NextRequest("http://localhost/api/security/audit")
    const res = await GET(req)
    expect(res.status).toBe(403)
  })
})
