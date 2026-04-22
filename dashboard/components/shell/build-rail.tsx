"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Users, Zap, Inbox, ScrollText, Puzzle } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * BuildRail — 48px icon-only left-rail for all `/build/*` pages.
 *
 * Per UI-SPEC.md §2 (Build mode 6 tabs) + §13 (20px icon size).
 * Tab order is LOCKED: Home · Agents · Workflows · Queue · Skills · Changes.
 *
 * Active-tab detection rule (STRICT):
 *   - "/build" is only active when pathname === "/build" (not sub-routes).
 *   - All other tabs active when pathname === href || pathname.startsWith(href + "/").
 */

const TABS = [
  { href: "/build", icon: Home, label: "Home", testid: "build-rail-tab-home" },
  { href: "/build/agents", icon: Users, label: "Agents", testid: "build-rail-tab-agents" },
  { href: "/build/workflows", icon: Zap, label: "Workflows", testid: "build-rail-tab-workflows" },
  { href: "/build/queue", icon: Inbox, label: "Queue", testid: "build-rail-tab-queue" },
  { href: "/build/skills", icon: Puzzle, label: "Skills", testid: "build-rail-tab-skills" },
  { href: "/build/changes", icon: ScrollText, label: "Changes", testid: "build-rail-tab-changes" },
] as const

export function BuildRail() {
  const pathname = usePathname() ?? "/build"

  function isActive(href: string): boolean {
    if (href === "/build") return pathname === "/build"
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <nav
      aria-label="Build navigation"
      data-testid="build-rail"
      className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-[color:var(--border,#1f1f22)] bg-[color:var(--surface,#121214)] py-3"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon
        const active = isActive(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-testid={tab.testid}
            data-active={active ? "true" : "false"}
            aria-current={active ? "page" : undefined}
            aria-label={tab.label}
            title={tab.label}
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-md transition-colors",
              active
                ? "bg-[color:var(--accent-muted,#00d4ff20)] text-[color:var(--accent,#00d4ff)]"
                : "text-[color:var(--text-muted,#8a8a8c)] hover:bg-[color:var(--surface-hover,#1a1a1d)] hover:text-[color:var(--text,#e5e5e5)]"
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-sm bg-[color:var(--accent,#00d4ff)]"
              />
            )}
            <Icon size={20} aria-hidden />
          </Link>
        )
      })}
    </nav>
  )
}
