/**
 * Tests for GET /api/security/trust and POST /api/security/trust-override
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() }),
}))
vi.mock("next-auth/providers/github", () => ({ default: {} }))
vi.mock("next-auth/providers/google", () => ({
  default: (_opts?: unknown) => ({ id: "google", type: "oauth" }),
}))

const mockAuth = vi.fn()
vi.mock("@/auth", () => ({
  auth: mockAuth,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}))

vi.mock("@/lib/cae-trust-overrides", () => ({
  readOverrides: vi.fn().mockResolvedValue(new Set()),
  writeOverride: vi.fn().mockResolvedValue(undefined),
  overrideKey: vi.fn((o: string, n: string) => `${o}/${n}`.toLowerCase()),
}))

vi.mock("@/lib/cae-skills-local", () => ({
  readLocalSkillsDir: vi.fn().mockResolvedValue([
    { name: "deploy", owner: "vercel-labs", source: "local", installed: true,
      description: "Deploy", installCmd: "npx skills add vercel-labs/deploy",
      detailUrl: "file:///tmp" },
  ]),
}))

vi.mock("@/lib/cae-skills-parse", () => ({
  parseSkillMd: vi.fn().mockReturnValue({
    frontmatter: { disableModelInvocation: true, allowedTools: ["Bash(git add *)"] },
    body: "",
  }),
}))

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return { ...actual, readFile: vi.fn().mockResolvedValue("") }
})

vi.mock("@/lib/cae-secrets-scan", () => ({
  scanSkill: vi.fn(),
  appendScan: vi.fn(),
}))

describe("GET /api/security/trust", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockResolvedValue({
      user: { email: "test@example.com", role: "operator" },
      expires: "2099-01-01",
    })
  })

  it("Test 1: returns 200 with TrustScore array for authenticated user", async () => {
    const { GET } = await import("./route")
    const req = new NextRequest("http://localhost/api/security/trust")
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    if (body.length > 0) {
      expect(body[0]).toHaveProperty("skill")
      expect(body[0]).toHaveProperty("trust")
      expect(typeof body[0].trust.total).toBe("number")
    }
  })

  it("Test 1b: returns 403 for unauthenticated request", async () => {
    mockAuth.mockResolvedValueOnce(null)
    const { GET } = await import("./route")
    const req = new NextRequest("http://localhost/api/security/trust")
    const res = await GET(req)
    expect(res.status).toBe(403)
  })
})
