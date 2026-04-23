#!/usr/bin/env node
/**
 * backfill-activity.ts — Class 15B.
 *
 * Retroactively emits commit-type rows for every commit in the last N days
 * so the Recent Commits + ActivityFeed cards aren't empty on first load.
 *
 * Idempotent: reads the existing activity.jsonl, collects every sha already
 * recorded, and skips them on re-run. Safe to schedule nightly.
 *
 * Usage:
 *   npx tsx dashboard/scripts/backfill-activity.ts [--since "7 days ago"]
 *     [--repo <path>] [--out <activity.jsonl>]
 *
 * Env:
 *   CAE_ROOT  — default /home/cae/ctrl-alt-elite; used for both the repo
 *               to read commits from AND the output activity.jsonl path.
 */

import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  buildCommitEvent,
  emitActivity,
  ACTIVITY_JSONL_PATH,
} from "../lib/cae-event-emit"
import { CAE_ROOT } from "../lib/cae-config"

interface Args {
  since: string
  repo: string
  out: string
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    since: "3 days ago",
    repo: CAE_ROOT,
    out: ACTIVITY_JSONL_PATH,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--since") args.since = argv[++i]
    else if (a === "--repo") args.repo = argv[++i]
    else if (a === "--out") args.out = argv[++i]
  }
  return args
}

/**
 * Collect every sha already recorded in activity.jsonl so we don't double-
 * emit. Sha is meta.sha on commit-type rows emitted by buildCommitEvent.
 * Malformed rows are silently skipped (the union reader does the same).
 */
function readExistingShas(path: string): Set<string> {
  const shas = new Set<string>()
  let text: string
  try {
    text = readFileSync(path, "utf8")
  } catch {
    return shas
  }
  for (const line of text.split("\n")) {
    if (!line) continue
    try {
      const row = JSON.parse(line) as {
        type?: string
        meta?: { sha?: string }
      }
      if (row.type === "commit" && typeof row.meta?.sha === "string") {
        shas.add(row.meta.sha)
      }
    } catch {
      // skip malformed
    }
  }
  return shas
}

/**
 * Drive git log with a custom format so we get one line per commit with
 * everything we need. Field separator is U+001F (ASCII unit separator)
 * so commit subjects containing pipes/tabs don't break parsing.
 */
function listCommits(
  repo: string,
  since: string,
): Array<{
  sha: string
  shortSha: string
  isoTs: string
  author: string
  subject: string
}> {
  const SEP = "\x1f"
  const FORMAT = ["%H", "%h", "%cI", "%an", "%s"].join(SEP)
  const raw = execFileSync(
    "git",
    ["log", `--since=${since}`, `--format=${FORMAT}`],
    { cwd: repo, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  )
  const out: Array<{
    sha: string
    shortSha: string
    isoTs: string
    author: string
    subject: string
  }> = []
  for (const line of raw.split("\n")) {
    if (!line) continue
    const parts = line.split(SEP)
    if (parts.length < 5) continue
    out.push({
      sha: parts[0],
      shortSha: parts[1],
      isoTs: parts[2],
      author: parts[3],
      subject: parts[4],
    })
  }
  return out
}

/**
 * Count files touched by a commit. Used for meta.files_changed_count to
 * power a future "delta size" signal in the feed UI. Bounded via
 * maxBuffer so very large merges don't OOM.
 */
function countFilesChanged(repo: string, sha: string): number {
  try {
    const raw = execFileSync(
      "git",
      ["diff-tree", "--no-commit-id", "--name-only", "-r", sha],
      { cwd: repo, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    )
    return raw.split("\n").filter((l) => l.length > 0).length
  } catch {
    return 0
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const existing = readExistingShas(args.out)
  const commits = listCommits(args.repo, args.since)

  let emitted = 0
  let skipped = 0
  for (const c of commits) {
    if (existing.has(c.sha)) {
      skipped++
      continue
    }
    const event = buildCommitEvent({
      sha: c.sha,
      shortSha: c.shortSha,
      subject: c.subject,
      author: c.author,
      filesChangedCount: countFilesChanged(args.repo, c.sha),
      ts: c.isoTs,
    })
    await emitActivity(event, { filePath: args.out })
    emitted++
  }

  // eslint-disable-next-line no-console -- this is a CLI script
  console.log(
    `[backfill-activity] emitted=${emitted} skipped_existing=${skipped} window='${args.since}' out=${args.out}`,
  )
}

// Only execute when run as a script, not when imported for tests.
if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[backfill-activity] fatal:", err)
    process.exit(1)
  })
}

export { main as runBackfill, readExistingShas, listCommits, parseArgs }
