/**
 * app/api/logs/stream/route.test.ts — Phase 15 Wave 5.1.
 *
 * Coverage:
 *   - encodeLogFrame produces a well-formed SSE frame per source
 *   - JSON payload roundtrips (source / raw / receivedAt)
 *   - heartbeat frames carry an ISO timestamp
 *   - GET requires viewer role minimum
 *   - GET returns text/event-stream with the right headers
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { encodeLogFrame } from "./route"

// next-auth modules — keep auth() mockable.
vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() }),
}))
vi.mock("next-auth/providers/github", () => ({ default: {} }))
vi.mock("next-auth/providers/google", () => ({
  default: (_opts?: unknown) => ({ id: "google", type: "oauth" }),
}))

// vi.mock is hoisted above top-level declarations — use vi.hoisted() so the
// mock factory can reach mockAuth without a TDZ error.
const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }))
vi.mock("@/auth", () => ({
  auth: mockAuth,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}))

// Stub listProjects so we don't touch the filesystem in unit tests.
vi.mock("@/lib/cae-state", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cae-state")>(
    "@/lib/cae-state",
  )
  return {
    ...actual,
    listProjects: vi.fn().mockResolvedValue([]),
  }
})

// Stub the tail-stream so no fs.watch is created in unit tests.
vi.mock("@/lib/tail-stream", () => ({
  createTailStream: vi.fn(() =>
    new ReadableStream<string>({
      start(c) {
        c.close()
      },
    }),
  ),
}))

describe("encodeLogFrame", () => {
  it("emits an event line with the source name", () => {
    const frame = encodeLogFrame("tail", "hello", 1000)
    expect(frame.startsWith("event: tail\n")).toBe(true)
    expect(frame.endsWith("\n\n")).toBe(true)
  })

  it("payload roundtrips through JSON.parse", () => {
    const frame = encodeLogFrame("tool", "raw line", 12345)
    const dataLine = frame.split("\n").find((l) => l.startsWith("data: "))
    expect(dataLine).toBeTruthy()
    const json = JSON.parse(dataLine!.slice("data: ".length))
    expect(json).toEqual({ source: "tool", raw: "raw line", receivedAt: 12345 })
  })

  it("supports the heartbeat synthetic source", () => {
    const frame = encodeLogFrame("heartbeat", '{"ts":"2026-04-23T10:00:00Z"}', 9999)
    expect(frame.includes("event: heartbeat")).toBe(true)
    const dataLine = frame.split("\n").find((l) => l.startsWith("data: "))!
    const json = JSON.parse(dataLine.slice("data: ".length))
    expect(json.source).toBe("heartbeat")
    expect(JSON.parse(json.raw).ts).toBe("2026-04-23T10:00:00Z")
  })

  it("preserves multi-line raw payloads (data field is JSON-encoded so newlines escape)", () => {
    const raw = "line1\nline2"
    const frame = encodeLogFrame("tail", raw, 1)
    // The frame body itself must contain only ONE `data: ` line —
    // newlines inside `raw` are escaped by JSON.stringify.
    const dataLines = frame.split("\n").filter((l) => l.startsWith("data: "))
    expect(dataLines).toHaveLength(1)
    const json = JSON.parse(dataLines[0].slice("data: ".length))
    expect(json.raw).toBe(raw)
  })
})

describe("GET /api/logs/stream — RBAC", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("viewer (or above) gets 200 + text/event-stream", async () => {
    mockAuth.mockResolvedValue({
      user: { email: "v@example.com", role: "viewer" },
      expires: "2099-01-01",
    })
    const { GET } = await import("./route")
    const req = new NextRequest("http://localhost/api/logs/stream")
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/event-stream")
    expect(res.headers.get("cache-control")).toContain("no-cache")
    // Drain the body so we don't leak the underlying ReadableStream.
    await res.body?.cancel()
  })

  it("unauthenticated gets 403", async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import("./route")
    const req = new NextRequest("http://localhost/api/logs/stream")
    const res = await GET(req)
    expect(res.status).toBe(403)
  })
})
