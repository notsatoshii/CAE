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
 * STRIDE T-14-04-CR01: Google hosted-domain enforced server-side via signIn callback.
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

/**
 * googleSignInCheck — exported for isolated unit testing.
 *
 * Enforces AUTH_GOOGLE_HOSTED_DOMAIN server-side when set.
 * The `hd` OAuth URL param is a UX hint only; this callback is the real gate.
 *
 * Rejects if:
 *   - email_verified is false/absent (unverified Google account)
 *   - profile.hd does not match the expected domain
 *   - profile.email does not end with @<expected-domain>
 */
export function googleSignInCheck(
  profile: { hd?: string; email?: string; email_verified?: boolean } | null | undefined,
  expectedDomain: string | undefined
): boolean {
  if (!expectedDomain) return true
  if (!profile?.email_verified) return false
  const hd = profile?.hd
  if (hd !== expectedDomain) return false
  const email = profile?.email
  if (!email?.endsWith("@" + expectedDomain)) return false
  return true
}

const nextAuth = NextAuth({
  providers: [
    GitHub,
    Google({
      // Optional UX hint: if AUTH_GOOGLE_HOSTED_DOMAIN is set (e.g. "diiant.com"),
      // this pre-selects the account chooser on Google's side.
      // SECURITY NOTE: `hd` param is a UX hint only — NOT a security boundary.
      // Actual domain enforcement is done in the signIn callback below.
      // See docs/ENV.md for setup instructions.
      authorization: process.env.AUTH_GOOGLE_HOSTED_DOMAIN
        ? {
            params: { hd: process.env.AUTH_GOOGLE_HOSTED_DOMAIN },
          }
        : undefined,
    }),
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callbacks: {
    ...(authCallbacks as any),
    // T-14-04-CR01: Server-side enforcement of Google hosted-domain restriction.
    // The `hd` OAuth param above is a UX hint only — Google does NOT reject tokens
    // for accounts outside the domain. We must verify the `hd` claim ourselves.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async signIn({ account, profile }: { account: any; profile?: any }) {
      if (account?.provider === "google") {
        const expected = process.env.AUTH_GOOGLE_HOSTED_DOMAIN
        if (!googleSignInCheck(profile, expected)) return false
      }
      return true
    },
  },
})

const { handlers: _handlers, signIn: _signIn, signOut: _signOut, auth: _auth } = nextAuth

// DEV BYPASS: Return a fake admin session when no OAuth is configured.
// TODO: Remove when Google/GitHub OAuth is set up for prod.
const DEV_BYPASS = !process.env.AUTH_SECRET || process.env.AUTH_BYPASS === "1"

export const handlers = _handlers
export const signIn = _signIn
export const signOut = _signOut
export const auth = DEV_BYPASS
  ? async () => ({
      user: { name: "Dev Admin", email: "admin@cae.dev", role: "admin" as const, image: null },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
  : _auth
