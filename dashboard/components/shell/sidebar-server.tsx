/**
 * SidebarServer — async server-component wrapper for <Sidebar />.
 *
 * Reads the `cae-sidebar-state` cookie on the server and forwards the
 * boolean to the client component as `initialCollapsed`. This guarantees
 * the first paint matches the user's last-chosen state — no flash from
 * collapsed (default) to expanded after hydration (or vice versa).
 *
 * Phase 15 Wave 2 §2.3.
 */

import { cookies } from "next/headers"
import { Sidebar } from "./sidebar"
import { SIDEBAR_COOKIE_NAME, parseSidebarState } from "@/lib/sidebar-cookie"

export async function SidebarServer() {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value
  const state = parseSidebarState(raw)
  return <Sidebar initialCollapsed={state === "collapsed"} />
}
