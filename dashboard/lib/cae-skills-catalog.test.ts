import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"
import type { CatalogSkill } from "./cae-types"

const FIXTURE_DIR = path.join(__dirname, "../tests/fixtures/skills")

function makeFetchMock(shHtml: string, clawHubHtml: string) {
  return vi.fn().mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("skills.sh")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(shHtml),
      })
    }
    if (typeof url === "string" && url.includes("clawhub")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(clawHubHtml),
      })
    }
    return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") })
  })
}

describe("dedupeMergeByName", () => {
  it("Test 5a: same owner+name from two sources merges into one row", async () => {
    const { dedupeMergeByName } = await import("./cae-skills-catalog")
    const skills: CatalogSkill[] = [
      {
        name: "agent-skills",
        owner: "vercel-labs",
        source: "skills.sh",
        description: "Agent skills from skills.sh",
        installCmd: "npx skills add vercel-labs/agent-skills",
        detailUrl: "https://skills.sh/vercel-labs/agent-skills",
        installed: false,
        installs: 100,
      },
      {
        name: "agent-skills",
        owner: "vercel-labs",
        source: "clawhub",
        description: "Agent skills from clawhub",
        installCmd: "npx skills add vercel-labs/agent-skills",
        detailUrl: "https://clawhub.ai/skills/vercel-labs/agent-skills",
        installed: false,
        stars: 50,
      },
    ]
    const merged = dedupeMergeByName(skills)
    expect(merged).toHaveLength(1)
    expect(merged[0].sources).toContain("skills.sh")
    expect(merged[0].sources).toContain("clawhub")
  })

  it("Test 5b: local source wins installed=true even if other sources have installed=false", async () => {
    const { dedupeMergeByName } = await import("./cae-skills-catalog")
    const skills: CatalogSkill[] = [
      {
        name: "my-skill",
        owner: "some-user",
        source: "skills.sh",
        description: "Some skill",
        installCmd: "npx skills add some-user/my-skill",
        detailUrl: "https://skills.sh/some-user/my-skill",
        installed: false,
      },
      {
        name: "my-skill",
        owner: "some-user",
        source: "local",
        description: "My local skill",
        installCmd: "already installed",
        detailUrl: "file:///home/user/.claude/skills/my-skill",
        installed: true,
      },
    ]
    const merged = dedupeMergeByName(skills)
    expect(merged).toHaveLength(1)
    expect(merged[0].installed).toBe(true)
  })

  it("Test 5c: different names stay as separate rows", async () => {
    const { dedupeMergeByName } = await import("./cae-skills-catalog")
    const skills: CatalogSkill[] = [
      {
        name: "skill-a",
        owner: "user",
        source: "skills.sh",
        description: "A",
        installCmd: "npx skills add user/skill-a",
        detailUrl: "https://skills.sh/user/skill-a",
        installed: false,
      },
      {
        name: "skill-b",
        owner: "user",
        source: "clawhub",
        description: "B",
        installCmd: "npx skills add user/skill-b",
        detailUrl: "https://clawhub.ai/skills/user/skill-b",
        installed: false,
      },
    ]
    const merged = dedupeMergeByName(skills)
    expect(merged).toHaveLength(2)
  })
})

describe("getCatalog cache", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it("Test 6: second call within 15 min doesn't re-invoke fetch", async () => {
    const shHtml = fs.readFileSync(
      path.join(FIXTURE_DIR, "skills-sh-trending.html"),
      "utf8"
    )
    const clawHubHtml = fs.readFileSync(
      path.join(FIXTURE_DIR, "clawhub-skills.html"),
      "utf8"
    )

    // Reset module cache so we get a fresh cache map
    const mockFetch = makeFetchMock(shHtml, clawHubHtml)

    // Dynamically import to get fresh module instance
    const { getCatalog } = await import("./cae-skills-catalog")

    // First call
    await getCatalog({ fetchImpl: mockFetch as typeof fetch })
    const firstCallCount = mockFetch.mock.calls.length

    // Second call within TTL
    await getCatalog({ fetchImpl: mockFetch as typeof fetch })
    const secondCallCount = mockFetch.mock.calls.length

    // Should NOT have fetched again
    expect(secondCallCount).toBe(firstCallCount)
  })

  it("Test 6b: call after 16 min re-fetches", async () => {
    vi.resetModules()
    const shHtml = fs.readFileSync(
      path.join(FIXTURE_DIR, "skills-sh-trending.html"),
      "utf8"
    )
    const clawHubHtml = fs.readFileSync(
      path.join(FIXTURE_DIR, "clawhub-skills.html"),
      "utf8"
    )
    const mockFetch = makeFetchMock(shHtml, clawHubHtml)
    const { getCatalog } = await import("./cae-skills-catalog")

    // First call — populates cache
    await getCatalog({ fetchImpl: mockFetch as typeof fetch })
    const afterFirst = mockFetch.mock.calls.length

    // Advance 16 min — past 15-min TTL
    vi.advanceTimersByTime(16 * 60 * 1000)

    // Third call — should re-fetch
    await getCatalog({ fetchImpl: mockFetch as typeof fetch })
    const afterThird = mockFetch.mock.calls.length

    expect(afterThird).toBeGreaterThan(afterFirst)
  })
})
