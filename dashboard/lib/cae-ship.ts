/**
 * lib/cae-ship.ts — Phase 10 D-11 ship wizard primitives + D-12 execute-phase spawn.
 * REQ-10-07 + REQ-10-09.
 */
import { execFile, spawn } from "child_process"
import { writeFile, chmod } from "fs/promises"
import { join, basename } from "path"
import type { Project } from "./cae-types"

const CAE_BIN = "/usr/local/bin/cae"

export interface EnvExampleKey {
  name: string
  /** Default/example value from the .env.example (may be empty string). */
  example: string
  /** true when the line had no value after `=` — signals "required, fill in". */
  required: boolean
}

export interface ShipSubmitInput {
  [key: string]: string
}

// Matches uppercase env var key lines: KEY= or KEY=value (keeps value verbatim, incl. inline comments per Shift convention).
const ENV_LINE_RE = /^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/

/**
 * Parse .env.example raw text. Skips comment lines and blank lines.
 * Returns an array of key name strings (for backward-compat with test scaffold).
 * Inline trailing `# comments` on a value line are kept as part of the example
 * value (Shift convention — do NOT strip them).
 */
export function parseEnvExample(raw: string): string[] {
  const out: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue
    const m = ENV_LINE_RE.exec(line)
    if (!m) continue
    out.push(m[1])
  }
  return out
}

/**
 * Return a sanitized record containing only keys present in the whitelist.
 * Throws `Error("unknown env key: <KEY>")` on any key not in the whitelist.
 * Whitelist may be a string array (key names) or an EnvExampleKey array — both are supported.
 */
export function validateShipInput(
  input: Record<string, string>,
  whitelist: string[] | EnvExampleKey[],
): Record<string, string> {
  const allowed = new Set<string>(
    whitelist.map((w) => (typeof w === "string" ? w : w.name)),
  )
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(input)) {
    if (!allowed.has(k)) throw new Error(`unknown env key: ${k}`)
    clean[k] = typeof v === "string" ? v : String(v ?? "")
  }
  return clean
}

/**
 * Check GitHub CLI authentication status.
 * Uses callback-based execFile so the vi.mock("child_process") in tests can intercept it.
 * Resolves { authed: true } on exit 0, { authed: false, stderr } on failure.
 */
export function ghAuthStatus(): Promise<{ authed: boolean; stderr?: string }> {
  return new Promise((resolve) => {
    // Call without options so the callback is the 3rd arg — matches vi.mock("child_process") signature
    // used in tests: mockImplementation((_cmd, _args, callback) => { callback(...) }).
    execFile("gh", ["auth", "status"], (err, _stdout, stderr) => {
      if (err) {
        resolve({ authed: false, stderr: stderr || String(err) })
      } else {
        resolve({ authed: true })
      }
    })
  })
}

/**
 * Write `<proj.path>/.env.local` with mode 0o600. Overwrites existing file.
 * Returns absolute path of the written file.
 */
export async function writeEnvLocal(proj: Project, values: Record<string, string>): Promise<string> {
  const file = join(proj.path, ".env.local")
  const body = Object.entries(values).map(([k, v]) => `${k}=${v}`).join("\n") + "\n"
  await writeFile(file, body, { encoding: "utf8", mode: 0o600 })
  // writeFile's mode is advisory when file already exists (umask may apply); enforce with chmod.
  await chmod(file, 0o600)
  return file
}

/** POSIX single-quote shell escaping. */
function quote(s: string): string {
  return `'` + s.replace(/'/g, `'\\''`) + `'`
}

/**
 * Spawn tmux-detached `gh repo create <name> --source=. --private --push` inside proj.path.
 * Returns { sid, logFile } immediately — does not wait for completion.
 */
export async function runGhRepoCreate(proj: Project, repoName: string): Promise<{ sid: string; logFile: string }> {
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(repoName)) throw new Error("invalid repo name")
  const sid = `ship-gh-${basename(proj.path)}-${Date.now().toString(36)}`
  const logDir = join(proj.path, ".cae", "logs")
  const logFile = join(logDir, `ship-gh-${Date.now()}.log`)
  const inner = `mkdir -p ${quote(logDir)} && cd ${quote(proj.path)} && gh repo create ${quote(repoName)} --source=. --private --push 2>&1 | tee ${quote(logFile)}`
  const child = spawn("tmux", ["new-session", "-d", "-s", sid, inner], { detached: true, stdio: "ignore" })
  child.unref()
  return { sid, logFile }
}

/**
 * Spawn tmux-detached `cae execute-phase <N>` inside proj.path.
 * Reuses the same tmux pattern as runShiftNext in cae-shift.ts.
 * Returns { sid, logFile } immediately.
 */
export async function runCaeExecutePhase(proj: Project, phaseNum: number): Promise<{ sid: string; logFile: string }> {
  if (!Number.isInteger(phaseNum) || phaseNum < 1 || phaseNum > 99) throw new Error("invalid phase")
  const sid = `ship-exec-${basename(proj.path)}-p${phaseNum}-${Date.now().toString(36)}`
  const logDir = join(proj.path, ".cae", "logs")
  const logFile = join(logDir, `ship-phase${phaseNum}-${Date.now()}.log`)
  const inner = `mkdir -p ${quote(logDir)} && cd ${quote(proj.path)} && ${CAE_BIN} execute-phase ${phaseNum} 2>&1 | tee ${quote(logFile)}`
  const child = spawn("tmux", ["new-session", "-d", "-s", sid, inner], { detached: true, stdio: "ignore" })
  child.unref()
  return { sid, logFile }
}
