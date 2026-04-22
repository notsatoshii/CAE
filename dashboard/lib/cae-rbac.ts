/**
 * cae-rbac.ts — Role-based access control helpers for CAE dashboard.
 *
 * Phase 14 Plan 04: Three-tier RBAC (viewer / operator / admin).
 * Roles are resolved server-side from env allowlists at JWT creation time.
 * Client code NEVER decides roles — only reads them from signed session.
 *
 * STRIDE T-14-04-01 (spoofing): role is resolved from provider-verified
 * email in the jwt callback; JWT is signed by AUTH_SECRET — tampered tokens
 * fail verification before this module is ever called.
 */
import type { Role } from "./cae-types"

/** Numeric rank for role comparison — higher = more privileged. */
export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
}

/**
 * parseList — parse a comma-separated env value into trimmed lowercase tokens.
 * Exported so /build/admin/roles/page.tsx can read the whitelist from env.
 */
export function parseList(envVal: string | undefined): string[] {
  return (envVal ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * resolveRole — return the highest role for a given email address.
 *
 * Reads ADMIN_EMAILS and OPERATOR_EMAILS from process.env at call-time (not
 * module load-time) so hot-reload in dev and test stubEnv() both work.
 *
 * @param email - Provider-verified email from OAuth. Null/undefined → viewer.
 */
export function resolveRole(email: string | null | undefined): Role {
  if (!email) return "viewer"
  const key = email.toLowerCase()
  if (parseList(process.env.ADMIN_EMAILS).includes(key)) return "admin"
  if (parseList(process.env.OPERATOR_EMAILS).includes(key)) return "operator"
  return "viewer"
}

/**
 * isAtLeast — compare two roles.
 *
 * @example isAtLeast("operator", "viewer") // true
 * @example isAtLeast("viewer", "operator") // false
 */
export function isAtLeast(current: Role, required: Role): boolean {
  return ROLE_RANK[current] >= ROLE_RANK[required]
}

/**
 * requireRole — guard helper used in route handlers (defense-in-depth).
 *
 * Returns true iff the current role meets the required minimum.
 * A missing/undefined role is treated as viewer-not-granted if required > viewer.
 */
export function requireRole(
  current: Role | undefined,
  required: Role,
): boolean {
  if (current === undefined) return required === "viewer" ? false : false
  return isAtLeast(current, required)
}

/**
 * AUDITABLE_ACTIONS — route → minimum required role mapping.
 * Used by middleware (first line of defense) and for documentation.
 */
export const AUDITABLE_ACTIONS: Record<string, Role> = {
  "POST /api/queue/delegate": "operator",
  "POST /api/workflows/:slug/run": "operator",
  "POST /api/skills/install": "operator",
  "POST /api/schedule": "operator",
  "PATCH /api/schedule/:id": "operator",
  "DELETE /api/schedule/:id": "operator",
  "GET /build/admin": "admin",
  "POST /api/admin/roles": "admin",
  "POST /api/security/trust-override": "admin",
}
