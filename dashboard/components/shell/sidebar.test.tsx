/**
 * Sidebar tests — Phase 15 Wave 2 §2.3.
 *
 * Coverage:
 *   - Renders collapsed by default (default prop).
 *   - Renders expanded when initialCollapsed=false.
 *   - Toggle button flips state and writes cookie.
 *   - Active route gets the accent rail (data-active-rail="true").
 *   - Tooltip surface element is rendered when collapsed for each item.
 *   - Reduced-motion path: width style applied without animation noise.
 *   - All 12 nav items render in the locked order.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"

// --- mocks ----------------------------------------------------------------

vi.mock("next/link", () => ({
  default: React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>(
    function MockLink({ href, children, ...rest }, ref) {
      return (
        <a ref={ref} href={href} {...rest}>
          {children}
        </a>
      )
    },
  ),
}))

const mockPathname = vi.fn<[], string>().mockReturnValue("/build")
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}))

// motion/react: motion.aside should render as a plain <aside> with the
// width style applied, and useReducedMotion can be toggled per-test.
const mockReduceMotion = vi.fn<[], boolean | null>().mockReturnValue(false)
vi.mock("motion/react", () => {
  // Cache one component per HTML tag so React sees a stable component type
  // across re-renders — otherwise a fresh component is created on every prop
  // access and React unmounts/remounts the entire subtree, dropping focus
  // and silently dropping prop updates that ran during the click handler.
  const cache = new Map<string, React.ComponentType<Record<string, unknown>>>()
  function makeMotionComponent(tag: string) {
    const cached = cache.get(tag)
    if (cached) return cached
    const Comp = React.forwardRef<HTMLElement, Record<string, unknown>>(
      function MotionMock(props, ref) {
        const {
          animate: _animate,
          initial: _initial,
          transition: _transition,
          whileHover: _wh,
          whileTap: _wt,
          style,
          children,
          ...rest
        } = props as Record<string, unknown>
        // Apply animate.width (or style.width fallback) so layout assertions
        // can read the rendered width without mounting the real motion runtime.
        const width =
          (typeof _animate === "object" && _animate && (_animate as { width?: number }).width) ||
          (typeof style === "object" && style && (style as { width?: number }).width)
        return React.createElement(
          tag,
          { ref, ...rest, style: { ...(style as object), width } },
          children as React.ReactNode,
        )
      },
    )
    Comp.displayName = `MotionMock(${tag})`
    cache.set(tag, Comp as unknown as React.ComponentType<Record<string, unknown>>)
    return Comp as unknown as React.ComponentType<Record<string, unknown>>
  }
  return {
    motion: new Proxy(
      {},
      {
        get: (_t, tag: string) => makeMotionComponent(tag),
      },
    ),
    useReducedMotion: () => mockReduceMotion(),
  }
})

// base-ui Tooltip: render trigger + popup inline so collapsed-tooltip
// presence can be asserted without async/portal complexity.
vi.mock("@base-ui/react/tooltip", () => {
  const Provider = ({ children }: { children: React.ReactNode }) => <>{children}</>
  const Root = ({ children }: { children: React.ReactNode }) => <>{children}</>
  // Trigger's `render` prop receives base-ui props and a state; we just call
  // it with an empty props object so the slotted child is rendered as-is.
  const Trigger = ({
    render,
  }: {
    render: (props: Record<string, unknown>) => React.ReactElement
  }) => render({})
  const Portal = ({ children }: { children: React.ReactNode }) => <>{children}</>
  const Positioner = ({ children }: { children: React.ReactNode }) => <>{children}</>
  const Popup = ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...rest}>{children}</div>
  )
  const Arrow = ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...rest}>{children}</div>
  )
  return {
    Tooltip: { Provider, Root, Trigger, Portal, Positioner, Popup, Arrow },
  }
})

// --- import after mocks ---------------------------------------------------

import { Sidebar, SIDEBAR_SECTIONS } from "./sidebar"

// --- helpers --------------------------------------------------------------

function clearCookies() {
  // jsdom: clear by setting expired
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0]?.trim()
    if (name) document.cookie = `${name}=; path=/; max-age=0`
  })
}

beforeEach(() => {
  mockPathname.mockReturnValue("/build")
  mockReduceMotion.mockReturnValue(false)
  clearCookies()
})

// --- tests ----------------------------------------------------------------

describe("Sidebar", () => {
  it("renders collapsed by default (no initialCollapsed prop)", () => {
    render(<Sidebar />)
    const aside = screen.getByTestId("sidebar")
    expect(aside.getAttribute("data-collapsed")).toBe("true")
    // collapsed width = 56px
    expect((aside as HTMLElement).style.width).toBe("56px")
  })

  it("renders expanded when initialCollapsed=false", () => {
    render(<Sidebar initialCollapsed={false} />)
    const aside = screen.getByTestId("sidebar")
    expect(aside.getAttribute("data-collapsed")).toBe("false")
    expect((aside as HTMLElement).style.width).toBe("224px")
  })

  it("clicking the chevron toggle expands the sidebar and sets the cookie", () => {
    render(<Sidebar />)
    const toggle = screen.getByTestId("sidebar-toggle")
    expect(toggle.getAttribute("aria-expanded")).toBe("false")

    fireEvent.click(toggle)

    const aside = screen.getByTestId("sidebar")
    expect(aside.getAttribute("data-collapsed")).toBe("false")
    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    // Cookie persisted with new state
    expect(document.cookie).toContain("cae-sidebar-state=expanded")

    // Toggle back: re-collapses + cookie flips
    fireEvent.click(toggle)
    expect(aside.getAttribute("data-collapsed")).toBe("true")
    expect(document.cookie).toContain("cae-sidebar-state=collapsed")
  })

  it("active route shows the accent rail and aria-current=page", () => {
    mockPathname.mockReturnValue("/build/agents")
    render(<Sidebar initialCollapsed={false} />)
    const agents = screen.getByTestId("sidebar-item-agents")
    expect(agents.getAttribute("data-active")).toBe("true")
    expect(agents.getAttribute("aria-current")).toBe("page")
    const rail = agents.querySelector('[data-active-rail="true"]')
    expect(rail).not.toBeNull()
  })

  it("active route detection: subpath /build/schedule/new activates Schedule", () => {
    mockPathname.mockReturnValue("/build/schedule/new")
    render(<Sidebar initialCollapsed={false} />)
    const schedule = screen.getByTestId("sidebar-item-schedule")
    expect(schedule.getAttribute("data-active")).toBe("true")
  })

  it("Home '/' is NOT active when on /build", () => {
    mockPathname.mockReturnValue("/build")
    render(<Sidebar initialCollapsed={false} />)
    const home = screen.getByTestId("sidebar-item-home")
    expect(home.getAttribute("data-active")).toBe("false")
  })

  it("renders a tooltip popup for every nav item when collapsed", () => {
    render(<Sidebar />)
    // Each item gets a sibling popup containing the same label text.
    for (const section of SIDEBAR_SECTIONS) {
      for (const item of section.items) {
        const tooltip = screen.getByTestId(`${item.testid}-tooltip`)
        expect(tooltip.textContent).toContain(item.label)
      }
    }
  })

  it("does NOT render tooltip popups when expanded (label is inline)", () => {
    render(<Sidebar initialCollapsed={false} />)
    for (const section of SIDEBAR_SECTIONS) {
      for (const item of section.items) {
        expect(screen.queryByTestId(`${item.testid}-tooltip`)).toBeNull()
      }
    }
  })

  it("renders all 12 nav items in the locked order", () => {
    render(<Sidebar initialCollapsed={false} />)
    const flat = SIDEBAR_SECTIONS.flatMap((s) => s.items)
    expect(flat).toHaveLength(12)
    const hrefs = flat.map((item) =>
      screen.getByTestId(item.testid).getAttribute("href"),
    )
    expect(hrefs).toEqual([
      "/",
      "/build/agents",
      "/build/queue",
      "/build/workflows",
      "/build/schedule",
      "/build/skills",
      "/build/security",
      "/memory",
      "/metrics",
      "/floor",
      "/build/changes",
      "/plan",
    ])
  })

  it("section labels are aria-hidden when collapsed", () => {
    render(<Sidebar />)
    const buildSection = screen.getByTestId("sidebar-section-build")
    const heading = buildSection.querySelector("[aria-hidden='true']")
    expect(heading).not.toBeNull()
    expect(heading?.textContent).toContain("Build")
  })

  it("section labels render visibly when expanded", () => {
    render(<Sidebar initialCollapsed={false} />)
    const buildSection = screen.getByTestId("sidebar-section-build")
    // Expanded: heading no longer aria-hidden (other aria-hidden els like SVGs
    // exist; we filter to the heading element by class).
    const hidden = Array.from(
      buildSection.querySelectorAll("[aria-hidden='true']"),
    ).filter((el) => el.tagName === "DIV")
    expect(hidden).toHaveLength(0)
  })

  it("reduced-motion path: width still applied (snap, no animation)", () => {
    mockReduceMotion.mockReturnValue(true)
    render(<Sidebar initialCollapsed={false} />)
    const aside = screen.getByTestId("sidebar")
    expect((aside as HTMLElement).style.width).toBe("224px")
  })

  it("ArrowDown moves focus from the first to the second item", () => {
    render(<Sidebar initialCollapsed={false} />)
    const home = screen.getByTestId("sidebar-item-home") as HTMLAnchorElement
    const agents = screen.getByTestId("sidebar-item-agents") as HTMLAnchorElement
    home.focus()
    expect(document.activeElement).toBe(home)
    const nav = home.closest("nav")!
    fireEvent.keyDown(nav, { key: "ArrowDown" })
    expect(document.activeElement).toBe(agents)
  })

  it("ArrowUp from the first item wraps to the last", () => {
    render(<Sidebar initialCollapsed={false} />)
    const home = screen.getByTestId("sidebar-item-home") as HTMLAnchorElement
    const plan = screen.getByTestId("sidebar-item-plan") as HTMLAnchorElement
    home.focus()
    const nav = home.closest("nav")!
    fireEvent.keyDown(nav, { key: "ArrowUp" })
    expect(document.activeElement).toBe(plan)
  })

  it("End jumps focus to the last item", () => {
    render(<Sidebar initialCollapsed={false} />)
    const home = screen.getByTestId("sidebar-item-home") as HTMLAnchorElement
    const plan = screen.getByTestId("sidebar-item-plan") as HTMLAnchorElement
    home.focus()
    const nav = home.closest("nav")!
    fireEvent.keyDown(nav, { key: "End" })
    expect(document.activeElement).toBe(plan)
  })

  it("collapsed link carries aria-label (icon-only) for screen readers", () => {
    render(<Sidebar />)
    expect(screen.getByTestId("sidebar-item-agents").getAttribute("aria-label")).toBe(
      "Agents",
    )
  })

  it("expanded link omits aria-label (label is rendered inline)", () => {
    render(<Sidebar initialCollapsed={false} />)
    expect(screen.getByTestId("sidebar-item-agents").getAttribute("aria-label")).toBeNull()
  })
})
