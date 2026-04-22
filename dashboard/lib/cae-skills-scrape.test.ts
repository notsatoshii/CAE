import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"
import { fetchSkillsSh } from "./cae-skills-scrape-shsh"
import { fetchClawHub } from "./cae-skills-scrape-clawhub"

const FIXTURE_DIR = path.join(__dirname, "../tests/fixtures/skills")

function makeFetchMock(htmlPath: string) {
  const html = fs.readFileSync(htmlPath, "utf8")
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(html),
  })
}

describe("fetchSkillsSh", () => {
  it("Test 1: parses 3 skill cards from skills-sh-trending.html fixture", async () => {
    const mockFetch = makeFetchMock(
      path.join(FIXTURE_DIR, "skills-sh-trending.html")
    )
    const skills = await fetchSkillsSh(undefined, mockFetch as typeof fetch)
    expect(skills).toHaveLength(3)

    const first = skills[0]
    expect(first.name).toBe("agent-skills")
    expect(first.owner).toBe("vercel-labs")
    expect(first.source).toBe("skills.sh")
    expect(first.description).toBe(
      "Reusable agent skills for Claude Code workflows"
    )
    expect(typeof first.installs).toBe("number")
    expect(first.installs).toBe(12453)
    expect(first.installCmd).toBe("npx skills add vercel-labs/agent-skills")
    expect(first.detailUrl).toBe("https://skills.sh/vercel-labs/agent-skills")
    expect(first.installed).toBe(false)
  })

  it("Test 1b: all 3 skills have correct source and install commands", async () => {
    const mockFetch = makeFetchMock(
      path.join(FIXTURE_DIR, "skills-sh-trending.html")
    )
    const skills = await fetchSkillsSh(undefined, mockFetch as typeof fetch)
    for (const s of skills) {
      expect(s.source).toBe("skills.sh")
      expect(s.installCmd).toBe(
        `npx skills add ${s.owner}/${s.name}`
      )
      expect(s.installed).toBe(false)
    }
  })

  it("Test 1c: returns [] when fetch returns non-2xx (graceful degradation)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve(""),
    })
    const skills = await fetchSkillsSh(undefined, mockFetch as typeof fetch)
    expect(skills).toEqual([])
  })
})

describe("fetchClawHub", () => {
  it("Test 2: parses 3 skill cards from clawhub-skills.html fixture", async () => {
    const mockFetch = makeFetchMock(
      path.join(FIXTURE_DIR, "clawhub-skills.html")
    )
    const skills = await fetchClawHub(undefined, mockFetch as typeof fetch)
    expect(skills).toHaveLength(3)

    const first = skills[0]
    expect(first.name).toBe("pr-review")
    expect(first.owner).toBe("community")
    expect(first.source).toBe("clawhub")
    expect(first.description).toContain("pull request review")
    expect(typeof first.stars).toBe("number")
    expect(first.stars).toBe(342)
    expect(first.installCmd).toBe("npx skills add community/pr-review")
    expect(first.installed).toBe(false)
  })

  it("Test 2b: all 3 ClawHub skills have correct source", async () => {
    const mockFetch = makeFetchMock(
      path.join(FIXTURE_DIR, "clawhub-skills.html")
    )
    const skills = await fetchClawHub(undefined, mockFetch as typeof fetch)
    for (const s of skills) {
      expect(s.source).toBe("clawhub")
    }
  })

  it("Test 2c: returns [] on fetch error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve(""),
    })
    const skills = await fetchClawHub(undefined, mockFetch as typeof fetch)
    expect(skills).toEqual([])
  })
})
