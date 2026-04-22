import { describe, it, expect, vi, beforeEach } from "vitest"
import type { CatalogSkill } from "@/lib/cae-types"
import { NextRequest } from "next/server"

// Mock the catalog module
vi.mock("@/lib/cae-skills-catalog", () => ({
  getCatalog: vi.fn(),
}))

const MOCK_SKILLS: CatalogSkill[] = [
  {
    name: "agent-skills",
    owner: "vercel-labs",
    source: "skills.sh",
    description: "Reusable agent skills",
    installCmd: "npx skills add vercel-labs/agent-skills",
    detailUrl: "https://skills.sh/vercel-labs/agent-skills",
    installed: false,
    installs: 1000,
  },
  {
    name: "my-local-skill",
    owner: "local",
    source: "local",
    description: "A local skill",
    installCmd: "already installed",
    detailUrl: "file:///home/user/.claude/skills/my-local-skill",
    installed: true,
  },
]

describe("GET /api/skills", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("Test 3: returns 200 + JSON array of CatalogSkill", async () => {
    const { getCatalog } = await import("@/lib/cae-skills-catalog")
    vi.mocked(getCatalog).mockResolvedValue(MOCK_SKILLS)

    const { GET } = await import("./route")
    const req = new NextRequest("http://localhost/api/skills")
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)
  })

  it("Test 3b: passes q param to getCatalog", async () => {
    const { getCatalog } = await import("@/lib/cae-skills-catalog")
    vi.mocked(getCatalog).mockResolvedValue([])

    const { GET } = await import("./route")
    const req = new NextRequest("http://localhost/api/skills?q=agent")
    await GET(req)

    expect(getCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ q: "agent" })
    )
  })

  it("Test 3c: returns 200 with partial list when scraper errors (getCatalog handles degradation)", async () => {
    const { getCatalog } = await import("@/lib/cae-skills-catalog")
    vi.mocked(getCatalog).mockResolvedValue([MOCK_SKILLS[0]])

    const { GET } = await import("./route")
    const req = new NextRequest("http://localhost/api/skills")
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })
})
