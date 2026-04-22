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
