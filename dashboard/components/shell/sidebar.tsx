"use client"

/**
 * Sidebar — Linear-style collapsible left rail for /build/* pages.
 *
 * Phase 15 Wave 2 §2.3 (https://.../WAVE-2-PLAN.md):
 *   Eric: "the sidebar is a pain in the ass because there is no expandable
 *   button for showing labels."
 *
 * Behavior:
 *   - Two states: collapsed (56px, icons + hover Tooltip) / expanded (224px,
 *     icons + labels). Collapsed is the default.
 *   - State persists via cookie `cae-sidebar-state` so SSR matches client.
 *   - Server reads the cookie in app/build/layout.tsx and passes the initial
 *     state in via `initialCollapsed` to avoid hydration flash.
 *   - Animation: motion (framer-motion) spring on width. Falls back to
 *     instant transition when prefers-reduced-motion is set
 *     (useReducedMotion() → 0-duration tween).
 *   - 12 nav items grouped into Build / Insights / Plan sections. Section
 *     labels are visible only when expanded.
 *   - Active route shown with a 2px left accent line (--accent) and
 *     aria-current="page".
 *   - Optional count badges (mono pill on --surface-hover) per item.
 *   - Keyboard: ArrowUp/ArrowDown move focus between nav items; Home/End
 *     jump to first/last; Enter activates (default link behavior).
 *
 * Uses base-ui Tooltip (already in project) with a 300ms open delay.
 */

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, useReducedMotion } from "motion/react"
import { Tooltip } from "@base-ui/react/tooltip"
import {
  Home,
  Bot,
  ListTodo,
  Workflow,
  Calendar,
  Sparkles,
  Shield,
  Brain,
  ChartLine,
  Gamepad2,
  GitCommit,
  Compass,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  sidebarCookieValue,
  type SidebarState,
} from "@/lib/sidebar-cookie"
import {
  RAIL_COLLAPSED_STORAGE_KEY,
  writeRailCollapsedToStorage,
  readRailCollapsedFromStorage,
} from "@/lib/hooks/use-rail-collapsed"

// ---------------------------------------------------------------------------
// Item definitions (exported so tests can assert order without copy-paste).
// ---------------------------------------------------------------------------

export interface SidebarItemDef {
  href: string
  icon: LucideIcon
  label: string
  testid: string
  /** Optional badge count (rendered as a mono pill when present + > 0). */
  count?: number
}

export interface SidebarSectionDef {
  id: string
  label: string
  items: readonly SidebarItemDef[]
}

export const SIDEBAR_SECTIONS: readonly SidebarSectionDef[] = [
  {
    id: "build",
    label: "Build",
    items: [
      { href: "/", icon: Home, label: "Home", testid: "sidebar-item-home" },
      { href: "/build/agents", icon: Bot, label: "Agents", testid: "sidebar-item-agents" },
      { href: "/build/queue", icon: ListTodo, label: "Queue", testid: "sidebar-item-queue" },
      { href: "/build/workflows", icon: Workflow, label: "Workflows", testid: "sidebar-item-workflows" },
      { href: "/build/schedule", icon: Calendar, label: "Schedule", testid: "sidebar-item-schedule" },
      { href: "/build/skills", icon: Sparkles, label: "Skills", testid: "sidebar-item-skills" },
      { href: "/build/security", icon: Shield, label: "Security", testid: "sidebar-item-security" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { href: "/memory", icon: Brain, label: "Memory", testid: "sidebar-item-memory" },
      { href: "/metrics", icon: ChartLine, label: "Metrics", testid: "sidebar-item-metrics" },
      { href: "/floor", icon: Gamepad2, label: "Live Floor", testid: "sidebar-item-floor" },
      { href: "/build/changes", icon: GitCommit, label: "Changes", testid: "sidebar-item-changes" },
    ],
  },
  {
    id: "plan",
    label: "Plan",
    items: [{ href: "/plan", icon: Compass, label: "Plan", testid: "sidebar-item-plan" }],
  },
] as const

// Flat list of items in tab-order, for keyboard navigation.
function flattenItems(sections: readonly SidebarSectionDef[]): SidebarItemDef[] {
  return sections.flatMap((s) => s.items)
}

// ---------------------------------------------------------------------------
// Active-route detection (matches BuildRail's STRICT rule):
//   - "/" is only active when pathname === "/"
//   - "/build" is only active when pathname === "/build"
//   - others active when pathname === href OR pathname.startsWith(href + "/")
// ---------------------------------------------------------------------------

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  if (href === "/build") return pathname === "/build"
  return pathname === href || pathname.startsWith(href + "/")
}

