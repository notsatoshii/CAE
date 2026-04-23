/**
 * cae-skills-trust.test.ts — Unit tests for trust score computation.
 *
 * Behaviors tested:
 *   1. Trusted owner + safe tools + clean scan → total ≥ 80
 *   2. Random owner + no allowed-tools + gitleaks finding → total < 40
 *   3. Overridden skill → total = 100, overridden = true
 *   4. Dangerous tool patterns → "no_risky_tools" factor passed = false
 */
import { describe, it, expect } from "vitest"
import { computeTrustScore, type TrustInput } from "./cae-skills-trust"

const TRUSTED_SKILL = { owner: "vercel-labs", name: "agent-skills" }
const RANDOM_SKILL = { owner: "random-user", name: "cleanup" }

describe("computeTrustScore", () => {
  it("Test 1: trusted owner + safe tools + clean scan → total ≥ 80", () => {
    const input: TrustInput = {
      skill: TRUSTED_SKILL,
      frontmatter: {
        disableModelInvocation: true,
        allowedTools: ["Bash(git add *)", "Bash(npm run build)"],
      },
      secretsCount: 0,
      docExampleCount: 0,
      overridden: false,
      updatedWithinDays: 30,
    }
    const result = computeTrustScore(input)
    expect(result.total).toBeGreaterThanOrEqual(80)
    expect(result.factors.length).toBeGreaterThan(0)
    expect(result.factors.every((f) => typeof f.reason === "string")).toBe(true)
    // trusted_owner factor should pass
    const ownerFactor = result.factors.find((f) => f.id === "trusted_owner")
    expect(ownerFactor).toBeDefined()
    expect(ownerFactor?.passed).toBe(true)
  })

  it("Test 2: random owner + empty allowedTools + finding → total < 40", () => {
    const input: TrustInput = {
      skill: RANDOM_SKILL,
      frontmatter: {
        disableModelInvocation: false,
        allowedTools: [],
      },
      secretsCount: 2,
      docExampleCount: 0,
      overridden: false,
      updatedWithinDays: 200,
    }
    const result = computeTrustScore(input)
    expect(result.total).toBeLessThan(40)
    const secretFactor = result.factors.find((f) => f.id === "no_secrets")
    expect(secretFactor?.passed).toBe(false)
  })

  it("Test 3: overridden skill → total = 100, overridden = true", () => {
    const input: TrustInput = {
      skill: RANDOM_SKILL,
      frontmatter: {
        disableModelInvocation: false,
        allowedTools: [],
      },
      secretsCount: 5,
      overridden: true,
    }
    const result = computeTrustScore(input)
    expect(result.total).toBe(100)
    expect(result.overridden).toBe(true)
    const adminFactor = result.factors.find((f) => f.id === "admin_override")
    expect(adminFactor).toBeDefined()
    expect(adminFactor?.passed).toBe(true)
  })

  it("Test 4: dangerous tool patterns → risky_tools factor passed = false", () => {
    const input: TrustInput = {
      skill: TRUSTED_SKILL,
      frontmatter: {
        disableModelInvocation: true,
        allowedTools: ["Bash(rm *)", "Bash(curl *)", "Bash(npm run build)"],
      },
      secretsCount: 0,
      overridden: false,
    }
    const result = computeTrustScore(input)
    const riskyFactor = result.factors.find((f) => f.id === "no_risky_tools")
    expect(riskyFactor?.passed).toBe(false)
    expect(riskyFactor?.reason).toContain("Bash(rm *)")
  })

  it("doc examples excluded from real secrets count", () => {
    const input: TrustInput = {
      skill: TRUSTED_SKILL,
      frontmatter: {
        disableModelInvocation: true,
        allowedTools: ["Bash(git add *)"],
      },
      secretsCount: 3,
      docExampleCount: 3, // all are doc examples → no real secrets
      overridden: false,
    }
    const result = computeTrustScore(input)
    const secretFactor = result.factors.find((f) => f.id === "no_secrets")
    expect(secretFactor?.passed).toBe(true)
  })

  it("score structure: total is integer 0-100 and weights sum to 1", () => {
    const input: TrustInput = {
      skill: TRUSTED_SKILL,
      frontmatter: { disableModelInvocation: true, allowedTools: [] },
      secretsCount: 0,
    }
    const result = computeTrustScore(input)
    expect(result.total).toBeGreaterThanOrEqual(0)
    expect(result.total).toBeLessThanOrEqual(100)
    expect(Number.isInteger(result.total)).toBe(true)
    const weightSum = result.factors.reduce((acc, f) => acc + f.weight, 0)
    expect(weightSum).toBeCloseTo(1.0, 5)
  })
})
