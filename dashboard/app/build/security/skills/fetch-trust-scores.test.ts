/**
 * Regression tests for fetchTrustScores.
 *
 * Backstory: C1 audit harness caught SyntaxError: Unexpected token '<'
 * every time /build/security/skills rendered — server-side fetch fell
 * back to localhost:3000 (NEXTAUTH_URL unset; env uses AUTH_URL), which
 * hit a neighbouring static server that returned `<!doctype ...>`,
 * crashing res.json() during server render and 500ing the page.
 *
 * These tests pin the hardening: never throw, never pass HTML to json(),
 * never return non-array.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchTrustScores } from "./fetch-trust-scores"

const ORIG_ENV = { ...process.env }

function mkResponse(
  body: string,
  init: { status?: number; contentType?: string } = {}
): Response {
  const status = init.status ?? 200
  const contentType = init.contentType ?? "application/json"
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  })
}

describe("fetchTrustScores", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
  })
  afterEach(() => {
    process.env = { ...ORIG_ENV }
    vi.restoreAllMocks()
  })

  it("returns parsed array when upstream responds with JSON 200", async () => {
    const payload = [
      {
        skill: {
          name: "deploy",
          owner: "vercel-labs",
          source: "local",
          installed: true,
          description: "",
          installCmd: "",
          detailUrl: "",
        },
        trust: { total: 88, flags: [] },
      },
    ]
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(mkResponse(JSON.stringify(payload)))
    const result = await fetchTrustScores("cookie=abc", fakeFetch as never)
    expect(result).toEqual(payload)
  })

  it("returns [] when upstream returns HTML (wrong-port routing)", async () => {
    // This is the exact failure mode from the C1 audit.
    const html =
      '<!doctype html><html><head><title>LEVER</title></head></html>'
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(mkResponse(html, { contentType: "text/html; charset=utf-8" }))
    const result = await fetchTrustScores("cookie=abc", fakeFetch as never)
    expect(result).toEqual([])
  })

  it("returns [] when upstream 500s with HTML body", async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      mkResponse("<!doctype html>boom", {
        status: 500,
        contentType: "text/html",
      })
    )
    const result = await fetchTrustScores("cookie=abc", fakeFetch as never)
    expect(result).toEqual([])
  })

  it("returns [] when JSON parse fails even with JSON content-type", async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(mkResponse("not json at all {", {}))
    const result = await fetchTrustScores("cookie=abc", fakeFetch as never)
    expect(result).toEqual([])
  })

  it("returns [] when fetch rejects (network error)", async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
    const result = await fetchTrustScores("cookie=abc", fakeFetch as never)
    expect(result).toEqual([])
  })

  it("returns [] when payload is JSON but not an array", async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(mkResponse(JSON.stringify({ error: "x" })))
    const result = await fetchTrustScores("cookie=abc", fakeFetch as never)
    expect(result).toEqual([])
  })

  it("prefers AUTH_URL over NEXTAUTH_URL and localhost fallback", async () => {
    process.env.AUTH_URL = "http://example.test:9999"
    process.env.NEXTAUTH_URL = "http://should-not-use:1234"
    const fakeFetch = vi.fn().mockResolvedValue(mkResponse("[]"))
    await fetchTrustScores("cookie=abc", fakeFetch as never)
    expect(fakeFetch).toHaveBeenCalledWith(
      "http://example.test:9999/api/security/trust",
      expect.any(Object)
    )
  })

  it("falls back to NEXTAUTH_URL when AUTH_URL absent", async () => {
    delete process.env.AUTH_URL
    process.env.NEXTAUTH_URL = "http://legacy.test:8888"
    const fakeFetch = vi.fn().mockResolvedValue(mkResponse("[]"))
    await fetchTrustScores("cookie=abc", fakeFetch as never)
    expect(fakeFetch).toHaveBeenCalledWith(
      "http://legacy.test:8888/api/security/trust",
      expect.any(Object)
    )
  })

  it("forwards the provided cookie header to fetch", async () => {
    const fakeFetch = vi.fn().mockResolvedValue(mkResponse("[]"))
    await fetchTrustScores("authjs.session-token=xyz", fakeFetch as never)
    expect(fakeFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Cookie: "authjs.session-token=xyz" },
        cache: "no-store",
      })
    )
  })
})
