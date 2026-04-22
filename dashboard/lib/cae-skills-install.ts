import { spawn } from "node:child_process"
import type { SpawnOptionsWithoutStdio } from "node:child_process"

export type InstallEvent = { type: "line" | "err" | "done"; data: string }

// Allowlist: owner/name slug or https://github.com/... URL
// T-14-02-01: argv array injection mitigation
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const URL_OK =
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\/tree\/[A-Za-z0-9_./-]+)?$/

/**
 * Installs a skill via `npx skills add <repo>` and yields events:
 *   { type: "line", data: string } — each stdout chunk
 *   { type: "err",  data: string } — each stderr chunk
 *   { type: "done", data: exitCode.toString() }
 *
 * Security: repo is validated against REPO_RE or URL_OK before spawn.
 * spawn is called with an argv ARRAY (never shell:true) to prevent injection.
 * SKILLS_TELEMETRY_DISABLED=1 prevents telemetry calls.
 */
export async function* installSkill(
  repo: string,
  spawnImpl: typeof spawn = spawn
): AsyncIterable<InstallEvent> {
  if (!REPO_RE.test(repo) && !URL_OK.test(repo)) {
    throw new Error(`invalid repo: ${repo}`)
  }

  const opts: SpawnOptionsWithoutStdio = {
    env: { ...process.env, SKILLS_TELEMETRY_DISABLED: "1" },
    // shell: false is the default — explicitly NOT setting shell:true (T-14-02-01)
  }

  const proc = spawnImpl("npx", ["-y", "skills", "add", repo], opts)

  // Collect exit code via promise so we wait for the process to finish
  const exitCodePromise = new Promise<number>((resolve) => {
    proc.on("close", (code: number) => resolve(code ?? 1))
  })

  // Drain stdout first, yielding each chunk
  try {
    for await (const chunk of proc.stdout as AsyncIterable<Buffer>) {
      yield { type: "line", data: chunk.toString() }
    }
  } catch {
    // stdout ended or not available
  }

  // Drain stderr
  try {
    for await (const chunk of proc.stderr as AsyncIterable<Buffer>) {
      yield { type: "err", data: chunk.toString() }
    }
  } catch {
    // stderr ended or not available
  }

  // Wait for process to exit
  const code = await exitCodePromise
  yield { type: "done", data: String(code) }
}
