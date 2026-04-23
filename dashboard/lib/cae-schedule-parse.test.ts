import { describe, it, expect, vi } from "vitest"
import { parseSchedule } from "./cae-schedule-parse"

describe("parseSchedule — golden set (rule-based)", () => {
  const cases: [string, string][] = [
    ["every morning at 9am", "0 9 * * *"],
    ["every day at 8:30am", "30 8 * * *"],
    ["every day at 9am", "0 9 * * *"],
    ["every weekday at 7pm", "0 19 * * 1-5"],
    ["every weekday at 8:30am", "30 8 * * 1-5"],
    ["every monday at 10am", "0 10 * * 1"],
    ["every tuesday at 3pm", "0 15 * * 2"],
    ["every wednesday at 12pm", "0 12 * * 3"],
    ["every thursday at 6am", "0 6 * * 4"],
    ["every friday at 5pm", "0 17 * * 5"],
    ["every saturday at 9am", "0 9 * * 6"],
    ["every sunday at 6pm", "0 18 * * 0"],
    ["every 15 minutes", "*/15 * * * *"],
    ["every 30 minutes", "*/30 * * * *"],
    ["every hour", "0 * * * *"],
    ["every 2 hours", "0 */2 * * *"],
    ["every 4 hours", "0 */4 * * *"],
    ["at midnight", "0 0 * * *"],
    ["at noon", "0 12 * * *"],
    ["every weekend at 10am", "0 10 * * 0,6"],
    ["every minute", "* * * * *"],
  ]

  it.each(cases)('parses "%s" → "%s"', async (nl, expected) => {
    const result = await parseSchedule(nl)
    expect(result.cron).toBe(expected)
    expect(result.source).toBe("rule")
    expect(result.confidence).toBe("high")
  })
})

describe("parseSchedule — LLM fallback", () => {
  it("calls LLM fallback when rule fails and returns valid cron", async () => {
    const mockLlm = vi.fn().mockResolvedValue({ cron: "0 9 * * 2" })
    const result = await parseSchedule("sometime next tuesday-ish", mockLlm)
    expect(mockLlm).toHaveBeenCalledOnce()
    expect(result.source).toBe("llm")
    expect(result.confidence).toBe("medium")
    expect(result.cron).toBe("0 9 * * 2")
  })

  it("throws when LLM returns invalid cron", async () => {
    const mockLlm = vi.fn().mockResolvedValue({ cron: "not-a-cron" })
    await expect(parseSchedule("weird phrase", mockLlm)).rejects.toThrow('Could not parse: "weird phrase"')
  })

  it("propagates LLM error", async () => {
    const mockLlm = vi.fn().mockRejectedValue(new Error("LLM timeout"))
    await expect(parseSchedule("unclear", mockLlm)).rejects.toThrow("LLM timeout")
  })
})

// ─── WR-03 regression: LLM cadence guard ──────────────────────────────────────
describe("WR-03: parseSchedule — LLM cadence guard rejects sub-5-minute intervals", () => {
  // All tests use nl phrases that do NOT match any rule, so the mock LLM is called.

  it("WR-03a: LLM returns '* * * * *' (every minute) → throws cadence error", async () => {
    const mockLlm = vi.fn().mockResolvedValue({ cron: "* * * * *" })
    await expect(parseSchedule("run constantly please", mockLlm)).rejects.toThrow(/minimum interval/)
  })

  it("WR-03b: LLM returns '*/2 * * * *' (every 2 minutes) → throws cadence error", async () => {
    const mockLlm = vi.fn().mockResolvedValue({ cron: "*/2 * * * *" })
    await expect(parseSchedule("very frequently please", mockLlm)).rejects.toThrow(/minimum interval/)
  })

  it("WR-03c: LLM returns '*/4 * * * *' (every 4 minutes) → throws cadence error", async () => {
    const mockLlm = vi.fn().mockResolvedValue({ cron: "*/4 * * * *" })
    await expect(parseSchedule("almost every five minutes please", mockLlm)).rejects.toThrow(/minimum interval/)
  })

  it("WR-03d: LLM returns '*/5 * * * *' (every 5 minutes, exactly at floor) → allowed", async () => {
    // Uses nl that won't match rule table ("quinquennial" is not in rules)
    const mockLlm = vi.fn().mockResolvedValue({ cron: "*/5 * * * *" })
    const result = await parseSchedule("quinquennial interval check", mockLlm)
    expect(result.cron).toBe("*/5 * * * *")
    expect(result.source).toBe("llm")
  })

  it("WR-03e: LLM returns '0 * * * *' (every hour) → allowed", async () => {
    const mockLlm = vi.fn().mockResolvedValue({ cron: "0 * * * *" })
    const result = await parseSchedule("once an hour please", mockLlm)
    expect(result.cron).toBe("0 * * * *")
    expect(result.source).toBe("llm")
  })

  it("WR-03f: rule-matched 'every minute' bypasses cadence guard (rule-path, not LLM)", async () => {
    // Rule-matched crons don't go through the LLM cadence check — intentional.
    // The user explicitly typed "every minute" and the rule table matched deterministically.
    const result = await parseSchedule("every minute")
    expect(result.cron).toBe("* * * * *")
    expect(result.source).toBe("rule")
  })

  it("WR-03g: rule-matched 'every 15 minutes' bypasses cadence guard (rule-path)", async () => {
    // Rule-table matches are deterministic user intent, not LLM output.
    const result = await parseSchedule("every 15 minutes")
    expect(result.cron).toBe("*/15 * * * *")
    expect(result.source).toBe("rule")
  })
})
