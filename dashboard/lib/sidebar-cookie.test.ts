/**
 * sidebar-cookie tests — Phase 15 Wave 2 §2.3.
 *
 * Verifies the parser is forgiving (anything other than "expanded" → default
 * collapsed) and the round-trip serialize/parse is lossless.
 */

import { describe, it, expect } from "vitest"
import {
  parseSidebarState,
  sidebarCookieValue,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
} from "./sidebar-cookie"

describe("sidebar-cookie", () => {
  it("defaults to expanded when cookie is absent (C2 Class 7 flip)", () => {
    expect(parseSidebarState(undefined)).toBe("expanded")
    expect(parseSidebarState(null)).toBe("expanded")
    expect(parseSidebarState("")).toBe("expanded")
  })

  it('parses "collapsed" exactly', () => {
    expect(parseSidebarState("collapsed")).toBe("collapsed")
  })

  it('parses "expanded" exactly', () => {
    expect(parseSidebarState("expanded")).toBe("expanded")
  })

  it("treats unknown values as expanded (the new default)", () => {
    expect(parseSidebarState("garbage")).toBe("expanded")
    expect(parseSidebarState("EXPANDED")).toBe("expanded")
    expect(parseSidebarState("COLLAPSED")).toBe("expanded")
  })

  it("round-trips serialize → parse", () => {
    expect(parseSidebarState(sidebarCookieValue("collapsed"))).toBe("collapsed")
    expect(parseSidebarState(sidebarCookieValue("expanded"))).toBe("expanded")
  })

  it("exports stable cookie name + widths", () => {
    expect(SIDEBAR_COOKIE_NAME).toBe("cae-sidebar-state")
    expect(SIDEBAR_COLLAPSED_WIDTH).toBe(56)
    expect(SIDEBAR_EXPANDED_WIDTH).toBe(224)
  })
})
