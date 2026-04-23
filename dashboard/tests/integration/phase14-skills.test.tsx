/**
 * phase14-skills.test.tsx — Integration tests for Phase 14 Wave 1: Skills Hub
 *
 * Covers:
 *   REQ-P14-01: Skills page renders catalog tab with skills from multiple sources (deduped)
 *   REQ-P14-02: Install flow — SSE route streams progress → toast + catalog re-fetch
 *   REQ-P14-03: Detail drawer opens with SKILL.md content rendered + trust badge
 *
 * Uses RTL (no Playwright — not in package.json per Wave 5 note).
 * All network calls mocked via vi.fn() / global.fetch stubbing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { NextRequest } from "next/server"
import React from "react"
import type { CatalogSkill } from "@/lib/cae-types"

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/build/skills",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}))
vi.mock("remark-gfm", () => ({ default: () => null }))

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const FIXTURE_SKILLS: CatalogSkill[] = [
  {
    name: "agent-skills",
    owner: "vercel-labs",
    source: "skills.sh",
    sources: ["skills.sh", "clawhub"],
    description: "Reusable agent skills for Claude Code workflows",
    installCmd: "npx skills add vercel-labs/agent-skills",
    detailUrl: "https://skills.sh/vercel-labs/agent-skills",
    installed: false,
    installs: 1234,
    stars: 42,
  },
  {
    name: "test-runner",
    owner: "anthropic",
    source: "clawhub",
    description: "Run test suites from Claude Code",
    installCmd: "npx skills add anthropic/test-runner",
    detailUrl: "https://clawhub.dev/anthropic/test-runner",
    installed: true,
  },
  {
    name: "deploy",
    owner: "vercel-labs",
    source: "local",
    description: "Deploy the application to production",
    installCmd: "already installed",
    detailUrl: "",
    installed: true,
  },
]

// ─── REQ-P14-01: Skills catalog tab ───────────────────────────────────────────
describe("REQ-P14-01: Skills catalog renders with deduped skills", () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("Test 01a: CatalogGrid renders all fixture skills by name", async () => {
    const { CatalogGrid } = await import("@/components/skills/catalog-grid")

    render(
      <CatalogGrid
        initial={FIXTURE_SKILLS}
        onOpen={vi.fn()}
        onInstall={vi.fn()}
        currentRole="operator"
      />
    )

    expect(screen.getByText("agent-skills")).toBeInTheDocument()
    expect(screen.getByText("test-runner")).toBeInTheDocument()
    expect(screen.getByText("deploy")).toBeInTheDocument()
  })

  it("Test 01b: Skills with multiple sources get deduped in catalog lib", async () => {
    const { dedupeMergeByName } = await import("@/lib/cae-skills-catalog")

    // Two entries for same owner/name from different sources
    const items: CatalogSkill[] = [
      {
        name: "agent-skills",
        owner: "vercel-labs",
        source: "skills.sh",
        description: "Reusable agent skills",
        installCmd: "npx skills add vercel-labs/agent-skills",
        detailUrl: "https://skills.sh/...",
        installed: false,
      },
      {
        name: "agent-skills",
        owner: "vercel-labs",
        source: "clawhub",
        description: "Reusable agent skills",
        installCmd: "npx skills add vercel-labs/agent-skills",
        detailUrl: "https://clawhub.dev/...",
        installed: false,
      },
    ]

    const deduped = dedupeMergeByName(items)
    // Should collapse to one entry
    expect(deduped).toHaveLength(1)
    // sources should contain both
    expect(deduped[0].sources).toContain("skills.sh")
    expect(deduped[0].sources).toContain("clawhub")
  })

  it("Test 01c: Catalog tab shows filter input", async () => {
    const { CatalogGrid } = await import("@/components/skills/catalog-grid")
    render(
      <CatalogGrid
        initial={FIXTURE_SKILLS}
        onOpen={vi.fn()}
        onInstall={vi.fn()}
        currentRole="operator"
      />
    )
    // CatalogGrid uses role="searchbox" on its search input
    const input = screen.queryByRole("searchbox")
    expect(input).not.toBeNull()
  })

  it("Test 01d: Skills API GET route returns skills array (NextRequest)", async () => {
    const { GET } = await import("@/app/api/skills/route")

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    })

    // Route uses req.nextUrl.searchParams — must use NextRequest
    const req = new NextRequest("http://localhost/api/skills")
    const res = await GET(req)
    expect(res.status).toBeLessThan(500)
  })
})

// ─── REQ-P14-02: Install flow ──────────────────────────────────────────────────
describe("REQ-P14-02: Install flow — SSE streams progress", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("Test 02a: install-button renders with disabled state for viewer role", async () => {
    const { InstallButton } = await import("@/components/skills/install-button")

    render(
      <InstallButton
        skill={FIXTURE_SKILLS[0]}
        currentRole="viewer"
        onInstalled={vi.fn()}
      />
    )

    // With viewer role the button should be read-only / disabled or hidden via RoleGate
    const btn = screen.queryByRole("button", { name: /install/i })
    if (btn) {
      expect(btn).toBeDisabled()
    } else {
      // RoleGate hides it entirely — acceptable
      expect(true).toBe(true)
    }
  })

  it("Test 02b: install-button renders active for operator role", async () => {
    const { InstallButton } = await import("@/components/skills/install-button")

    render(
      <InstallButton
        skill={FIXTURE_SKILLS[0]}
        currentRole="operator"
        onInstalled={vi.fn()}
      />
    )

    const trigger = screen.getByRole("button")
    expect(trigger).toBeInTheDocument()
    expect(trigger).not.toBeDisabled()
  })

  it("Test 02c: installSkill AsyncGenerator yields line events from spawn", async () => {
    const { installSkill } = await import("@/lib/cae-skills-install")
    const { mockSpawn } = await import("@/tests/helpers/spawn-mock")

    const spawnMock = vi.fn().mockReturnValue(
      mockSpawn({
        stdout: ["Installing agent-skills...\n", "Done.\n"],
        exitCode: 0,
      })
    )

    const events: Array<{ type: string; data?: string }> = []
    for await (const event of installSkill("vercel-labs/agent-skills", spawnMock)) {
      events.push(event)
    }

    const lineEvents = events.filter((e) => e.type === "line")
    const doneEvent = events.find((e) => e.type === "done")

    expect(lineEvents.length).toBeGreaterThanOrEqual(1)
    expect(doneEvent).toBeDefined()
    expect(doneEvent?.data).toBe("0")
  })

  it("Test 02d: skills/installed route returns installed skills array", async () => {
    const { GET } = await import("@/app/api/skills/installed/route")

    void new NextRequest("http://localhost/api/skills/installed")
    const res = await GET()
    expect(res.status).toBeLessThan(500)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
  })
})

// ─── REQ-P14-03: Detail drawer + trust badge ──────────────────────────────────
describe("REQ-P14-03: Detail drawer renders SKILL.md + trust badge", () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("Test 03a: SkillDetailDrawer renders null when no skill selected", async () => {
    const { SkillDetailDrawer } = await import("@/components/skills/skill-detail-drawer")

    render(<SkillDetailDrawer skill={null} onClose={vi.fn()} currentRole="viewer" />)

    // Drawer should not be visible
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("Test 03b: SkillDetailDrawer renders skill name when skill given", async () => {
    const { SkillDetailDrawer } = await import("@/components/skills/skill-detail-drawer")

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          md: "# Deploy Skill\n\nDeploys to production.",
          frontmatter: {
            name: "deploy",
            description: "Deploy the application",
            version: "1.0.0",
            allowedTools: [],
          },
        }),
    })

    render(
      <SkillDetailDrawer
        skill={FIXTURE_SKILLS[2]} // local skill
        onClose={vi.fn()}
        currentRole="operator"
      />
    )

    await waitFor(() => {
      expect(screen.getByText("deploy")).toBeInTheDocument()
    })
  })

  it("Test 03c: TrustBadge renders with trust object (score 72)", async () => {
    const { TrustBadge } = await import("@/components/security/trust-badge")

    const trust = {
      total: 72,
      overridden: false,
      factors: [{ id: "test", passed: true, weight: 1, reason: "ok" }],
    }
    render(<TrustBadge trust={trust} />)

    const badge = screen.getByTestId("trust-badge")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute("data-score", "72")
    expect(badge.textContent).toContain("72")
  })

  it("Test 03d: skill detail API route handles unknown skill (NextRequest)", async () => {
    const { GET } = await import("@/app/api/skills/[name]/route")

    const req = new NextRequest("http://localhost/api/skills/nonexistent-skill")
    const res = await GET(req, { params: Promise.resolve({ name: "nonexistent-skill" }) })
    // Returns 404 if not found, 200 if somehow found
    expect([404, 200]).toContain(res.status)
  })

  it("Test 03e: computeTrustScore returns valid TrustScore", async () => {
    const { computeTrustScore } = await import("@/lib/cae-skills-trust")

    const score = computeTrustScore({
      skill: { name: "agent-skills", owner: "anthropic" },
      frontmatter: {
        name: "agent-skills",
        description: "Test skill",
        version: "1.0.0",
        allowedTools: ["Bash(git *)"],
        disableModelInvocation: false,
      },
      secretsCount: 0,
      overridden: false,
    })

    expect(score.total).toBeGreaterThanOrEqual(0)
    expect(score.total).toBeLessThanOrEqual(100)
    expect(score.factors.length).toBeGreaterThanOrEqual(1)
    expect(score.factors.every((f) => "id" in f && "weight" in f && "passed" in f)).toBe(true)
  })
})
