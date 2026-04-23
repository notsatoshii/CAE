/**
 * phase14-rbac.test.ts — Integration tests for Phase 14 Wave 3: RBAC
 *
 * Covers:
 *   REQ-P14-06: Sign-in page renders GitHub + Google buttons (two providers)
 *   REQ-P14-07: JWT callback → role resolution from env whitelist
 *   REQ-P14-08: Middleware gates viewer from operator-required mutations
 *   REQ-P14-09: Admin page renders email lists when role=admin; 403 for viewer
 *
 * Strategy: tests are unit/integration hybrid — test pure exported functions
 * and component renders rather than full NextAuth runtime (which requires Edge).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { NextRequest, NextResponse } from "next/server"
import React from "react"
import type { Role } from "@/lib/cae-types"

// ─── Shared NextAuth mocks ─────────────────────────────────────────────────────
vi.mock("next-auth", () => ({
  default: (config: unknown) => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
    auth: vi.fn(),
    _config: config,
  }),
}))
vi.mock("next-auth/providers/github", () => ({ default: {} }))
vi.mock("next-auth/providers/google", () => ({
  default: (_opts?: unknown) => ({ id: "google", type: "oauth" }),
}))
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}))

// ─── REQ-P14-06: Two providers on sign-in page ────────────────────────────────
describe("REQ-P14-06: Sign-in page renders two provider buttons", () => {
  it("Test 06a: renders GitHub and Google sign-in buttons", async () => {
    const { default: SignInPage } = await import("@/app/signin/page")
    render(<SignInPage />)

    expect(screen.getByTestId("github-sign-in-button")).toBeInTheDocument()
    expect(screen.getByTestId("google-sign-in-button")).toBeInTheDocument()
  })

  it("Test 06b: GitHub button text contains 'GitHub'", async () => {
    const { default: SignInPage } = await import("@/app/signin/page")
    render(<SignInPage />)

    const btn = screen.getByTestId("github-sign-in-button")
    expect(btn.textContent).toMatch(/GitHub/i)
  })

  it("Test 06c: Google button text contains 'Google'", async () => {
    const { default: SignInPage } = await import("@/app/signin/page")
    render(<SignInPage />)

    const btn = screen.getByTestId("google-sign-in-button")
    expect(btn.textContent).toMatch(/Google/i)
  })
})

// ─── REQ-P14-07: Role resolution from env ─────────────────────────────────────
describe("REQ-P14-07: JWT callback resolves role from ADMIN_EMAILS / OPERATOR_EMAILS", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com,eric@diiant.com")
    vi.stubEnv("OPERATOR_EMAILS", "operator@example.com")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("Test 07a: admin email → role=admin via resolveRole", async () => {
    const { resolveRole } = await import("@/lib/cae-rbac")
    expect(resolveRole("admin@example.com")).toBe("admin")
    expect(resolveRole("eric@diiant.com")).toBe("admin")
  })

  it("Test 07b: operator email → role=operator via resolveRole", async () => {
    const { resolveRole } = await import("@/lib/cae-rbac")
    expect(resolveRole("operator@example.com")).toBe("operator")
  })

  it("Test 07c: unknown email → role=viewer via resolveRole", async () => {
    const { resolveRole } = await import("@/lib/cae-rbac")
    expect(resolveRole("stranger@example.com")).toBe("viewer")
  })

  it("Test 07d: authCallbacks.jwt writes role on initial sign-in (user present)", async () => {
    const { authCallbacks } = await import("@/auth")
    const result = await authCallbacks.jwt({
      token: {},
      user: { id: "1", email: "admin@example.com" },
    })
    expect(result.role).toBe("admin")
  })

  it("Test 07e: authCallbacks.jwt preserves role on refresh (no user)", async () => {
    const { authCallbacks } = await import("@/auth")
    const result = await authCallbacks.jwt({
      token: { role: "operator" as Role },
    })
    expect(result.role).toBe("operator")
  })

  it("Test 07f: isAtLeast correctly orders viewer < operator < admin", async () => {
    const { isAtLeast } = await import("@/lib/cae-rbac")
    expect(isAtLeast("admin", "viewer")).toBe(true)
    expect(isAtLeast("admin", "operator")).toBe(true)
    expect(isAtLeast("admin", "admin")).toBe(true)
    expect(isAtLeast("operator", "admin")).toBe(false)
    expect(isAtLeast("viewer", "operator")).toBe(false)
  })
})

// ─── REQ-P14-08: Middleware gates ─────────────────────────────────────────────
describe("REQ-P14-08: Middleware gates operator-required mutations for viewer", () => {
  function makeReq(
    pathname: string,
    method: string,
    role: Role | null,
  ): NextRequest & { auth: { user: { role: Role } } | null } {
    const url = `http://localhost:3000${pathname}`
    const req = new NextRequest(url, { method }) as NextRequest & {
      auth: { user: { role: Role } } | null
    }
    req.auth = role === null ? null : { user: { role } }
    return req
  }

  it("Test 08a: unauthenticated → redirect to /signin", async () => {
    const { middlewareHandler } = await import("@/middleware")
    const req = makeReq("/build/queue", "GET", null)
    const res = await middlewareHandler(req)
    const loc = (res as NextResponse).headers.get("location")
    expect(loc).toContain("/signin")
  })

  it("Test 08b: viewer POST /api/queue/delegate → 403 JSON", async () => {
    const { middlewareHandler } = await import("@/middleware")
    const req = makeReq("/api/queue/delegate", "POST", "viewer")
    const res = await middlewareHandler(req)
    expect(res.status).toBe(403)
  })

  it("Test 08c: operator POST /api/queue/delegate → pass through (no redirect)", async () => {
    const { middlewareHandler } = await import("@/middleware")
    const req = makeReq("/api/queue/delegate", "POST", "operator")
    const res = await middlewareHandler(req)
    // next() — no Location header, status 200
    const loc = (res as NextResponse).headers.get("location")
    expect(loc).toBeNull()
  })

  it("Test 08d: viewer on /build/admin/roles → redirect to /403", async () => {
    const { middlewareHandler } = await import("@/middleware")
    const req = makeReq("/build/admin/roles", "GET", "viewer")
    const res = await middlewareHandler(req)
    const loc = (res as NextResponse).headers.get("location")
    expect(loc).toContain("/403")
  })

  it("Test 08e: admin on /build/admin/roles → pass through", async () => {
    const { middlewareHandler } = await import("@/middleware")
    const req = makeReq("/build/admin/roles", "GET", "admin")
    const res = await middlewareHandler(req)
    const loc = (res as NextResponse).headers.get("location")
    expect(loc).toBeNull()
  })
})

// ─── REQ-P14-09: Admin roles page ─────────────────────────────────────────────
describe("REQ-P14-09: Admin page renders email lists", () => {
  it("Test 09a: RoleEditor renders admin emails when provided", async () => {
    const { RoleEditor } = await import("@/app/build/admin/roles/role-editor")
    render(
      <RoleEditor
        admins={["eric@diiant.com", "alice@diiant.com"]}
        operators={["ops@example.com"]}
      />
    )

    expect(screen.getByText("eric@diiant.com")).toBeInTheDocument()
    expect(screen.getByText("alice@diiant.com")).toBeInTheDocument()
    expect(screen.getByText("ops@example.com")).toBeInTheDocument()
  })

  it("Test 09b: RoleEditor shows empty state message when no admins", async () => {
    const { RoleEditor } = await import("@/app/build/admin/roles/role-editor")
    render(<RoleEditor admins={[]} operators={[]} />)
    expect(screen.getByText(/No admins/i)).toBeInTheDocument()
  })

  it("Test 09c: RoleEditor shows env-based instruction", async () => {
    const { RoleEditor } = await import("@/app/build/admin/roles/role-editor")
    render(
      <RoleEditor
        admins={["eric@diiant.com"]}
        operators={[]}
      />
    )
    expect(screen.getByText(/ADMIN_EMAILS/)).toBeInTheDocument()
  })

  it("Test 09d: RoleGate hides children when currentRole is below required", async () => {
    const { RoleGate } = await import("@/components/auth/role-gate")
    render(
      <RoleGate role="admin" currentRole="viewer">
        <button>Admin Only Button</button>
      </RoleGate>
    )
    // Should NOT render the admin button for viewer
    expect(screen.queryByText("Admin Only Button")).toBeNull()
  })

  it("Test 09e: RoleGate shows children when currentRole meets requirement", async () => {
    const { RoleGate } = await import("@/components/auth/role-gate")
    render(
      <RoleGate role="operator" currentRole="admin">
        <button>Operator Button</button>
      </RoleGate>
    )
    expect(screen.getByText("Operator Button")).toBeInTheDocument()
  })
})