// ---------------------------------------------------------------------------
// Cookie writer (client). Uses 1-year max-age and root path so every page
// receives the same value on next request.
// ---------------------------------------------------------------------------

function writeSidebarCookie(state: SidebarState): void {
  if (typeof document === "undefined") return
  const oneYear = 60 * 60 * 24 * 365
  const value = sidebarCookieValue(state)
  document.cookie = `${SIDEBAR_COOKIE_NAME}=${value}; path=/; max-age=${oneYear}; SameSite=Lax`
}

// ---------------------------------------------------------------------------
// SidebarItem — single nav row. Renders Link, optional badge, accent rail.
// In collapsed state, the label is rendered inside a base-ui Tooltip
// anchored to the icon. In expanded state, the label is rendered inline
// and Tooltip is bypassed entirely (no portal noise on hover).
// ---------------------------------------------------------------------------

interface SidebarItemProps {
  item: SidebarItemDef
  active: boolean
  collapsed: boolean
  onItemFocus: (index: number) => void
  index: number
  registerItemRef: (index: number, el: HTMLAnchorElement | null) => void
}

function SidebarItemRow({
  item,
  active,
  collapsed,
  onItemFocus,
  index,
  registerItemRef,
}: SidebarItemProps) {
  // Stable ref callback — only re-creates if `index` or `registerItemRef`
  // change (both stable in practice). Avoids the inline-arrow re-render
  // pattern where ref toggles null → el every render and races with focus.
  const itemRef = React.useCallback(
    (el: HTMLAnchorElement | null) => {
      registerItemRef(index, el)
    },
    [index, registerItemRef],
  )
  const Icon = item.icon

  const link = (
    <Link
      ref={itemRef}
      href={item.href}
      data-testid={item.testid}
      data-active={active ? "true" : "false"}
      data-collapsed={collapsed ? "true" : "false"}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      onFocus={() => onItemFocus(index)}
      className={cn(
        // Layout: full-width row, fixed height, icon-anchored
        "group relative flex h-9 items-center gap-3 rounded-md px-2 text-[13px] font-medium",
        // Transitions on hover state
        "transition-colors duration-[var(--dur-quick,150ms)]",
        // Inactive vs active colors
        active
          ? "bg-[color:var(--accent-muted)] text-[color:var(--text)]"
          : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]",
        // Focus visible
        "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-0",
      )}
    >
      {/* Active accent line — 2px, left edge, full row height. */}
      <span
        aria-hidden
        data-active-rail={active ? "true" : "false"}
        className={cn(
          "absolute left-0 top-1 bottom-1 w-0.5 rounded-r-sm transition-colors",
          active
            ? "bg-[color:var(--accent)]"
            : "bg-transparent group-hover:bg-[color:var(--border-strong)]",
        )}
      />
      <Icon
        aria-hidden
        className={cn(
          "size-4 shrink-0",
          active ? "text-[color:var(--accent)]" : "text-current",
        )}
      />
      {/* Label + badge are rendered always but visually clipped while
          collapsed so width animation reveals them smoothly. The parent
          aside's overflow:hidden handles clipping. */}
      <span
        className={cn(
          "flex-1 min-w-0 truncate text-left",
          collapsed && "pointer-events-none opacity-0",
        )}
      >
        {item.label}
      </span>
      {typeof item.count === "number" && item.count > 0 && (
        <span
          data-testid={`${item.testid}-badge`}
          className={cn(
            "ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[color:var(--surface-hover)] px-1.5 font-mono text-[11px] tabular-nums text-[color:var(--text-muted)]",
            collapsed && "pointer-events-none opacity-0",
          )}
        >
          {item.count}
        </span>
      )}
    </Link>
  )

  if (!collapsed) return link

  // Collapsed: wrap with Tooltip so the hidden label appears on hover.
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={(props) =>
          // base-ui needs a single child for `render`; we slot the link in.
          React.cloneElement(link, props as React.HTMLAttributes<HTMLAnchorElement>)
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner side="right" sideOffset={8}>
          <Tooltip.Popup
            data-testid={`${item.testid}-tooltip`}
            className="z-50 rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface-hover)] px-2 py-1 text-xs font-medium text-[color:var(--text)] shadow-lg"
          >
            <Tooltip.Arrow className="text-[color:var(--surface-hover)]">
              <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden>
                <path
                  d="M0 6 L5 0 L10 6 Z"
                  fill="currentColor"
                  stroke="var(--border-strong)"
                  strokeWidth="0.5"
                />
              </svg>
            </Tooltip.Arrow>
            {item.label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

// ---------------------------------------------------------------------------
// SidebarSection — group divider + items. Section label is hidden when
// collapsed; the items themselves remain accessible.
// ---------------------------------------------------------------------------

interface SidebarSectionProps {
  section: SidebarSectionDef
  pathname: string
  collapsed: boolean
  onItemFocus: (index: number) => void
  baseIndex: number
  registerItemRef: (index: number, el: HTMLAnchorElement | null) => void
}

function SidebarSection({
  section,
  pathname,
  collapsed,
  onItemFocus,
  baseIndex,
  registerItemRef,
}: SidebarSectionProps) {
  return (
    <div data-testid={`sidebar-section-${section.id}`} className="flex flex-col gap-0.5">
      {/* Section heading. Visible only when expanded; takes no space when
          collapsed so item rhythm stays tight. */}
      <div
        aria-hidden={collapsed ? "true" : undefined}
        className={cn(
          "px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--text-dim)]",
          collapsed && "pointer-events-none h-0 overflow-hidden p-0 opacity-0",
        )}
      >
        {section.label}
      </div>
      {section.items.map((item, idx) => {
        const flatIndex = baseIndex + idx
        return (
          <SidebarItemRow
            key={item.href}
            item={item}
            active={isActiveRoute(pathname, item.href)}
            collapsed={collapsed}
            onItemFocus={onItemFocus}
            index={flatIndex}
            registerItemRef={registerItemRef}
          />
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SidebarHeader — brand mark + chevron toggle button.
// Brand wordmark hides when collapsed (TopNav already shows "CAE"); the
// chevron stays in a stable column so it doesn't jump on toggle.
// ---------------------------------------------------------------------------

interface SidebarHeaderProps {
  collapsed: boolean
  onToggle: () => void
}

function SidebarHeader({ collapsed, onToggle }: SidebarHeaderProps) {
  const Chevron = collapsed ? ChevronsRight : ChevronsLeft
  return (
    <div className="flex h-10 items-center justify-between border-b border-[color:var(--border-subtle)] px-2">
      <span
        aria-hidden={collapsed ? "true" : undefined}
        className={cn(
          "px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)] transition-opacity",
          collapsed && "pointer-events-none opacity-0",
        )}
      >
        Navigation
      </span>
      <button
        type="button"
        data-testid="sidebar-toggle"
        aria-expanded={!collapsed}
        aria-controls="sidebar-nav"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={onToggle}
        className={cn(
          "ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--text-muted)]",
          "transition-colors duration-[var(--dur-quick,150ms)]",
          "hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]",
          "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]",
        )}
      >
        <Chevron className="size-4" aria-hidden />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar — main exported component.
// ---------------------------------------------------------------------------

export interface SidebarProps {
  /** Initial collapsed state (read from cookie on the server). */
  initialCollapsed?: boolean
}

/**
 * Sidebar default: expanded (labels visible). C2 fix-wave Class 7 flipped
 * this from the prior `true` — Eric complained that icon-only mode left him
 * unable to tell what the rail items were. Collapsed mode is opt-in now
 * (chevron or ⌘\) and persisted via localStorage `cae.rail.collapsed` + the
 * legacy `cae-sidebar-state` cookie (for SSR).
 */
export function Sidebar({ initialCollapsed = false }: SidebarProps) {
  const pathname = usePathname() ?? "/build"
  const [collapsed, setCollapsed] = React.useState<boolean>(initialCollapsed)
  const reduceMotion = useReducedMotion() ?? false

  // After mount, prefer localStorage if the user previously chose a state.
  // The server can't read localStorage, so the cookie-seeded initial state
  // may disagree; reconcile once here.
  React.useEffect(() => {
    const stored = readRailCollapsedFromStorage()
    if (stored !== undefined && stored !== collapsed) {
      setCollapsed(stored)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cross-tab sync: if another tab flips the pref, mirror here.
  React.useEffect(() => {
    if (typeof window === "undefined") return
    function onStorage(e: StorageEvent) {
      if (e.key !== RAIL_COLLAPSED_STORAGE_KEY) return
      if (e.newValue === "true") setCollapsed(true)
      else if (e.newValue === "false") setCollapsed(false)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  // Track focused item for keyboard nav (ArrowUp/Down between items).
  // focusedIndex lives in a ref (not state) so cursor moves never trigger a
  // re-render — re-render would unmount/remount link DOM nodes and we'd lose
  // focus mid-navigation.
  const items = React.useMemo(() => flattenItems(SIDEBAR_SECTIONS), [])
  const itemRefs = React.useRef<(HTMLAnchorElement | null)[]>([])
  const registerItemRef = React.useCallback(
    (index: number, el: HTMLAnchorElement | null) => {
      itemRefs.current[index] = el
    },
    [],
  )
  const focusedIndexRef = React.useRef<number>(-1)
  const setFocusedIndex = React.useCallback((index: number) => {
    focusedIndexRef.current = index
  }, [])

  const handleToggle = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      writeSidebarCookie(next ? "collapsed" : "expanded")
      // C2 Class 7: also mirror to localStorage so the hook-based source of
      // truth stays in sync across tabs + survives cookie rotation.
      writeRailCollapsedToStorage(next)
      return next
    })
  }, [])

  // Global keyboard shortcut: ⌘\ (mac) / Ctrl+\ (others) toggles collapse.
  // VSCode convention. Registered once at the sidebar level — this is the
  // only place where the sidebar exists, so there's no scope mismatch.
  React.useEffect(() => {
    if (typeof window === "undefined") return
    function onKeyDown(e: KeyboardEvent) {
      // Ignore when the user is typing in an input / textarea / contentEditable.
      const target = e.target as HTMLElement | null
      const activeEl = document.activeElement as HTMLElement | null
      const isEditable = (el: HTMLElement | null): boolean => {
        if (!el) return false
        if (el instanceof HTMLInputElement) return true
        if (el instanceof HTMLTextAreaElement) return true
        if (el.isContentEditable) return true
        return false
      }
      if (isEditable(target) || isEditable(activeEl)) return
      // Key must be Backslash; exactly one of meta/ctrl must be held (mac vs
      // PC); shift/alt must NOT be held.
      if (e.key !== "\\") return
      const modPressed = e.metaKey || e.ctrlKey
      if (!modPressed) return
      if (e.shiftKey || e.altKey) return
      e.preventDefault()
      handleToggle()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleToggle])

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const total = items.length
      if (total === 0) return
      const current = focusedIndexRef.current >= 0 ? focusedIndexRef.current : 0
      let nextIndex: number | null = null
      switch (event.key) {
        case "ArrowDown":
          nextIndex = (current + 1) % total
          break
        case "ArrowUp":
          nextIndex = (current - 1 + total) % total
          break
        case "Home":
          nextIndex = 0
          break
        case "End":
          nextIndex = total - 1
          break
        default:
          return
      }
      event.preventDefault()
      const target = itemRefs.current[nextIndex]
      if (target) {
        target.focus()
        setFocusedIndex(nextIndex)
      }
    },
    [items.length, setFocusedIndex],
  )

  // Spring transition (per spec). When prefers-reduced-motion is set, swap
  // to a 0-duration tween so the width snaps instantly.
  const widthTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 320, damping: 32 }

  return (
    <Tooltip.Provider delay={300} closeDelay={120}>
      <motion.aside
        aria-label="Main navigation"
        data-testid="sidebar"
        data-collapsed={collapsed ? "true" : "false"}
        initial={false}
        animate={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
        transition={widthTransition}
        style={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
        className={cn(
          "flex h-[calc(100vh-40px)] shrink-0 flex-col overflow-hidden",
          "border-r border-[color:var(--border-subtle)] bg-[color:var(--surface)]",
          // Class 13B — rail reads as an elevated layer above page content
          // so the left edge has a clear drop-shadow against the canvas.
          "shadow-elevation-1",
        )}
      >
        <SidebarHeader collapsed={collapsed} onToggle={handleToggle} />
        <nav
          id="sidebar-nav"
          aria-label="Build navigation"
          onKeyDown={handleKeyDown}
          // Class 13D: scroll-vignette-y fades the top+bottom 8% of the
          // sidebar nav to bg so long rail lists feel like they continue
          // in depth instead of hard-clipping at the frame edges.
          className="flex-1 overflow-y-auto overflow-x-hidden p-1.5 scroll-vignette-y"
        >
          {SIDEBAR_SECTIONS.reduce<{ acc: React.ReactNode[]; offset: number }>(
            ({ acc, offset }, section) => {
              acc.push(
                <SidebarSection
                  key={section.id}
                  section={section}
                  pathname={pathname}
                  collapsed={collapsed}
                  onItemFocus={setFocusedIndex}
                  baseIndex={offset}
                  registerItemRef={registerItemRef}
                />,
              )
              return { acc, offset: offset + section.items.length }
            },
            { acc: [], offset: 0 },
          ).acc}
        </nav>
      </motion.aside>
    </Tooltip.Provider>
  )
}

export default Sidebar
