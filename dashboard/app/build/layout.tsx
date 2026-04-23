import { SidebarServer } from "@/components/shell/sidebar-server"

/**
 * BuildLayout — wraps every /build/* page with the Linear-style sidebar.
 *
 * Phase 15 Wave 2 §2.3 swapped the legacy 48px BuildRail for the new
 * collapsible Sidebar. Width animates between 56px (collapsed, icon-only)
 * and 224px (expanded, icons + labels). State persists per-user via the
 * `cae-sidebar-state` cookie, which the SidebarServer wrapper reads on
 * the server so the first paint matches.
 *
 * Structure:
 *   app/layout.tsx       → <html>/<body>/<TopNav h=40px>
 *   app/build/layout.tsx → <flex-row>: [Sidebar 56|224] [main flex-1 overflow-auto]
 */
export default async function BuildLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-[calc(100vh-40px)] w-full">
      <SidebarServer />
      {/* Class 13D focus-dim anchor lives on the root layout's
          #main-content wrapper — do NOT add another id here (duplicate IDs
          would make the :has() selector ambiguous). */}
      <div className="flex-1 min-w-0 overflow-auto">{children}</div>
    </div>
  )
}
