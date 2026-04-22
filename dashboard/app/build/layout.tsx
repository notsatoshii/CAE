import { BuildRail } from "@/components/shell/build-rail"

/**
 * BuildLayout — wraps every /build/* page with the 48px left-rail.
 *
 * Structure:
 *   app/layout.tsx       → <html>/<body>/<TopNav h=40px>
 *   app/build/layout.tsx → <flex-row>: [BuildRail w=48px] [main flex-1 overflow-auto]
 *
 * `min-h-[calc(100vh-40px)]` fills the remaining viewport under the global
 * TopNav. `overflow-auto` on the main pane keeps the rail fixed-visual
 * while long page content scrolls.
 */
export default async function BuildLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-[calc(100vh-40px)] w-full">
      <BuildRail />
      <div className="flex-1 min-w-0 overflow-auto">{children}</div>
    </div>
  )
}
