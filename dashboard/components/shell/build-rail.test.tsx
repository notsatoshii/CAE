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
  it("Test 8: renders 7 tabs including Skills and Schedules", () => {
    render(<BuildRail />)
    const rail = screen.getByTestId("build-rail")
    const links = rail.querySelectorAll("a")
    expect(links).toHaveLength(7)
  })

  it("Test 8b: tabs in locked order: Home·Agents·Workflows·Queue·Skills·Schedules·Changes", () => {
    render(<BuildRail />)
    const links = Array.from(
      screen.getByTestId("build-rail").querySelectorAll("a")
    )
    const hrefs = links.map((l) => l.getAttribute("href"))
    expect(hrefs).toEqual([
      "/build",
      "/build/agents",
      "/build/workflows",
      "/build/queue",
      "/build/skills",
      "/build/schedule",
      "/build/changes",
    ])
  })

  it("Test 8c: Schedules tab is active for /build/schedule path", () => {
    mockPathname.mockReturnValue("/build/schedule")
    render(<BuildRail />)

    const scheduleLink = screen.getByTestId("build-rail-tab-schedule")
    expect(scheduleLink).toHaveAttribute("data-active", "true")
  })

  it("Test 8d: Schedules tab is active for /build/schedule/new subpath", () => {
    mockPathname.mockReturnValue("/build/schedule/new")
    render(<BuildRail />)

    const scheduleLink = screen.getByTestId("build-rail-tab-schedule")
    expect(scheduleLink).toHaveAttribute("data-active", "true")
  })

  it("Test 5: Skills tab is still present between Queue and Schedules", () => {
    render(<BuildRail />)
    const links = Array.from(
      screen.getByTestId("build-rail").querySelectorAll("a")
    )
    const hrefs = links.map((l) => l.getAttribute("href"))
    const queueIdx = hrefs.indexOf("/build/queue")
    const skillsIdx = hrefs.indexOf("/build/skills")
    const scheduleIdx = hrefs.indexOf("/build/schedule")

    expect(skillsIdx).toBeGreaterThan(queueIdx)
    expect(skillsIdx).toBeLessThan(scheduleIdx)
  })

  it("Test 5c: Skills tab is active for /build/skills path", () => {
    mockPathname.mockReturnValue("/build/skills")
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
