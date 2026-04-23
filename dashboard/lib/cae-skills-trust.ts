/**
 * cae-skills-trust.ts — Trust score computation for installed skills.
 *
 * Plan 14-05 §4a: multi-factor heuristic trust score with explainable reasons.
 * Factors: trusted owner (+30), allowed-tools declared (+20), no risky tools (+20),
 *           no secrets (+20), recently updated (+10). Weights sum to 1.0.
 *
 * Admin override: if overridden=true → short-circuit to 100 with explanation.
 */
import type { CatalogSkill, TrustScore, TrustFactor } from "./cae-types"
import type { SkillFrontmatter } from "./cae-skills-parse"

/** Owners on the trusted allowlist — these get the +30 owner bonus. */
const TRUSTED_OWNERS = new Set([
  "anthropic",
  "anthropic-labs",
  "anthropics",
  "vercel-labs",
  "diiant",
])

/**
 * Regex patterns that detect risky Bash tool scopes.
 * Matches: Bash(rm *), Bash(curl *), Bash(wget *), Bash(*), Bash(sudo *).
 */
const RISKY_TOOL_RES: RegExp[] = [
  /^Bash\(rm\b/,
  /^Bash\(curl\b/,
  /^Bash\(wget\b/,
  /^Bash\(\*\)$/,
  /^Bash\(sudo\b/,
]

export type TrustInput = {
  /** Minimal skill identity for owner check. */
  skill: Pick<CatalogSkill, "owner" | "name">
  /** Parsed frontmatter from SKILL.md. */
  frontmatter: SkillFrontmatter
  /** Total secret findings from the last gitleaks scan. */
  secretsCount: number
  /** Doc-example findings excluded from "real" secret count. */
  docExampleCount?: number
  /** Whether an admin has manually marked this skill as trusted. */
  overridden?: boolean
  /** Days since the skill was last updated in its source repository. */
  updatedWithinDays?: number
}

/**
 * computeTrustScore — produce a 0-100 trust score with per-factor explanations.
 *
 * Admin overrides short-circuit immediately to 100 — the admin takes responsibility.
 * All other scores are derived from the 5 heuristic factors below.
 */
export function computeTrustScore(input: TrustInput): TrustScore {
  if (input.overridden) {
    return {
      total: 100,
      overridden: true,
      factors: [
        {
          id: "admin_override",
          passed: true,
          weight: 1,
          reason: "Admin marked this skill as trusted",
        },
      ],
    }
  }

  const factors: TrustFactor[] = []

  // ── Factor 1: trusted owner (weight 0.30) ─────────────────────────────────
  const ownerTrusted = TRUSTED_OWNERS.has(input.skill.owner.toLowerCase())
  factors.push({
    id: "trusted_owner",
    passed: ownerTrusted,
    weight: 0.3,
    reason: ownerTrusted
      ? `${input.skill.owner} is on the trusted owners list`
      : `${input.skill.owner} is not a verified publisher — review code before installing`,
  })

  // ── Factor 2: allowed-tools declared (weight 0.20) ─────────────────────────
  const hasAllowed = (input.frontmatter.allowedTools?.length ?? 0) > 0
  factors.push({
    id: "allowed_tools_declared",
    passed: hasAllowed,
    weight: 0.2,
    reason: hasAllowed
      ? "Skill declares which tools it can use (least-privilege)"
      : "Skill does not declare allowed-tools — could run any tool without restriction",
  })

  // ── Factor 3: no risky tools (weight 0.20) ─────────────────────────────────
  const risky = (input.frontmatter.allowedTools ?? []).filter((t) =>
    RISKY_TOOL_RES.some((re) => re.test(t))
  )
  factors.push({
    id: "no_risky_tools",
    passed: risky.length === 0,
    weight: 0.2,
    reason:
      risky.length === 0
        ? "No risky tool patterns detected (rm, curl, wget, wildcard Bash, sudo)"
        : `Uses risky tool patterns: ${risky.join(", ")}`,
  })

  // ── Factor 4: no secrets found (weight 0.20) ──────────────────────────────
  const realSecrets = Math.max(
    0,
    input.secretsCount - (input.docExampleCount ?? 0)
  )
  factors.push({
    id: "no_secrets",
    passed: realSecrets === 0,
    weight: 0.2,
    reason:
      realSecrets === 0
        ? "No secrets detected by gitleaks scan"
        : `${realSecrets} secret-like string${realSecrets !== 1 ? "s" : ""} detected — review before using`,
  })

  // ── Factor 5: recently updated (weight 0.10) ──────────────────────────────
  const fresh = (input.updatedWithinDays ?? 999) <= 90
  factors.push({
    id: "recently_updated",
    passed: fresh,
    weight: 0.1,
    reason: fresh
      ? "Updated within the last 90 days"
      : "Not updated in 90+ days — may be unmaintained",
  })

  const total = Math.round(
    factors.reduce((acc, f) => acc + (f.passed ? f.weight * 100 : 0), 0)
  )

  return { total, factors }
}
