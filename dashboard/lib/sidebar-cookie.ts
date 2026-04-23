/**
 * sidebar-cookie.ts — shared cookie name + (de)serializer for the sidebar
 * collapse state.
 *
 * Phase 15 Wave 2 §2.3 (Linear-style collapsible sidebar):
 * the cookie must be readable on the server so the first paint matches the
 * client's eventual state (no hydration flash from collapsed → expanded
 * or vice versa).
 *
 * Stored values: "expanded" | "collapsed" (default: collapsed).
 * Cookie name: cae-sidebar-state.
 */

export const SIDEBAR_COOKIE_NAME = "cae-sidebar-state" as const

export type SidebarState = "collapsed" | "expanded"

const DEFAULT_STATE: SidebarState = "collapsed"

/**
 * parseSidebarState — coerce arbitrary cookie value (or undefined) into the
 * union. Anything other than "expanded" returns the default ("collapsed"),
 * matching the spec's "collapsed by default" requirement.
 */
export function parseSidebarState(raw: string | undefined | null): SidebarState {
  if (raw === "expanded") return "expanded"
  return DEFAULT_STATE
}

/**
 * sidebarCookieValue — opposite direction: serialize to cookie value.
 * Currently a passthrough (the union *is* the wire format), but exists so
 * any future encoding (e.g. JSON for multi-field state) has one home.
 */
export function sidebarCookieValue(state: SidebarState): string {
  return state
}

/**
 * SIDEBAR_COLLAPSED_WIDTH / SIDEBAR_EXPANDED_WIDTH — exact pixel widths
 * spec'd in WAVE-2-PLAN.md §2.3. Exported so the layout column reservation
 * can match the rendered sidebar (avoids content shift on toggle).
 */
export const SIDEBAR_COLLAPSED_WIDTH = 56
export const SIDEBAR_EXPANDED_WIDTH = 224
