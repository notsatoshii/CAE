import { spawn } from "node:child_process"

/**
 * LLM fallback for NL schedule parsing.
 *
 * In test environments (VITEST=true or NODE_ENV=test) this throws immediately
 * so tests must inject a mock. In production it shells out to `claude --print`
 * with a constrained prompt and parses the returned JSON.
 *
 * Security: prompt is passed as argv array element (no shell:true).
 */
export async function defaultLlm(nl: string): Promise<{ cron: string }> {
  // Guard: never call real LLM in tests — tests MUST inject a mock
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
    throw new Error("LLM disabled in test — use mock")
  }

  const prompt =
    `Convert this English schedule to a 5-field cron expression. ` +
    `Return ONLY JSON {"cron":"..."} with no extra text or explanation. ` +
    `Input: ${nl}`

  return new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      ["--print", "--model", "claude-haiku-4-5", prompt],
      { stdio: ["ignore", "pipe", "pipe"] }
    )

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`claude exited ${code}: ${stderr.trim()}`))
        return
      }
      // Find the JSON object in the output
      const match = stdout.match(/\{[^}]+\}/)
      if (!match) {
        reject(new Error(`claude returned no JSON: ${stdout.trim()}`))
        return
      }
      try {
        const result = JSON.parse(match[0]) as { cron: string }
        resolve(result)
      } catch {
        reject(new Error(`claude returned unparseable JSON: ${match[0]}`))
      }
    })
  })
}
