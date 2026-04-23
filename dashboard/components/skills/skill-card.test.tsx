import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"
import type { CatalogSkill } from "@/lib/cae-types"

// Mock next/link
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

import { SkillCard } from "./skill-card"

const BASE_SKILL: CatalogSkill = {
  name: "agent-skills",
  owner: "vercel-labs",
  source: "skills.sh",
  description: "Reusable agent skills for Claude Code workflows",
  installCmd: "npx skills add vercel-labs/agent-skills",
  detailUrl: "https://skills.sh/vercel-labs/agent-skills",
  installed: false,
  installs: 1234,
}

describe("SkillCard", () => {
  it("Test 1: renders name, owner, description", () => {
    render(
      <SkillCard
        skill={BASE_SKILL}
        onOpen={vi.fn()}
        onInstall={vi.fn()}
      />
    )
    expect(screen.getByText("agent-skills")).toBeInTheDocument()
    expect(screen.getByText("vercel-labs")).toBeInTheDocument()
    expect(
      screen.getByText(/Reusable agent skills/)
    ).toBeInTheDocument()
  })

  it("Test 1b: renders source badge for skills.sh", () => {
    render(
      <SkillCard skill={BASE_SKILL} onOpen={vi.fn()} onInstall={vi.fn()} />
    )
    expect(screen.getByText("skills.sh")).toBeInTheDocument()
  })

  it("Test 1c: renders ClawHub badge for clawhub source", () => {
    render(
      <SkillCard
        skill={{ ...BASE_SKILL, source: "clawhub" }}
        onOpen={vi.fn()}
        onInstall={vi.fn()}
      />
    )
    expect(screen.getByText("ClawHub")).toBeInTheDocument()
  })

  it("Test 1d: renders Local badge for local source", () => {
    render(
      <SkillCard
        skill={{ ...BASE_SKILL, source: "local" }}
        onOpen={vi.fn()}
        onInstall={vi.fn()}
      />
    )
    expect(screen.getByText("Local")).toBeInTheDocument()
  })

  it("Test 1e: shows Install button when not installed", () => {
    render(
      <SkillCard skill={BASE_SKILL} onOpen={vi.fn()} onInstall={vi.fn()} currentRole="operator" />
    )
    expect(
      screen.getByRole("button", { name: /install agent-skills/i })
    ).toBeInTheDocument()
  })

  it("Test 1f: shows Installed badge instead of Install button when installed", () => {
    render(
      <SkillCard
        skill={{ ...BASE_SKILL, installed: true }}
        onOpen={vi.fn()}
        onInstall={vi.fn()}
      />
    )
    expect(screen.getByText(/installed/i)).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^install$/i })
    ).not.toBeInTheDocument()
  })

  it("Test 1g: calls onInstall when Install button clicked", () => {
    const onInstall = vi.fn()
    render(
      <SkillCard skill={BASE_SKILL} onOpen={vi.fn()} onInstall={onInstall} currentRole="operator" />
    )
    // Use the aria-label which is specific: "Install agent-skills"
    fireEvent.click(screen.getByRole("button", { name: /install agent-skills/i }))
    expect(onInstall).toHaveBeenCalledWith(BASE_SKILL)
  })

  it("Test 1h: calls onOpen when card body clicked", () => {
    const onOpen = vi.fn()
    render(
      <SkillCard skill={BASE_SKILL} onOpen={onOpen} onInstall={vi.fn()} />
    )
    // Click on the card container (not the Install button)
    fireEvent.click(screen.getByTestId("skill-card-body"))
    expect(onOpen).toHaveBeenCalledWith(BASE_SKILL)
  })

  it("Test 1i: renders installs count", () => {
    render(
      <SkillCard skill={BASE_SKILL} onOpen={vi.fn()} onInstall={vi.fn()} />
    )
    // Should show some representation of 1234 installs
    expect(screen.getByText(/1[,.]?234/)).toBeInTheDocument()
  })
})
