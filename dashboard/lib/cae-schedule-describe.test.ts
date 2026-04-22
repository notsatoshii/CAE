import { describe, it, expect } from "vitest"
import { describeCron } from "./cae-schedule-describe"

describe("describeCron", () => {
  it("returns english description for standard cron", () => {
    const { english } = describeCron("0 9 * * *", "America/New_York")
    expect(english).toContain("09:00")
  })

  it("computes correct next run across timezones (0 9 * * * in NY)", () => {
    // Current time in test is likely ~2026-04-23, NY is UTC-4 (EDT)
    // Next 9am NY after any UTC time today = 13:00 UTC if before 9am NY, else next day 13:00 UTC
    const { nextRun } = describeCron("0 9 * * *", "America/New_York")
    expect(nextRun).toBeTruthy()
    // Next run should have hours=13 (UTC) for NY 9am EDT
    const h = new Date(nextRun!).getUTCHours()
    expect(h).toBe(13) // 9am EDT = 13:00 UTC
  })

  it("returns nextRun as Date", () => {
    const { nextRun } = describeCron("0 * * * *", "UTC")
    expect(nextRun).toBeInstanceOf(Date)
  })

  it("handles invalid cron gracefully — english falls back to cron string", () => {
    const { english, nextRun } = describeCron("invalid", "UTC")
    // Should not throw; english should contain something useful
    expect(english).toBeTruthy()
    expect(nextRun).toBeNull()
  })

  it("hourly cron english description", () => {
    const { english } = describeCron("0 * * * *", "UTC")
    expect(english.toLowerCase()).toContain("hour")
  })
})
