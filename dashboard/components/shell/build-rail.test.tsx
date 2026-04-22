import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    "data-testid": testid,
    "data-active": active,
    "aria-label": ariaLabel,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string
    "data-testid"?: string
    "data-active"?: string
    "aria-label"?: string
  }) => (
    <a
      href={href}
      data-testid={testid}
      data-active={active}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </a>
  ),
}))

// Mock usePathname
const mockPathname = vi.fn().mockReturnValue("/build")
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}))

import { BuildRail } from "./build-rail"

describe("BuildRail", () => {
  it("Test 5: renders 6 tabs including new Skills tab", () => {
    render(<BuildRail />)
    const rail = screen.getByTestId("build-rail")
    // All 6 tab links
    const links = rail.querySelectorAll("a")
    expect(links).toHaveLength(6)
  })

  it("Test 5b: Skills tab is present between Queue and Changes", () => {
    render(<BuildRail />)
    const links = Array.from(
      screen.getByTestId("build-rail").querySelectorAll("a")
    )
    const hrefs = links.map((l) => l.getAttribute("href"))
    const queueIdx = hrefs.indexOf("/build/queue")
    const skillsIdx = hrefs.indexOf("/build/skills")
    const changesIdx = hrefs.indexOf("/build/changes")

    expect(skillsIdx).toBeGreaterThan(queueIdx)
    expect(skillsIdx).toBeLessThan(changesIdx)
  })

  it("Test 5c: Skills tab is active for /build/skills path", () => {
    mockPathname.mockReturnValue("/build/skills")
    render(<BuildRail />)

    const skillsLink = screen.getByTestId("build-rail-tab-skills")
    expect(skillsLink).toHaveAttribute("data-active", "true")
  })

  it("Test 5d: Skills tab is active for /build/skills/something subpath", () => {
    mockPathname.mockReturnValue("/build/skills/my-skill")
    render(<BuildRail />)

    const skillsLink = screen.getByTestId("build-rail-tab-skills")
    expect(skillsLink).toHaveAttribute("data-active", "true")
  })

  it("Test 5e: Home tab is NOT active for /build/skills path", () => {
    mockPathname.mockReturnValue("/build/skills")
    render(<BuildRail />)

    const homeLink = screen.getByTestId("build-rail-tab-home")
    expect(homeLink).toHaveAttribute("data-active", "false")
  })
})
