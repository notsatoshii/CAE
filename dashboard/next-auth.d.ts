/**
 * next-auth.d.ts — Module augmentation to add `role` to NextAuth types.
 *
 * Phase 14 Plan 04: Extends Session, User, and JWT with the Role type so
 * TypeScript knows about session.user.role throughout the codebase.
 *
 * IMPORTANT: This file must be at the project root (same level as auth.ts)
 * to be picked up by tsc via the tsconfig.json include glob.
 */
import type { Role } from "@/lib/cae-types"

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      /** RBAC role resolved from ADMIN_EMAILS / OPERATOR_EMAILS env at sign-in time. */
      role: Role
    }
  }

  interface User {
    /** Role is resolved in the jwt callback, not on the User object itself. */
    role?: Role
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    /** Role resolved from env whitelist at initial sign-in; preserved across requests. */
    role?: Role
  }
}
