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

// ─── CR-01 regression: Google hosted-domain server-side enforcement ────────────
describe("CR-01: googleSignInCheck — Google hd claim server-side enforcement", () => {
  afterEach(() => {
    vi.resetModules()
  })

  it("CR-01a: allows sign-in when no domain restriction is configured", async () => {
    const { googleSignInCheck } = await import("@/auth")
    const profile = { hd: "personal.com", email: "user@personal.com", email_verified: true }
    expect(googleSignInCheck(profile, undefined)).toBe(true)
  })

  it("CR-01b: allows sign-in when hd matches expected domain and email_verified=true", async () => {
    const { googleSignInCheck } = await import("@/auth")
    const profile = { hd: "diiant.com", email: "user@diiant.com", email_verified: true }
    expect(googleSignInCheck(profile, "diiant.com")).toBe(true)
  })

  it("CR-01c: rejects sign-in when hd is missing (personal Gmail, no hd claim)", async () => {
    const { googleSignInCheck } = await import("@/auth")
    // Personal Gmail accounts have no hd claim
    const profile = { email: "attacker@gmail.com", email_verified: true }
    expect(googleSignInCheck(profile, "diiant.com")).toBe(false)
  })

  it("CR-01d: rejects sign-in when hd mismatches expected domain", async () => {
    const { googleSignInCheck } = await import("@/auth")
    const profile = { hd: "evil.com", email: "attacker@evil.com", email_verified: true }
    expect(googleSignInCheck(profile, "diiant.com")).toBe(false)
  })

  it("CR-01e: rejects sign-in when email_verified is false", async () => {
    const { googleSignInCheck } = await import("@/auth")
    const profile = { hd: "diiant.com", email: "user@diiant.com", email_verified: false }
    expect(googleSignInCheck(profile, "diiant.com")).toBe(false)
  })

  it("CR-01f: rejects sign-in when email_verified is absent", async () => {
    const { googleSignInCheck } = await import("@/auth")
    const profile = { hd: "diiant.com", email: "user@diiant.com" }
    expect(googleSignInCheck(profile, "diiant.com")).toBe(false)
  })

  it("CR-01g: rejects when hd matches but email domain does not (split-brain protection)", async () => {
    const { googleSignInCheck } = await import("@/auth")
    // hd claim matches but email is from a different domain — belt-and-suspenders
    const profile = { hd: "diiant.com", email: "user@otherdomain.com", email_verified: true }
    expect(googleSignInCheck(profile, "diiant.com")).toBe(false)
  })

  it("CR-01h: rejects when profile is null", async () => {
    const { googleSignInCheck } = await import("@/auth")
    expect(googleSignInCheck(null, "diiant.com")).toBe(false)
  })
})
