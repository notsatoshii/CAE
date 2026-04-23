/**
 * Tests for GET /api/admin/roles
 * Phase 14 Plan 04 — Task 3, Tests 1+2
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { Role } from "@/lib/cae-types"

const mockAuth = vi.fn()

vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() }),
}))
vi.mock("next-auth/providers/github", () => ({ default: {} }))
vi.mock("next-auth/providers/google", () => ({
  default: (_opts?: unknown) => ({ id: "google", type: "oauth" }),
}))
vi.mock("@/auth", () => ({
  auth: mockAuth,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}))

function makeSession(role: Role | null) {
  if (!role) return null
  return { user: { email: "test@example.com", role }, expires: "2099-01-01" }
}

describe("GET /api/admin/roles", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("ADMIN_EMAILS", "eric@diiant.com,alice@diiant.com")
    vi.stubEnv("OPERATOR_EMAILS", "ops@diiant.com")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("Test 1: admin session → 200 with admins + operators from env", async () => {
    mockAuth.mockResolvedValue(makeSession("admin"))
    const { GET } = await import("./route")
    const req = new NextRequest("http://localhost:3000/api/admin/roles")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.admins).toContain("eric@diiant.com")
    expect(body.admins).toContain("alice@diiant.com")
    expect(body.operators).toContain("ops@diiant.com")
  })

  it("Test 2: operator session → 403", async () => {
    mockAuth.mockResolvedValue(makeSession("operator"))
    const { GET } = await import("./route")
    const req = new NextRequest("http://localhost:3000/api/admin/roles")
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it("viewer session → 403", async () => {
    mockAuth.mockResolvedValue(makeSession("viewer"))
    const { GET } = await import("./route")
    const req = new NextRequest("http://localhost:3000/api/admin/roles")
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it("unauthenticated → 403", async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import("./route")
    const req = new NextRequest("http://localhost:3000/api/admin/roles")
    const res = await GET(req)
    expect(res.status).toBe(403)
  })
})
