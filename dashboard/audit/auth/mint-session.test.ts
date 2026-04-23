// @vitest-environment node
// Needs node env, not jsdom: jose's JWE encrypt checks Uint8Array via
// instanceof against the realm's constructor. jsdom swaps the globals so
// Buffer→Uint8Array coercion fails the instanceof check and throws
// "plaintext must be an instance of Uint8Array".
/**
 * mint-session.test.ts — unit coverage for the audit auth-cookie minter.
 *
 * Verifies:
 *   1. Output shape matches Playwright `storageState` (cookies + origins).
 *   2. Cookie attributes match defaultCookies(useSecureCookies=false) for
 *      http base URL — name, httpOnly, sameSite, secure=false.
 *   3. https base URL switches to the __Secure- prefix and secure=true.
 *   4. Token round-trips through @auth/core/jwt decode() with the same
 *      secret + salt and yields the email/role/sub fields we put in.
 *   5. Decoding with the wrong secret throws (negative case).
 */
import { describe, expect, it } from "vitest"
// Use `next-auth/jwt` (re-exports `@auth/core/jwt`). next-auth is the
// top-level dep; @auth/core is only transitive under pnpm, so direct
// `@auth/core/jwt` imports fail TS module resolution.
import { decode } from "next-auth/jwt"
import { mintSessionState } from "./mint-session"

const SECRET = "test-secret-not-for-prod-1234567890"

describe("mintSessionState", () => {
  it("emits Playwright storageState shape with one cookie + empty origins", async () => {
    const state = await mintSessionState({
      baseUrl: "http://localhost:3002",
      secret: SECRET,
    })
    expect(Array.isArray(state.cookies)).toBe(true)
    expect(state.cookies).toHaveLength(1)
    expect(state.origins).toEqual([])
  })

  it("uses the http (insecure) cookie name + attributes for http base URL", async () => {
    const state = await mintSessionState({
      baseUrl: "http://localhost:3002",
      secret: SECRET,
    })
    const cookie = state.cookies[0]
    expect(cookie.name).toBe("authjs.session-token")
    expect(cookie.domain).toBe("localhost")
    expect(cookie.path).toBe("/")
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.secure).toBe(false)
    expect(cookie.sameSite).toBe("Lax")
    expect(typeof cookie.value).toBe("string")
    // JWE compact serialization is 5 base64url segments separated by dots.
    expect(cookie.value.split(".")).toHaveLength(5)
    expect(cookie.expires).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it("uses the __Secure- prefix and secure=true for https base URL", async () => {
    const state = await mintSessionState({
      baseUrl: "https://dashboard.example.com",
      secret: SECRET,
    })
    const cookie = state.cookies[0]
    expect(cookie.name).toBe("__Secure-authjs.session-token")
    expect(cookie.domain).toBe("dashboard.example.com")
    expect(cookie.secure).toBe(true)
  })

  it("token round-trips through @auth/core/jwt decode with same secret + salt", async () => {
    const state = await mintSessionState({
      baseUrl: "http://localhost:3002",
      secret: SECRET,
      email: "harness@cae.local",
      role: "admin",
      sub: "harness-cae-audit",
    })
    const cookie = state.cookies[0]
    const payload = await decode<{
      email?: string
      role?: string
      sub?: string
    }>({
      token: cookie.value,
      secret: SECRET,
      salt: cookie.name,
    })
    expect(payload).not.toBeNull()
    expect(payload!.email).toBe("harness@cae.local")
    expect(payload!.role).toBe("admin")
    expect(payload!.sub).toBe("harness-cae-audit")
  })

  it("normalises email to lowercase to match the runtime jwt callback", async () => {
    const state = await mintSessionState({
      baseUrl: "http://localhost:3002",
      secret: SECRET,
      email: "HARNESS@CAE.local",
    })
    const cookie = state.cookies[0]
    const payload = await decode<{ email?: string }>({
      token: cookie.value,
      secret: SECRET,
      salt: cookie.name,
    })
    expect(payload!.email).toBe("harness@cae.local")
  })

  it("decoding with the wrong secret returns null", async () => {
    const state = await mintSessionState({
      baseUrl: "http://localhost:3002",
      secret: SECRET,
    })
    const cookie = state.cookies[0]
    // @auth/core/jwt.decode swallows decryption failures internally only when
    // called via getToken — calling decode() directly with a bad secret
    // throws. Wrap and assert the throw shape.
    await expect(
      decode({
        token: cookie.value,
        secret: "another-secret-entirely-zzzzzzzzzz",
        salt: cookie.name,
      }),
    ).rejects.toBeDefined()
  })

  it("rejects an unsupported base URL protocol", async () => {
    await expect(
      mintSessionState({ baseUrl: "ftp://localhost", secret: SECRET }),
    ).rejects.toThrow(/http/i)
  })
})
