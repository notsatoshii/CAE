/**
 * Phase 8 Wave 2 (D-07, MEM-10): per-file git log + diff for memory sources.
 *
 * Both `gitLogForFile` and `gitDiff` route through `execFile` with arg
 * arrays (no shell interpolation), 30s timeout, 5 MiB buffer, and a
 * strict allowlist:
 *   - `projectRoot` MUST be in `getAllowedRoots()`
 *   - `absFilePath` MUST start with `projectRoot + "/"` AND pass
 *     `isMemorySourcePath`
 *   - git shas MUST match /^[0-9a-f]{7,40}$/ (belt-and-suspenders even
 *     though execFile is shell-safe)
 * On non-zero git exit the functions return `[]` / `""` respectively and
 * log to stderr; raw git errors never leak to the caller.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { relative } from "node:path";
import { getAllowedRoots, isMemorySourcePath } from "./cae-memory-sources";

const TIMEOUT_MS = 30_000;
const MAX_BUFFER = 5 * 1024 * 1024;
const MAX_COMMITS = 500;
const SHA_RE = /^[0-9a-f]{7,40}$/;

// Internal injection hook so unit tests can swap execFile without mocking
// Node's built-in module (see cae-memory-search.ts for the same pattern).
let _execFileP: (
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeout?: number; maxBuffer?: number },
) => Promise<{ stdout: string; stderr: string }> = promisify(execFile) as unknown as (
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeout?: number; maxBuffer?: number },
) => Promise<{ stdout: string; stderr: string }>;

export function __setExecFileForTests(
  impl:
    | ((
        cmd: string,
        args: string[],
        opts: { cwd?: string; timeout?: number; maxBuffer?: number },
      ) => Promise<{ stdout: string; stderr: string }>)
    | null,
): void {
  if (impl === null) {
    _execFileP = promisify(execFile) as unknown as typeof _execFileP;
  } else {
    _execFileP = impl;
  }
}

export interface GitLogEntry {
  sha: string; // 40-char hex
  ts: number; // epoch seconds (from %ct)
  author: string;
  subject: string;
}

async function assertAllowed(projectRoot: string, absFilePath: string): Promise<void> {
  const allowed = await getAllowedRoots();
  if (!allowed.includes(projectRoot)) {
    throw new Error("project root not in allowlist");
  }
  if (!absFilePath.startsWith(projectRoot + "/")) {
    throw new Error("file path escapes project root");
  }
  if (!isMemorySourcePath(absFilePath)) {
    throw new Error("file path is not a memory source");
  }
}

/**
 * Per-file git log via `git log --follow --pretty=format:%H%x09%ct%x09%an%x09%s`.
 * Each output line is tab-separated: sha\tts\tauthor\tsubject. Returns at most
 * `MAX_COMMITS` rows. Returns `[]` on any git error (logged server-side).
 */
export async function gitLogForFile(
  projectRoot: string,
  absFilePath: string,
  since?: string,
  until?: string,
): Promise<GitLogEntry[]> {
  await assertAllowed(projectRoot, absFilePath);
  const relPath = relative(projectRoot, absFilePath);

  const args = [
    "log",
    "--follow",
    "--pretty=format:%H%x09%ct%x09%an%x09%s",
  ];
  if (since && typeof since === "string" && since.length > 0) {
    args.push("--since=" + since);
  }
  if (until && typeof until === "string" && until.length > 0) {
    args.push("--until=" + until);
  }
  args.push("--", relPath);

  try {
    const { stdout } = await _execFileP("git", args, {
      cwd: projectRoot,
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
    });
    const lines = stdout.split("\n").filter((l) => l.length > 0);
    const entries: GitLogEntry[] = [];
    for (const line of lines) {
      const parts = line.split("\t");
      if (parts.length < 4) continue;
      const [sha, ctRaw, author, ...subjectParts] = parts;
      const ts = parseInt(ctRaw, 10);
      if (!Number.isFinite(ts)) continue;
      entries.push({
        sha,
        ts,
        author,
        subject: subjectParts.join("\t"),
      });
      if (entries.length >= MAX_COMMITS) break;
    }
    return entries;
  } catch (err) {
    console.error("[cae-memory-git] gitLogForFile failed", err);
    return [];
  }
}

/**
 * Return `git diff <shaA>..<shaB> -- <relPath>` for a memory source file.
 * Both shas must match the 7-40 hex pattern. Returns "" on any git error.
 */
export async function gitDiff(
  projectRoot: string,
  shaA: string,
  shaB: string,
  absFilePath: string,
): Promise<string> {
  if (!SHA_RE.test(shaA)) throw new Error("invalid sha A");
  if (!SHA_RE.test(shaB)) throw new Error("invalid sha B");
  await assertAllowed(projectRoot, absFilePath);
  const relPath = relative(projectRoot, absFilePath);

  try {
    const { stdout } = await _execFileP(
      "git",
      ["diff", shaA + ".." + shaB, "--", relPath],
      {
        cwd: projectRoot,
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
      },
    );
    return stdout;
  } catch (err) {
    console.error("[cae-memory-git] gitDiff failed", err);
    return "";
  }
}
