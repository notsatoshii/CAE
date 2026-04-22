/**
 * Tests for auth.ts — jwt + session callbacks
 * Phase 14 Plan 04 — RBAC role resolution in NextAuth callbacks
 *
 * Strategy: mock next-auth and its providers so vitest doesn't attempt to
 * resolve next/server (which isn't available in the jsdom test environment).
 * We only test the exported `authCallbacks` object — pure functions with no
 * NextAuth runtime dependency.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock next-auth and providers BEFORE importing auth.ts
vi.mock("next-auth", () => ({
  default: (config: unknown) => ({ handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn(), _config: config }),
}))
vi.mock("next-auth/providers/github", () => ({ default: {} }))
vi.mock("next-auth/providers/google", () => ({
  default: (_opts?: unknown) => ({ id: "google", type: "oauth" }),
}))

describe("authCallbacks.jwt", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAILS", "eric@diiant.com")
    vi.stubEnv("OPERATOR_EMAILS", "op@example.com")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("Test 7a: sets token.role=admin for admin email on initial sign-in", async () => {
    const { authCallbacks } = await import("@/auth")
    const result = await authCallbacks.jwt({
      token: {},
      user: { id: "1", email: "eric@diiant.com" },
    })
    expect(result.role).toBe("admin")
  })

  it("Test 7b: preserves role on subsequent requests (no user in token)", async () => {
    const { authCallbacks } = await import("@/auth")
    // Subsequent requests: user is absent — token already has role from initial sign-in
    const result = await authCallbacks.jwt({
      token: { role: "admin" as const },
    })
    expect(result.role).toBe("admin")
  })

  it("sets operator role for operator email", async () => {
    const { authCallbacks } = await import("@/auth")
    const result = await authCallbacks.jwt({
      token: {},
      user: { id: "2", email: "op@example.com" },
    })
    expect(result.role).toBe("operator")
  })

  it("sets viewer role for unknown email", async () => {
    const { authCallbacks } = await import("@/auth")
    const result = await authCallbacks.jwt({
      token: {},
      user: { id: "3", email: "nobody@example.com" },
    })
    expect(result.role).toBe("viewer")
  })
})

describe("authCallbacks.session", () => {
  afterEach(() => {
    vi.resetModules()
  })

  it("Test 8: copies token.role → session.user.role", async () => {
    const { authCallbacks } = await import("@/auth")
    const session = {
      user: { name: "Eric", email: "eric@diiant.com" },
      expires: "2099-01-01",
    }
    const result = await authCallbacks.session({
      session,
      token: { role: "admin" as const },
    })
    expect((result.user as { role?: string }).role).toBe("admin")
  })

  it("defaults to viewer when token has no role", async () => {
    const { authCallbacks } = await import("@/auth")
    const session = {
      user: { name: "Alice", email: "alice@example.com" },
      expires: "2099-01-01",
    }
    const result = await authCallbacks.session({
      session,
      token: {},
    })
    expect((result.user as { role?: string }).role).toBe("viewer")
  })
})
