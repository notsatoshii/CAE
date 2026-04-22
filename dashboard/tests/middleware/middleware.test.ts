/**
 * Tests for middleware role-gating logic
 * Phase 14 Plan 04 — Task 2
 *
 * Strategy: the middleware inner handler receives (req) where req is an
 * augmented NextRequest with req.auth attached by NextAuth. We test the
 * pure routing logic by calling the exported `middlewareHandler` directly
 * with stubbed request objects.
 */
import { describe, it, expect, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import type { Role } from "@/lib/cae-types"

// Mock next-auth so importing middleware doesn't pull in the full NextAuth runtime
vi.mock("next-auth", () => ({
  default: (config: unknown) => ({
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
    auth: (handler: unknown) => handler,
    _config: config,
  }),
}))
vi.mock("next-auth/providers/github", () => ({ default: {} }))
vi.mock("next-auth/providers/google", () => ({
  default: (_opts?: unknown) => ({ id: "google", type: "oauth" }),
}))

/**
 * Build a minimal augmented NextRequest with a faked auth property.
 */
function makeReq(
  pathname: string,
  method: string,
  role: Role | null, // null = unauthenticated
): NextRequest & { auth: { user: { role: Role } } | null } {
  const url = `http://localhost:3000${pathname}`
  const req = new NextRequest(url, { method }) as NextRequest & {
    auth: { user: { role: Role } } | null
  }
  req.auth = role === null ? null : { user: { role } }
  return req
}

// Import the inner handler (not the NextAuth-wrapped export)
import { middlewareHandler } from "@/middleware"

describe("middlewareHandler", () => {
  it("Test 1: unauthenticated → redirect to /signin with from param", async () => {
    const req = makeReq("/build/queue", "GET", null)
    const res = await middlewareHandler(req)
    expect(res).toBeInstanceOf(NextResponse)
    const loc = (res as NextResponse).headers.get("location")
    expect(loc).toContain("/signin")
    expect(loc).toContain("from=")
  })

  it("Test 2: viewer on /build/admin/roles → redirect to /403", async () => {
    const req = makeReq("/build/admin/roles", "GET", "viewer")
    const res = await middlewareHandler(req)
    const loc = (res as NextResponse).headers.get("location")
    expect(loc).toContain("/403")
  })

  it("Test 3: operator on /build/admin/roles → redirect to /403", async () => {
    const req = makeReq("/build/admin/roles", "GET", "operator")
    const res = await middlewareHandler(req)
    const loc = (res as NextResponse).headers.get("location")
    expect(loc).toContain("/403")
  })

  it("Test 4: admin on /build/admin/roles → pass through (NextResponse.next)", async () => {
    const req = makeReq("/build/admin/roles", "GET", "admin")
    const res = await middlewareHandler(req)
    // next() has no Location header
    const loc = (res as NextResponse).headers.get("location")
    expect(loc).toBeNull()
  })

  it("Test 5: viewer POST /api/queue/delegate → 403 JSON", async () => {
    const req = makeReq("/api/queue/delegate", "POST", "viewer")
    const res = await middlewareHandler(req)
    expect(res?.status).toBe(403)
    const body = await (res as NextResponse).json()
    expect(body.error).toBe("forbidden")
  })

  it("Test 6: viewer GET /api/queue/delegate → pass through", async () => {
    const req = makeReq("/api/queue/delegate", "GET", "viewer")
    const res = await middlewareHandler(req)
    // GET is read-only — not blocked
    expect(res?.status).not.toBe(403)
    const loc = (res as NextResponse).headers.get("location")
    expect(loc).toBeNull()
  })

  it("operator POST /api/skills/install → pass through", async () => {
    const req = makeReq("/api/skills/install", "POST", "operator")
    const res = await middlewareHandler(req)
    expect(res?.status).not.toBe(403)
  })

  it("viewer POST /api/schedule → 403 JSON", async () => {
    const req = makeReq("/api/schedule", "POST", "viewer")
    const res = await middlewareHandler(req)
    expect(res?.status).toBe(403)
  })

  it("viewer DELETE /api/schedule/abc-123 → 403 JSON", async () => {
    const req = makeReq("/api/schedule/abc-123", "DELETE", "viewer")
    const res = await middlewareHandler(req)
    expect(res?.status).toBe(403)
  })
})
