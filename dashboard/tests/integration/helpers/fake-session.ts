/**
 * fake-session.ts — Test helpers for mocking NextAuth session in integration tests.
 *
 * Phase 14 Plan 06 — Integration test suite helper.
 *
 * Usage:
 *   fakeSession("admin", "eric@diiant.com") — call BEFORE importing the module under test.
 *   clearSessionMock() — call in afterEach to remove the mock.
 */
import { vi } from "vitest"
import type { Role } from "@/lib/cae-types"

/**
 * fakeSession — stub the @/auth module to return a session with the given role.
 *
 * Must be called before any import of modules that import @/auth.
 * Use vi.resetModules() + dynamic import in tests that need role isolation.
 */
export function fakeSession(role: Role, email = "test@example.com") {
  vi.doMock("@/auth", () => ({
    auth: async () => ({ user: { email, role } }),
    authCallbacks: {
      jwt: async ({ token }: { token: Record<string, unknown> }) => ({ ...token, role, email }),
      session: async ({ session }: { session: Record<string, unknown> }) => session,
    },
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  }))
}

/** clearSessionMock — remove the @/auth mock. Call in afterEach. */
export function clearSessionMock() {
  vi.doUnmock("@/auth")
}
