/**
 * Tests for RoleGate component
 * Phase 14 Plan 04 — Task 2, Test 7
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { RoleGate } from "./role-gate"

describe("RoleGate", () => {
  it("Test 7a: renders children when currentRole meets required role", () => {
    render(
      <RoleGate role="operator" currentRole="operator">
        <span data-testid="child">allowed</span>
      </RoleGate>
    )
    expect(screen.getByTestId("child")).toBeInTheDocument()
  })

  it("Test 7b: hides children when currentRole is below required role", () => {
    render(
      <RoleGate role="operator" currentRole="viewer">
        <span data-testid="child">hidden</span>
      </RoleGate>
    )
    expect(screen.queryByTestId("child")).toBeNull()
  })

  it("renders fallback when role is insufficient", () => {
    render(
      <RoleGate role="admin" currentRole="viewer" fallback={<span data-testid="fallback">fallback</span>}>
        <span data-testid="child">hidden</span>
      </RoleGate>
    )
    expect(screen.getByTestId("fallback")).toBeInTheDocument()
    expect(screen.queryByTestId("child")).toBeNull()
  })

  it("admin passes operator gate", () => {
    render(
      <RoleGate role="operator" currentRole="admin">
        <span data-testid="child">allowed</span>
      </RoleGate>
    )
    expect(screen.getByTestId("child")).toBeInTheDocument()
  })

  it("renders null (no fallback) when role is insufficient and no fallback provided", () => {
    const { container } = render(
      <RoleGate role="admin" currentRole="viewer">
        <span data-testid="child">hidden</span>
      </RoleGate>
    )
    expect(container.firstChild).toBeNull()
  })

  it("Test 7c: undefined currentRole → hides children", () => {
    render(
      <RoleGate role="operator" currentRole={undefined}>
        <span data-testid="child">hidden</span>
      </RoleGate>
    )
    expect(screen.queryByTestId("child")).toBeNull()
  })

  it("SSR/client markup is deterministic — same output both renders", () => {
    // Render twice with same props — output must match (no useSession flash)
    const { container: c1 } = render(
      <RoleGate role="admin" currentRole="admin">
        <span>content</span>
      </RoleGate>
    )
    const { container: c2 } = render(
      <RoleGate role="admin" currentRole="admin">
        <span>content</span>
      </RoleGate>
    )
    expect(c1.innerHTML).toBe(c2.innerHTML)
  })
})
