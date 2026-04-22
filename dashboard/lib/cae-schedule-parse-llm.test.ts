import { describe, it, expect } from "vitest"
import { defaultLlm } from "./cae-schedule-parse-llm"

describe("defaultLlm — test environment guard", () => {
  it("throws in test environment (VITEST=true)", async () => {
    // vitest sets process.env.VITEST to 'true' when running
    await expect(defaultLlm("every morning")).rejects.toThrow(
      "LLM disabled in test"
    )
  })
})
