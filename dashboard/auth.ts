/**
 * auth.ts — NextAuth v5 configuration.
 *
 * Phase 1: GitHub provider.
 * Phase 14 Plan 04: Added Google provider + role callbacks.
 *
 * Role resolution pattern (Research §Pattern 3 + Pitfall 2):
 * - jwt callback: called once with `user` on initial sign-in → write role.
 * - jwt callback: called on every request WITHOUT `user` → preserve existing role.
 * - session callback: copies token.role → session.user.role.
 *
 * STRIDE T-14-04-01: Role is resolved from provider-verified email only.
 * STRIDE T-14-04-02: Role lives in signed JWT; client-side modification ignored.
 */
import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import { resolveRole } from "@/lib/cae-rbac"
import type { Role } from "@/lib/cae-types"

/**
 * authCallbacks — exported for isolated unit testing without mocking NextAuth.
 *
 * Usage in tests:
 *   const { authCallbacks } = await import("@/auth")
 *   const token = await authCallbacks.jwt({ token: {}, user: { email: "..." } })
 */
export const authCallbacks = {
  async jwt({
    token,
    user,
  }: {
    token: Record<string, unknown>
    user?: { id?: string; email?: string | null } | null
  }) {
    // Pitfall 2: only write role when user is present (initial sign-in).
    // Subsequent requests have no user — preserve the existing token.role.
    if (user?.email) {
      token.role = resolveRole(user.email)
      token.email = user.email.toLowerCase()
    }
    return token
  },

  async session({
    session,
    token,
  }: {
    session: { user?: Record<string, unknown>; expires: string }
    token: Record<string, unknown>
  }) {
    if (session.user) {
      session.user.role = (token.role as Role | undefined) ?? "viewer"
      // Normalise email to lowercase in session (matches token normalisation above)
      if (token.email) {
        session.user.email = token.email as string
      }
    }
    return session
  },
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub,
    Google({
      // Optional domain restriction: if AUTH_GOOGLE_HOSTED_DOMAIN is set (e.g. "diiant.com"),
      // only users with that Google Workspace domain can sign in via Google.
      // See docs/ENV.md for setup instructions.
      authorization: process.env.AUTH_GOOGLE_HOSTED_DOMAIN
        ? {
            params: { hd: process.env.AUTH_GOOGLE_HOSTED_DOMAIN },
          }
        : undefined,
    }),
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callbacks: authCallbacks as any,
})
