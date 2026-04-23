// @vitest-environment node
/**
 * audit/routes.test.ts — Phase 15 Cap.2.
 *
 * Sanity checks on the ROUTES array. No mocking, no fs — just in-memory
 * invariants so a bad hand-edit fails CI.
 */
import { describe, expect, it } from "vitest"
import { ROUTES } from "./routes"

describe("ROUTES", () => {
  it("is non-empty", () => {
    expect(ROUTES.length).toBeGreaterThan(0)
  })

  it("every path starts with /", () => {
    for (const r of ROUTES) {
      expect(r.path.startsWith("/")).toBe(true)
    }
  })

  it("every slug is unique", () => {
    const slugs = ROUTES.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("every slug is filesystem-safe (no slashes, no spaces)", () => {
    for (const r of ROUTES) {
      expect(r.slug).toMatch(/^[a-z0-9][a-z0-9-]*$/)
    }
  })

  it("every route lists at least one persona", () => {
    for (const r of ROUTES) {
      expect(r.personas.length).toBeGreaterThan(0)
    }
  })

  it("authRequired=false only for the 3 known public routes", () => {
    const publicPaths = ROUTES.filter((r) => !r.authRequired).map((r) => r.path).sort()
    expect(publicPaths).toEqual(["/", "/403", "/signin"])
  })
})
