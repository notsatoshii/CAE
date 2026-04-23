// @vitest-environment node
/**
 * audit/fixtures/persona-access.test.ts — Phase 15 C2 Wave, Class 4A.
 *
 * Pins the persona × route expectation matrix so future middleware
 * changes surface as test failures instead of silent scorer drift.
 */
import { describe, expect, it } from "vitest"
import { ROUTES } from "../routes"
import { PERSONAS } from "../personas"
import {
  PERSONA_ACCESS,
  buildPersonaAccessMatrix,
  expectedAccessFor,
  lookupAccess,
} from "./persona-access"

describe("persona-access matrix", () => {
  it("is fully populated for every persona × route pair", () => {
    const matrix = buildPersonaAccessMatrix()
    for (const persona of PERSONAS) {
      for (const route of ROUTES) {
        expect(
          matrix[persona.id]?.[route.slug],
          `missing (${persona.id}, ${route.slug})`,
        ).toBeDefined()
      }
    }
  })

  it("renders public routes for every persona (including no-session)", () => {
    for (const slug of ["root", "signin", "403"]) {
      for (const p of PERSONAS) {
        expect(lookupAccess(p.id, slug)).toBe("render")
      }
    }
  })

  it("redirects no-session personas away from every auth-required route", () => {
    const noSession = PERSONAS.find((p) => p.role === "none")
    expect(noSession, "personas.ts must define exactly one role:none persona").toBeDefined()
    const authRequired = ROUTES.filter((r) => r.authRequired)
    for (const route of authRequired) {
      expect(
        lookupAccess(noSession!.id, route.slug),
        `expected ${noSession!.id} → ${route.slug} to redirect`,
      ).toBe("redirect")
    }
  })

  it("gates /build/admin/roles for every non-admin role", () => {
    for (const p of PERSONAS) {
      const got = lookupAccess(p.id, "build-admin-roles")
      if (p.role === "admin") expect(got).toBe("render")
      else if (p.role === "none") expect(got).toBe("redirect")
      else expect(got).toBe("gate")
    }
  })

  it("gates /build/security/audit for viewer-role personas only", () => {
    for (const p of PERSONAS) {
      const got = lookupAccess(p.id, "build-security-audit")
      if (p.role === "admin" || p.role === "operator") expect(got).toBe("render")
      else if (p.role === "viewer") expect(got).toBe("gate")
      else if (p.role === "none") expect(got).toBe("redirect")
    }
  })

  it("renders /plan, /build, /memory, /metrics for every signed-in persona", () => {
    const slugs = ["plan", "build", "memory", "metrics", "chat", "floor"]
    for (const p of PERSONAS) {
      if (p.role === "none") continue
      for (const slug of slugs) {
        expect(
          lookupAccess(p.id, slug),
          `expected ${p.id} → ${slug} to render`,
        ).toBe("render")
      }
    }
  })

  it("expectedAccessFor is pure (stable under re-invocation)", () => {
    const p = PERSONAS[0]
    const r = ROUTES[0]
    expect(expectedAccessFor(p, r)).toBe(expectedAccessFor(p, r))
  })

  it("PERSONA_ACCESS matches buildPersonaAccessMatrix()", () => {
    expect(PERSONA_ACCESS).toStrictEqual(buildPersonaAccessMatrix())
  })

  it("lookupAccess returns undefined for unknown keys", () => {
    expect(lookupAccess("admin" as never, "does-not-exist")).toBeUndefined()
    expect(lookupAccess("no-such-persona" as never, "root")).toBeUndefined()
  })

  it("summary counts: admin renders every route; founder-first-time redirects on all authed routes", () => {
    const adminRenders = ROUTES.filter(
      (r) => lookupAccess("admin", r.slug) === "render",
    ).length
    expect(adminRenders).toBe(ROUTES.length)

    const ffRedirects = ROUTES.filter(
      (r) => lookupAccess("founder-first-time", r.slug) === "redirect",
    ).length
    const authedCount = ROUTES.filter((r) => r.authRequired).length
    expect(ffRedirects).toBe(authedCount)
  })
})
