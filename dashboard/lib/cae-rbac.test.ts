/**
 * Tests for lib/cae-rbac.ts
 * Phase 14 Plan 04 — RBAC role resolution helpers
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// We import after stubbing env
describe("resolveRole", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAILS", "eric@diiant.com,  alice@diiant.com ")
    vi.stubEnv("OPERATOR_EMAILS", "op@example.com, contractor@example.com")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("Test 1: returns admin for admin email", async () => {
    const { resolveRole } = await import("./cae-rbac")
    expect(resolveRole("eric@diiant.com")).toBe("admin")
  })

  it("Test 2: returns operator for operator email", async () => {
    const { resolveRole } = await import("./cae-rbac")
    expect(resolveRole("op@example.com")).toBe("operator")
  })

  it("Test 3: returns viewer for unknown email", async () => {
    const { resolveRole } = await import("./cae-rbac")
    expect(resolveRole("random@example.com")).toBe("viewer")
  })

  it("Test 4: returns viewer for null", async () => {
    const { resolveRole } = await import("./cae-rbac")
    expect(resolveRole(null)).toBe("viewer")
  })

  it("Test 5: trims whitespace in env list and is case-insensitive", async () => {
    const { resolveRole } = await import("./cae-rbac")
    // alice@diiant.com has surrounding spaces in env — should still match
    expect(resolveRole("ALICE@DIIANT.COM")).toBe("admin")
    // contractor has space before it
    expect(resolveRole("CONTRACTOR@EXAMPLE.COM")).toBe("operator")
  })
})

describe("isAtLeast", () => {
  it("Test 6a: operator is at least viewer", async () => {
    const { isAtLeast } = await import("./cae-rbac")
    expect(isAtLeast("operator", "viewer")).toBe(true)
  })

  it("Test 6b: viewer is NOT at least operator", async () => {
    const { isAtLeast } = await import("./cae-rbac")
    expect(isAtLeast("viewer", "operator")).toBe(false)
  })

  it("Test 6c: admin is at least admin", async () => {
    const { isAtLeast } = await import("./cae-rbac")
    expect(isAtLeast("admin", "admin")).toBe(true)
  })

  it("admin is at least operator", async () => {
    const { isAtLeast } = await import("./cae-rbac")
    expect(isAtLeast("admin", "operator")).toBe(true)
  })

  it("viewer is not at least admin", async () => {
    const { isAtLeast } = await import("./cae-rbac")
    expect(isAtLeast("viewer", "admin")).toBe(false)
  })
})

describe("requireRole", () => {
  it("returns true when current role meets required", async () => {
    const { requireRole } = await import("./cae-rbac")
    expect(requireRole("admin", "operator")).toBe(true)
  })

  it("returns false when current role is insufficient", async () => {
    const { requireRole } = await import("./cae-rbac")
    expect(requireRole("viewer", "operator")).toBe(false)
  })

  it("returns false when role is undefined", async () => {
    const { requireRole } = await import("./cae-rbac")
    expect(requireRole(undefined, "viewer")).toBe(false)
  })
})
