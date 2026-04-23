import { spawn } from "node:child_process"
import type { SpawnOptionsWithoutStdio } from "node:child_process"

export type InstallEvent = { type: "line" | "err" | "done"; data: string }

// Allowlist: owner/name slug or https://github.com/... URL
// T-14-02-01: argv array injection mitigation
//
// CR-02 fix: tightened from /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/ to require
// each segment to START with an alphanumeric or underscore (blocks leading `-`,
// leading `.`, and pure-dot tokens like `..` or `.`).
//
// Safe slug segment: starts with [A-Za-z0-9_], then any mix of [A-Za-z0-9_.-]
// This rejects:  `..`, `.`, `-x`, `--help`, `../foo`, `foo/..`, `foo/.`
const SLUG_SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/

/** owner/name short-form slug */
const REPO_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*\/[A-Za-z0-9_][A-Za-z0-9_.-]*$/

const URL_OK =
  /^https:\/\/github\.com\/[A-Za-z0-9_][A-Za-z0-9_.-]*\/[A-Za-z0-9_][A-Za-z0-9_.-]*(\/tree\/[A-Za-z0-9_./-]+)?$/

/**
 * isSafeRepo — validates that a slug has no dot-only segments (`.` or `..`).
 *
 * REPO_RE already blocks leading-dot and leading-dash segments.
 * This extra check blocks the residual case where a trailing dot creates a
 * segment that normalises to a parent directory (e.g. `foo/..` would pass a
 * naive regex if dots were allowed mid-token, but our regex already blocks it;
 * this is belt-and-suspenders).
 *
 * CR-02: explicitly reject `.` and `..` segment names even if the regex
 * somehow allowed them (defense-in-depth).
 */
export function isSafeRepo(repo: string): boolean {
  if (!REPO_RE.test(repo)) return false
  const [owner, name] = repo.split("/")
  // Reject pure-dot segments — belt-and-suspenders on top of REPO_RE
  if (owner === "." || owner === ".." || name === "." || name === "..") return false
  // Each segment must pass the segment regex (should always be true after REPO_RE, but explicit)
  if (!SLUG_SEGMENT.test(owner) || !SLUG_SEGMENT.test(name)) return false
  return true
}

/**
 * Installs a skill via `npx skills add <repo>` and yields events:
 *   { type: "line", data: string } — each stdout chunk
 *   { type: "err",  data: string } — each stderr chunk
 *   { type: "done", data: exitCode.toString() }
 *
 * Security: repo is validated against REPO_RE/isSafeRepo or URL_OK before spawn.
 * spawn is called with an argv ARRAY (never shell:true) to prevent injection.
 * SKILLS_TELEMETRY_DISABLED=1 prevents telemetry calls.
 */
export async function* installSkill(
  repo: string,
  spawnImpl: typeof spawn = spawn
): AsyncIterable<InstallEvent> {
  const isSlug = isSafeRepo(repo)
  const isUrl = !isSlug && URL_OK.test(repo)
  if (!isSlug && !isUrl) {
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
