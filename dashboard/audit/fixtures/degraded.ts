/**
 * audit/fixtures/degraded.ts — Phase 15 Cap.2.
 *
 * Slow/erroring scenario: 30 events but 5 forge_ends are failures, token
 * usage is above 80% of budget (triggers budget-warning UI), and one agent
 * is silent (no token_usage events) so per-agent panels can render a
 * "missing tokens" state.
 *
 * Timestamps are all within the last 30 minutes — recent enough for the
 * liveness dots to be lit, stale enough that nothing is still running.
 */
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

// caveman: expected-truth for degraded fixture. All events 1-30min old
// so active_count=0; 5 of 30 ended with failure; budget bar should
// read "above 80%" because each event burns 40-50k input tokens.
export function readExpectedTruth(): Record<string, string> {
  return {
    "mission-control.active-count": "0",
    "mission-control.degraded": "true",
    "mission-control.failure-count": "5",
    "metrics.budget-warning": "true",
    "tool-calls.last-60s": "3", // only 3 entries in last minute at 20s cadence
  }
}

const AGENTS = ["forge", "sentinel", "phantom"] as const
const MODELS = ["sonnet", "opus", "haiku"] as const
const TOOLS = ["Bash", "Read", "Edit", "Write", "Grep"] as const

function tsAt(now: number, offsetMs: number): string {
  return new Date(now - offsetMs).toISOString()
}

export async function seed(root: string): Promise<void> {
  const now = Date.now()
  const metricsDir = join(root, ".cae", "metrics")
  const sessionsDir = join(root, ".cae", "sessions")
  await mkdir(metricsDir, { recursive: true })
  await mkdir(sessionsDir, { recursive: true })

  const cbLines: string[] = []
  const toolLines: string[] = []

  // 30 forge_begin events; 25 end ok, 5 end with success=false (failures).
  // All ages 1..30 minutes old so nothing is "active" in the 5-minute window.
  for (let i = 0; i < 30; i++) {
    const agent = AGENTS[i % AGENTS.length]
    const model = MODELS[i % MODELS.length]
    const taskId = `p15-pl${String(i + 1).padStart(2, "0")}-t1`
    const beginAgo = 30 * 60_000 - i * 55_000
    cbLines.push(
      JSON.stringify({
        ts: tsAt(now, beginAgo),
        event: "forge_begin",
        task_id: taskId,
        agent,
        model,
      }),
    )

    const endAgo = Math.max(5_000, beginAgo - 4_000)
    const failure = i % 6 === 0 // every 6th — 5 total failures across 30.
    cbLines.push(
      JSON.stringify({
        ts: tsAt(now, endAgo),
        event: "forge_end",
        task_id: taskId,
        agent,
        model,
        success: !failure,
        input_tokens: 50_000 + i * 500, // high burn
        output_tokens: 20_000 + i * 200,
      }),
    )

    // Phantom agent silent: only forge/sentinel emit token_usage.
    if (agent !== "phantom") {
      cbLines.push(
        JSON.stringify({
          ts: tsAt(now, beginAgo),
          event: "token_usage",
          task_id: taskId,
          agent,
          model,
          input_tokens: 40_000 + i * 500,
          output_tokens: 15_000 + i * 200,
        }),
      )
    }
  }

  // 30 tool calls, sparse — 1 every 20s so sparkline looks anemic.
  for (let i = 0; i < 30; i++) {
    toolLines.push(
      JSON.stringify({
        ts: tsAt(now, i * 20_000),
        task: `p15-pl${String((i % 30) + 1).padStart(2, "0")}-t1`,
        tool: TOOLS[i % TOOLS.length],
        cwd: root,
      }),
    )
  }

  await writeFile(
    join(metricsDir, "circuit-breakers.jsonl"),
    cbLines.join("\n") + "\n",
    "utf8",
  )
  await writeFile(
    join(metricsDir, "tool-calls.jsonl"),
    toolLines.reverse().join("\n") + "\n",
    "utf8",
  )
}
