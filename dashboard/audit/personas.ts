/**
 * audit/personas.ts — Phase 15 Cap.2.
 *
 * 6 personas per OVERHAUL-PLAN (P1-P6). Each persona knows:
 *   - its ID (matches PersonaId in audit/routes.ts)
 *   - a human label for reports
 *   - the role claim used when minting a session JWE
 *   - explainMode default (UI flag — defaulted on for founders who need
 *     the "why this panel?" tooltips; off for devs/admins who already
 *     know)
 *   - cohort label (a grouping string the scorer can aggregate on)
 *
 * `first-time founder` (P1) is the only persona that runs WITHOUT a
 * session cookie — we want to see what a brand-new user sees before
 * signing in. Its `role` is "none" as a sentinel; buildPersonaCookies()
 * returns [] for it.
 *
 * Cookie minting is async (mintSessionState is async), so we expose
 * `buildPersonaCookies(persona, opts)` as the single call site. The
 * runner awaits it once per persona before the capture loop starts.
 */

import type { Cookie } from "@playwright/test"
import { mintSessionState } from "./auth/mint-session"
import type { PersonaId } from "./routes"

export interface Persona {
  /** Machine ID — matches PersonaId used in routes.ts persona gates. */
  id: PersonaId
  /** Filesystem-safe name used in screenshot paths. */
  name: string
  /** Human label for reports / SCORES.md cells. */
  label: string
  /** Role claim burned into the session JWE. `"none"` → no cookie. */
  role: "viewer" | "operator" | "admin" | "none"
  /** UI flag — start with ExplainMode on or off. */
  explainMode: boolean
  /** Scorer-level grouping label. */
  cohort: "founder" | "operator" | "dev" | "admin" | "spectator"
}

export const PERSONAS: Persona[] = [
  // P1 — First-time founder. No cookie at all; they hit /signin.
  {
    id: "founder-first-time",
    name: "founder-first-time",
    label: "First-time founder",
    role: "none",
    explainMode: true,
    cohort: "founder",
  },
  // P2 — Returning founder, week 2. Viewer is plenty for a first read.
  {
    id: "founder-returning",
    name: "founder-returning",
    label: "Returning founder",
    role: "viewer",
    explainMode: true,
    cohort: "founder",
  },
  // P3 — Operator / PM running workflows.
  {
    id: "operator",
    name: "operator",
    label: "Operator / PM",
    role: "operator",
    explainMode: false,
    cohort: "operator",
  },
  // P4 — Senior dev embedded to debug. Wants raw signal.
  {
    id: "senior-dev",
    name: "senior-dev",
    label: "Senior dev",
    role: "operator",
    explainMode: false,
    cohort: "dev",
  },
  // P5 — Admin / security reviewer. Full audit + RBAC visibility.
  {
    id: "admin",
    name: "admin",
    label: "Admin / security",
    role: "admin",
    explainMode: false,
    cohort: "admin",
  },
  // P6 — Live spectator (Eric's lens). Admin-equivalent role so every
  // panel is visible; explainMode off because he wants theatre not
  // tooltips.
  {
    id: "live-spectator",
    name: "live-spectator",
    label: "Live spectator",
    role: "admin",
    explainMode: false,
    cohort: "spectator",
  },
]

// caveman: one persona keyed by email keeps audit logs legible.
function personaEmail(p: Persona): string {
  return `${p.name}@audit.cae.local`
}

export interface BuildCookiesOpts {
  /** Auth.js secret — tests pass a fixed string; real runs read env. */
  secret: string
  /** Dashboard base URL — used for cookie domain + secure flag. */
  baseUrl: string
}

/**
 * buildPersonaCookies — produce the Playwright cookie set for a persona.
 * Returns [] for the `none` role (first-time founder) so the runner can
 * `if (cookies.length) await context.addCookies(cookies)`.
 */
export async function buildPersonaCookies(
  persona: Persona,
  opts: BuildCookiesOpts,
): Promise<Cookie[]> {
  if (persona.role === "none") return []

  const state = await mintSessionState({
    baseUrl: opts.baseUrl,
    secret: opts.secret,
    email: personaEmail(persona),
    name: persona.label,
    role: persona.role,
    sub: `audit-persona-${persona.name}`,
  })

  // mintSessionState returns Playwright storage-state shape; the
  // `cookies` field is already compatible with context.addCookies but
  // types differ slightly — we coerce through unknown to appease TS.
  return state.cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
    expires: c.expires,
  })) as unknown as Cookie[]
}
