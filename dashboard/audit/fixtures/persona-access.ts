/**
 * audit/fixtures/persona-access.ts — Phase 15 C2 Wave, Class 4A.
 *
 * Persona × route expected-access matrix. Encodes what each of the six
 * audit personas should experience when they navigate to a given route,
 * derived from:
 *
 *   - `middleware.ts` (auth gate + admin-only paths + operator-only
 *     paths like /build/security/audit)
 *   - `lib/cae-rbac.ts` role hierarchy (viewer < operator < admin)
 *   - `audit/routes.ts` RouteEntry.authRequired + RouteEntry.personas
 *   - `audit/personas.ts` PERSONAS[*].role ("none" | "viewer" | "operator" | "admin")
 *
 * Why this exists (Class 4 of C2-FIX-WAVE.md):
 *   The `depth` pillar scored 214/408 cells at 1 (0/N data-truth keys
 *   rendered). Many of those cells are *correctly gated* — the persona
 *   landed on `/signin` or `/403`, not on the requested route, so of
 *   course no data-truth keys for the requested route rendered. Scoring
 *   such a cell 1 is a false negative. The depth scorer consults this
 *   matrix: if the expected access is "gate" (admin-only → /403) or
 *   "redirect" (unauth → /signin), depth returns N/A (excluded from
 *   rollup) instead of a punishing 1.
 *
 * Three states:
 *   - "render"   — persona should see the requested page render normally.
 *                  If truth is empty here, that's a real bug.
 *   - "gate"     — persona hits a 403 because middleware blocks admin /
 *                  operator-only routes for this role.
 *   - "redirect" — persona has no session and middleware bounces them to
 *                  /signin (founder-first-time is the only such persona).
 *
 * Maintenance:
 *   If middleware.ts adds a new gated path OR a new persona lands in
 *   personas.ts, update this file. The self-test in
 *   persona-access.test.ts walks every (persona × route) pair and fails
 *   if the matrix is missing a cell.
 */

import type { PersonaId, RouteEntry } from "../routes"
import { ROUTES } from "../routes"
import type { Persona } from "../personas"
import { PERSONAS } from "../personas"

export type AccessExpectation = "render" | "gate" | "redirect"

export type PersonaAccessMatrix = Record<
  PersonaId,
  Record<string /* route slug */, AccessExpectation>
>

/**
 * Routes that live entirely outside the auth gate. Everyone — including
 * a persona with no session — should see these render normally.
 * Mirrors the three `authRequired: false` entries in routes.ts.
 */
const PUBLIC_SLUGS: ReadonlySet<string> = new Set(["root", "signin", "403"])

/**
 * Admin-only slugs per middleware.ts (`/build/admin/*` matcher). Any
 * persona with a role below `admin` hitting one of these is redirected
 * to `/403` by middleware.
 */
const ADMIN_ONLY_SLUGS: ReadonlySet<string> = new Set(["build-admin-roles"])

/**
 * Operator-or-up slugs per middleware.ts (`/build/security/audit` branch).
 * Viewer-role personas are redirected to `/403`.
 */
const OPERATOR_UP_SLUGS: ReadonlySet<string> = new Set(["build-security-audit"])

/**
 * expectedAccessFor — pure function deriving the expectation for one
 * (persona × route) pair. Exported so the scorer can call it directly
 * rather than materialising the whole matrix when it only needs one cell.
 */
export function expectedAccessFor(
  persona: Persona,
  route: RouteEntry,
): AccessExpectation {
  // Public pages render for everyone regardless of session.
  if (PUBLIC_SLUGS.has(route.slug)) return "render"

  // No-session personas (founder-first-time) can't reach any auth'd page.
  if (persona.role === "none") return "redirect"

  // Admin-only: any non-admin role is 403'd.
  if (ADMIN_ONLY_SLUGS.has(route.slug)) {
    return persona.role === "admin" ? "render" : "gate"
  }

  // Operator-or-up: viewer is 403'd; operator + admin render.
  if (OPERATOR_UP_SLUGS.has(route.slug)) {
    return persona.role === "viewer" ? "gate" : "render"
  }

  // Everything else is viewer-accessible once authenticated.
  return "render"
}

/**
 * buildPersonaAccessMatrix — materialise the full matrix in one pass.
 * Used by the self-test and by callers that want a pre-computed map.
 */
export function buildPersonaAccessMatrix(
  personas: readonly Persona[] = PERSONAS,
  routes: readonly RouteEntry[] = ROUTES,
): PersonaAccessMatrix {
  const out = {} as PersonaAccessMatrix
  for (const p of personas) {
    const row: Record<string, AccessExpectation> = {}
    for (const r of routes) {
      row[r.slug] = expectedAccessFor(p, r)
    }
    out[p.id] = row
  }
  return out
}

/**
 * PERSONA_ACCESS — pre-built matrix for convenience. Callers that only
 * need lookup (not derivation) should use `lookupAccess(persona, slug)`
 * below so typos fail loudly.
 */
export const PERSONA_ACCESS: PersonaAccessMatrix = buildPersonaAccessMatrix()

/**
 * lookupAccess — O(1) lookup. Returns `undefined` if either key is
 * unknown so the caller can decide whether that's an error (scorer wants
 * to surface missing matrix entries as "render" — conservative default —
 * and log a warning so this file gets maintained).
 */
export function lookupAccess(
  personaId: PersonaId,
  slug: string,
): AccessExpectation | undefined {
  return PERSONA_ACCESS[personaId]?.[slug]
}
