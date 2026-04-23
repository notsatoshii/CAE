/**
 * Tests for POST /api/security/trust-override
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

vi.mock("@/lib/cae-trust-overrides", () => ({
  writeOverride: vi.fn().mockResolvedValue(undefined),
  overrideKey: vi.fn((o: string, n: string) => `${o}/${n}`.toLowerCase()),
}))

describe("POST /api/security/trust-override", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("Test 2: admin can write override → 200 ok:true", async () => {
    mockAuth.mockResolvedValue({
      user: { email: "admin@example.com", role: "admin" },
      expires: "2099-01-01",
    })
    const { POST } = await import("./route")
    const req = new NextRequest("http://localhost/api/security/trust-override", {
      method: "POST",
      body: JSON.stringify({ owner: "vercel-labs", name: "deploy", trusted: true }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it("Test 2b: operator gets 403", async () => {
    mockAuth.mockResolvedValue({
      user: { email: "op@example.com", role: "operator" },
      expires: "2099-01-01",
    })
    const { POST } = await import("./route")
    const req = new NextRequest("http://localhost/api/security/trust-override", {
      method: "POST",
      body: JSON.stringify({ owner: "vercel-labs", name: "deploy", trusted: true }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it("Test 2c: invalid owner name returns 400", async () => {
    mockAuth.mockResolvedValue({
      user: { email: "admin@example.com", role: "admin" },
      expires: "2099-01-01",
    })
    const { POST } = await import("./route")
    const req = new NextRequest("http://localhost/api/security/trust-override", {
      method: "POST",
      body: JSON.stringify({ owner: "../../etc", name: "deploy", trusted: true }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
