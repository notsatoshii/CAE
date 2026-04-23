/**
 * audit/fixtures/empty.ts — Phase 15 Cap.2.
 *
 * Seeds a project root with an empty `.cae/metrics/` layout: the files
 * exist but have zero lines. Aggregator contract says zero rows → zero
 * counts (see cae-mission-control-state.ts `emptyMissionControl`).
 *
 * Fixture purpose: drive the "nothing is running" branch of every panel
 * so we can screenshot empty states and voice-check copy.
 */
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

// caveman: write empty files so tail reads succeed with 0 rows
export async function seed(root: string): Promise<void> {
  const metricsDir = join(root, ".cae", "metrics")
  const sessionsDir = join(root, ".cae", "sessions")
  await mkdir(metricsDir, { recursive: true })
  await mkdir(sessionsDir, { recursive: true })
  await writeFile(join(metricsDir, "circuit-breakers.jsonl"), "", "utf8")
  await writeFile(join(metricsDir, "tool-calls.jsonl"), "", "utf8")
}
