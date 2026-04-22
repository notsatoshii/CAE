import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import React from "react"
import type { CatalogSkill } from "@/lib/cae-types"

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { CatalogGrid } from "./catalog-grid"

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
    name: "git-workflow",
    owner: "anthropic-labs",
    source: "clawhub",
    description: "Standardized git branching",
    installCmd: "npx skills add anthropic-labs/git-workflow",
    detailUrl: "https://clawhub.ai/skills/anthropic-labs/git-workflow",
    installed: false,
    stars: 200,
  },
  {
    name: "my-local-skill",
    owner: "local",
    source: "local",
    description: "A locally installed skill",
    installCmd: "already installed",
    detailUrl: "file:///home/user/.claude/skills/my-local-skill",
    installed: true,
  },
]

describe("CatalogGrid", () => {
  it("Test 2: renders N cards for N skills", () => {
    render(<CatalogGrid initial={MOCK_SKILLS} />)
    const cards = screen.getAllByTestId("skill-card")
    expect(cards).toHaveLength(3)
  })

  it("Test 2b: filters cards by search query (case-insensitive)", async () => {
    vi.useFakeTimers()
    render(<CatalogGrid initial={MOCK_SKILLS} />)

    const input = screen.getByRole("searchbox")
    fireEvent.change(input, { target: { value: "agent" } })

    // Advance past debounce (200ms)
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    const cards = screen.getAllByTestId("skill-card")
    expect(cards).toHaveLength(1)
    expect(screen.getByText("agent-skills")).toBeInTheDocument()

    vi.useRealTimers()
  })

  it("Test 2c: shows no-results state when filter finds nothing", async () => {
    vi.useFakeTimers()
    render(<CatalogGrid initial={MOCK_SKILLS} />)

    const input = screen.getByRole("searchbox")
    fireEvent.change(input, { target: { value: "xyznotexistant" } })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.queryAllByTestId("skill-card")).toHaveLength(0)
    // Should show a "no results" message
    expect(screen.getByTestId("catalog-no-results")).toBeInTheDocument()

    vi.useRealTimers()
  })
})
