/**
 * trust-grid.test.tsx — TrustGrid row rendering + expand tests.
 *
 * Test 2: TrustGrid renders one row per skill; click row expands factor list.
 */
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TrustGrid } from "./trust-grid"
import type { CatalogSkill, TrustScore, Role } from "@/lib/cae-types"

const SKILL: CatalogSkill = {
  name: "deploy",
  owner: "vercel-labs",
  source: "local",
  description: "Deploy skill",
  installCmd: "npx skills add vercel-labs/deploy",
  detailUrl: "file:///tmp",
  installed: true,
}

const TRUST: TrustScore = {
  total: 85,
  factors: [
    { id: "trusted_owner", passed: true, weight: 0.3, reason: "vercel-labs is trusted" },
    { id: "no_secrets", passed: true, weight: 0.2, reason: "No secrets found" },
  ],
}

describe("TrustGrid", () => {
  it("Test 2: renders one row per skill with score", () => {
    render(
      <TrustGrid
        entries={[{ skill: SKILL, trust: TRUST }]}
        currentRole="operator"
      />
    )

    expect(screen.getByText("deploy")).toBeDefined()
    // Score should appear
    expect(screen.getByText(/85/)).toBeDefined()
  })

  it("Test 2b: click row expands factor list", () => {
    render(
      <TrustGrid
        entries={[{ skill: SKILL, trust: TRUST }]}
        currentRole="operator"
      />
    )

    // Initially factors not visible
    expect(screen.queryByText("vercel-labs is trusted")).toBeNull()

    // Click the row
    const row = screen.getByTestId(`trust-row-${SKILL.name}`)
    fireEvent.click(row)

    // Factors now visible
    expect(screen.getByText("vercel-labs is trusted")).toBeDefined()
  })

  it("Test 2c: admin sees override button, operator does not", () => {
    const { rerender } = render(
      <TrustGrid
        entries={[{ skill: SKILL, trust: TRUST }]}
        currentRole="admin"
      />
    )

    // Expand to see override button
    const row = screen.getByTestId(`trust-row-${SKILL.name}`)
    fireEvent.click(row)
    expect(screen.getByTestId("trust-override-btn")).toBeDefined()

    // Re-render as operator
    rerender(
      <TrustGrid
        entries={[{ skill: SKILL, trust: TRUST }]}
        currentRole="operator"
      />
    )
    expect(screen.queryByTestId("trust-override-btn")).toBeNull()
  })
})
