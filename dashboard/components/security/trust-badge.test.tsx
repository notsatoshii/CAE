/**
 * trust-badge.test.tsx — TrustBadge color tier tests.
 *
 * Test 1: score 85 renders green "High trust · 85"
 * Test 2: score 50 renders amber "Medium · 50"
 * Test 3: score 25 renders red "Low · review needed · 25"
 * Test 4: overridden=true renders "Trusted by admin"
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { TrustBadge } from "./trust-badge"
import type { TrustScore } from "@/lib/cae-types"

function makeTrust(total: number, overridden?: boolean): TrustScore {
  return {
    total,
    overridden,
    factors: [{ id: "test", passed: true, weight: 1, reason: "test" }],
  }
}

describe("TrustBadge", () => {
  it("Test 1: score 85 renders 'High trust · 85'", () => {
    render(<TrustBadge trust={makeTrust(85)} />)
    const badge = screen.getByTestId("trust-badge")
    expect(badge.textContent).toContain("High trust")
    expect(badge.textContent).toContain("85")
    expect(badge.className).toContain("emerald")
  })

  it("Test 2: score 50 renders 'Medium · 50'", () => {
    render(<TrustBadge trust={makeTrust(50)} />)
    const badge = screen.getByTestId("trust-badge")
    expect(badge.textContent).toContain("Medium")
    expect(badge.textContent).toContain("50")
    expect(badge.className).toContain("amber")
  })

  it("Test 3: score 25 renders 'Low · review needed · 25'", () => {
    render(<TrustBadge trust={makeTrust(25)} />)
    const badge = screen.getByTestId("trust-badge")
    expect(badge.textContent).toContain("Low")
    expect(badge.textContent).toContain("25")
    expect(badge.className).toContain("red")
  })

  it("Test 4: overridden=true renders 'Trusted by admin'", () => {
    render(<TrustBadge trust={makeTrust(100, true)} />)
    const badge = screen.getByTestId("trust-badge")
    expect(badge.textContent).toContain("Trusted by admin")
    expect(badge.className).toContain("emerald")
  })

  it("boundary: score 80 is green (High trust)", () => {
    render(<TrustBadge trust={makeTrust(80)} />)
    const badge = screen.getByTestId("trust-badge")
    expect(badge.className).toContain("emerald")
  })

  it("boundary: score 79 is amber (Medium)", () => {
    render(<TrustBadge trust={makeTrust(79)} />)
    const badge = screen.getByTestId("trust-badge")
    expect(badge.className).toContain("amber")
  })
})
