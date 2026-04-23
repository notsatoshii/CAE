/**
 * audit/fixtures/broken.ts — Phase 15 Cap.2.
 *
 * Corrupted / malformed state: mixes valid rows, malformed JSON, and
 * unknown event kinds. Aggregators must not throw — they skip bad rows
 * silently (see parseCb / parseTools in cae-mission-control-state.ts:
 * the `if (r === null || typeof r !== "object") continue` guard).
 *
 * The tool-calls.jsonl file intentionally contains non-JSON garbage
 * + a row missing `ts` + a row missing `tool` to exercise every defensive
 * branch in parseTools. The healthy row in the middle lets us assert
 * aggregators still find SOMETHING.
 *
 * Fixture purpose: prove the UI renders gracefully when upstream writers
 * ship broken data — no white screens, no console explosions, no NaN.
 */
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

export async function seed(root: string): Promise<void> {
  const now = Date.now()
  const metricsDir = join(root, ".cae", "metrics")
  const sessionsDir = join(root, ".cae", "sessions")
  await mkdir(metricsDir, { recursive: true })
  await mkdir(sessionsDir, { recursive: true })

  const tsNow = (offset: number): string =>
    new Date(now - offset).toISOString()

  // cb rows: one valid, one malformed JSON, one missing required fields,
  // one unknown event kind, one good forge_end for pairing.
  const cbLines: string[] = [
    JSON.stringify({
      ts: tsNow(30_000),
      event: "forge_begin",
      task_id: "p15-pl01-t1",
      agent: "forge",
      model: "sonnet",
    }),
    // Malformed JSON — tailJsonl should skip silently.
    '{"ts": "not-a-date", "event": "forge_begin", "task_id": "bad', // truncated
    // Missing `ts` — parseCb rejects.
    JSON.stringify({ event: "forge_end", task_id: "orphan" }),
    // Missing `event` — parseCb rejects.
    JSON.stringify({ ts: tsNow(10_000), task_id: "orphan-2" }),
    // Unknown event kind — aggregators ignore but don't crash.
    JSON.stringify({
      ts: tsNow(5_000),
      event: "cosmic_ray_hit",
      payload: { anything: "goes" },
    }),
    // Valid forge_end closing the first begin so active_count stays 0.
    JSON.stringify({
      ts: tsNow(20_000),
      event: "forge_end",
      task_id: "p15-pl01-t1",
      agent: "forge",
      model: "sonnet",
      success: true,
      input_tokens: 100,
      output_tokens: 50,
    }),
    // Garbage after a valid row — single non-JSON token on its own line.
    "THIS IS NOT JSON",
    // Row with null ts/event (wrong types) — rejected.
    JSON.stringify({ ts: null, event: null }),
  ]

  const toolLines: string[] = [
    JSON.stringify({
      ts: tsNow(1_000),
      task: "p15-pl01-t1",
      tool: "Bash",
      cwd: root,
    }),
    // Empty object → no ts/tool, rejected.
    "{}",
    // Missing tool — parseTools rejects.
    JSON.stringify({ ts: tsNow(2_000), task: "x", cwd: root }),
    // Empty tool string — parseTools rejects (tool.length === 0).
    JSON.stringify({ ts: tsNow(3_000), task: "x", tool: "", cwd: root }),
    // Completely unparseable line.
    "definitely not json at all",
  ]

  await writeFile(
    join(metricsDir, "circuit-breakers.jsonl"),
    cbLines.join("\n") + "\n",
    "utf8",
  )
  await writeFile(
    join(metricsDir, "tool-calls.jsonl"),
    toolLines.join("\n") + "\n",
    "utf8",
  )
}
