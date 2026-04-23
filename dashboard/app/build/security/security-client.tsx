"use client"

/**
 * SecurityClient — sub-tab navigation for the Security panel.
 *
 * Tabs: Skill trust | Secrets | Tool audit
 * Each tab links to its own route for deep-linking.
 * Active tab detected from pathname.
 */
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Role } from "@/lib/cae-types"

const TABS = [
  { href: "/build/security/skills", label: "Skill trust" },
  { href: "/build/security/secrets", label: "Secrets" },
  { href: "/build/security/audit", label: "Tool audit" },
] as const

export type SecurityClientProps = {
  currentRole: Role | undefined
  children: React.ReactNode
}

export function SecurityClient({ children }: SecurityClientProps) {
  const pathname = usePathname() ?? ""

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tab nav */}
      <nav className="flex gap-1 border-b border-zinc-800 pb-0">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/")
          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-testid={`security-tab-${tab.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-[color:var(--accent,#00d4ff)] text-[color:var(--accent,#00d4ff)]"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* Tab content */}
      <div>{children}</div>
    </div>
  )
}
