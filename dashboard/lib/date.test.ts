import { describe, it, expect, vi, afterEach } from "vitest"
import { formatRelativeTime } from "./date"

const FIXED_NOW = new Date("2026-04-25T12:00:00Z").getTime() // 1745582400000

describe("formatRelativeTime", () => {
  afterEach(() => vi.restoreAllMocks())

  function freeze(nowMs = FIXED_NOW) {
    vi.spyOn(Date, "now").mockReturnValue(nowMs)
  }

  it("returns — for null", () => {
    expect(formatRelativeTime(null)).toBe("—")
  })

  it("returns — for undefined", () => {
    expect(formatRelativeTime(undefined)).toBe("—")
  })

  it("returns — for zero (placeholder epoch)", () => {
    expect(formatRelativeTime(0)).toBe("—")
  })

  it("returns — for empty string", () => {
    expect(formatRelativeTime("")).toBe("—")
  })

  it("returns — for unparseable string", () => {
    expect(formatRelativeTime("not-a-date")).toBe("—")
  })

  it("handles epoch milliseconds (> 1e12)", () => {
    freeze()
    // 3 hours before FIXED_NOW in ms
    const ms = FIXED_NOW - 3 * 3_600_000
    expect(formatRelativeTime(ms)).toBe("3h ago")
  })

  it("handles epoch seconds (<= 1e12)", () => {
    freeze()
    // 3 hours before FIXED_NOW in seconds
    const sec = Math.floor((FIXED_NOW - 3 * 3_600_000) / 1000)
    expect(formatRelativeTime(sec)).toBe("3h ago")
  })

  it("handles ISO string input", () => {
    freeze()
    // 7 days before FIXED_NOW
    const iso = new Date(FIXED_NOW - 7 * 86_400_000).toISOString()
    expect(formatRelativeTime(iso)).toBe("7d ago")
  })

  it("returns just now for future timestamps", () => {
    freeze()
    const futureMs = FIXED_NOW + 60_000
    expect(formatRelativeTime(futureMs)).toBe("just now")
  })

  it("returns — for values older than year 2000 expressed as epoch seconds (sanity)", () => {
    // epoch seconds ~1.74e9 is 2025-ish, should NOT be treated as ms (which would be 1970)
    freeze()
    const recent = Math.floor((FIXED_NOW - 5 * 60_000) / 1000) // 5 minutes ago in seconds
    expect(formatRelativeTime(recent)).toBe("5m ago")
  })

  it("distinguishes seconds vs ms: same logical time", () => {
    freeze()
    const ms = FIXED_NOW - 2 * 86_400_000
    const sec = Math.floor(ms / 1000)
    expect(formatRelativeTime(ms)).toBe(formatRelativeTime(sec))
  })
})
