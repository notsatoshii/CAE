// @vitest-environment node
/**
 * audit/personas.test.ts — Phase 15 Cap.2.
 *
 * Imports resolve, arrays non-empty, cookie builder behaves for the
 * no-auth persona (returns []) and for a role persona (returns a single
 * Auth.js v5 session cookie).
 */
import { describe, expect, it } from "vitest"
import { PERSONAS, buildPersonaCookies } from "./personas"
import { VIEWPORTS } from "./viewports"

const SECRET = "test-secret-not-for-prod-1234567890"
const BASE_URL = "http://localhost:3002"

describe("PERSONAS", () => {
  it("has exactly 6 personas", () => {
    expect(PERSONAS).toHaveLength(6)
  })

  it("each persona has a unique id and filesystem-safe name", () => {
    const ids = PERSONAS.map((p) => p.id)
    const names = PERSONAS.map((p) => p.name)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(names).size).toBe(names.length)
    for (const p of PERSONAS) {
      expect(p.name).toMatch(/^[a-z0-9][a-z0-9-]*$/)
    }
  })

  it("buildPersonaCookies returns [] for the no-auth persona", async () => {
    const firstTime = PERSONAS.find((p) => p.role === "none")!
    const cookies = await buildPersonaCookies(firstTime, {
      secret: SECRET,
      baseUrl: BASE_URL,
    })
    expect(cookies).toEqual([])
  })

  it("buildPersonaCookies returns one Auth.js cookie for admin persona", async () => {
    const admin = PERSONAS.find((p) => p.role === "admin")!
    const cookies = await buildPersonaCookies(admin, {
      secret: SECRET,
      baseUrl: BASE_URL,
    })
    expect(cookies).toHaveLength(1)
    expect(cookies[0].name).toBe("authjs.session-token")
    expect(cookies[0].domain).toBe("localhost")
    expect(cookies[0].path).toBe("/")
    expect(typeof cookies[0].value).toBe("string")
    // JWE has 5 base64url segments.
    expect(String(cookies[0].value).split(".")).toHaveLength(5)
  })
})

describe("VIEWPORTS", () => {
  it("is non-empty", () => {
    expect(VIEWPORTS.length).toBeGreaterThan(0)
  })

  it("every viewport has positive width + height and unique name", () => {
    for (const v of VIEWPORTS) {
      expect(v.size.width).toBeGreaterThan(0)
      expect(v.size.height).toBeGreaterThan(0)
      expect(v.name).toMatch(/^[a-z0-9][a-z0-9-]*$/)
    }
    const names = VIEWPORTS.map((v) => v.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
