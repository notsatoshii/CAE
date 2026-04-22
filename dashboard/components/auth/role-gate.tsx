/**
 * RoleGate — conditionally renders children based on user role.
 *
 * Phase 14 Plan 04: RBAC primitive for UI gating.
 *
 * Design principles:
 * - NOT a client component — no useSession() — avoids SSR hydration mismatch
 *   (Research Pitfall 5). Works in both server and client component trees.
 * - Role is passed as a prop from the server-component parent that called auth().
 * - Output is deterministic given props — no loading state, no flash.
 *
 * Usage in a server component:
 *   const session = await auth()
 *   const role = session?.user?.role ?? "viewer"
 *   return <RoleGate role="operator" currentRole={role}>
 *     <DangerousButton />
 *   </RoleGate>
 */
import type { Role } from "@/lib/cae-types"
import { isAtLeast } from "@/lib/cae-rbac"

export type RoleGateProps = {
  /** Minimum role required to see children. */
  role: Role
  /** Current user's role, resolved by the server-component parent via auth(). */
  currentRole: Role | undefined
  /** Rendered when role is insufficient. Defaults to null. */
  fallback?: React.ReactNode
  children: React.ReactNode
}

/**
 * RoleGate — renders children if currentRole >= role, otherwise renders fallback.
 *
 * No client-side logic. Markup is identical on server and client (no hydration flash).
 */
export function RoleGate({
  role,
  currentRole,
  fallback = null,
  children,
}: RoleGateProps) {
  if (!currentRole || !isAtLeast(currentRole, role)) {
    return <>{fallback}</>
  }
  return <>{children}</>
}
