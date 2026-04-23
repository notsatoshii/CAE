/**
 * cae-event-emit.ts — Class 15A.
 *
 * Canonical emitter for the unified CAE activity stream.
 *
 * Eric (session 11): "the FE shows that you or all these agents you have
 * running aren't running the build history shows nothing in the logs etc."
 *
 * Root cause: dashboard tails per-event-type JSONL files (circuit-breakers,
 * tool-calls, scheduler, heartbeat). Large swaths of real work — git commits,
 * audit cycles, vision scoring, chat turns, skill installs — never land in
 * any of those streams. So the dashboard looks dead even when the repo is on
 * fire.
 *
 * Fix: a single append-only JSONL at `.cae/metrics/activity.jsonl` that any
 * producer (hook, cron, shell script, TS runner, API route) can shout into.
 * The dashboard unions this with the existing streams via cae-activity-feed.
 *
 * Concurrency: POSIX guarantees atomic writes up to PIPE_BUF (≥512B on
 * Linux). One JSONL line is ~150–400B so concurrent producers NEVER
 * interleave within a line. No lockfile, no mutex, no fancy footwork.
 *
 * Performance: open → write → close per event. Individual events cost
 * ~1ms; we append dozens per minute at peak. No need for buffered I/O.
 */

import { appendFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { CAE_ROOT } from "./cae-config"

/**
 * Kinds of activity the dashboard knows how to render.
 *
 * `other` is the catch-all — producers that don't fit an existing kind can
 * emit it and the UI will render a generic row. Adding a new kind is a
 * non-breaking change (readers tolerate unknown strings, and new icons can
 * land in a follow-up commit).
 */
export type ActivityEventType =
  | "commit"
  | "agent_spawn"
  | "agent_complete"
  | "cycle_step"
  | "vision_score"
  | "chat_turn"
  | "workflow_run"
  | "queue_delegate"
  | "skill_install"
  | "other"

export interface ActivityEvent {
  /** ISO-8601 UTC timestamp, millisecond precision. Producers MUST set this. */
  ts: string
  /** Event kind — maps to icon + default copy in the feed UI. */
  type: ActivityEventType
  /** Machine-readable producer id, e.g. "git-post-commit", "audit-run-cycle". */
  source: string
  /** Optional agent / user / system name that did the thing. */
  actor?: string
  /** Optional CAE phase id ("15", "p7-pl03-t1", etc). */
  phase?: string
  /** One-line human readable description rendered verbatim in the feed row. */
  summary: string
  /** Arbitrary structured payload — sha, counts, URLs, whatever helps the UI. */
  meta?: Record<string, unknown>
}

/**
 * Default canonical path. Pinned to CAE_ROOT so producers outside dashboard/
 * (git hooks, audit shell scripts, cron jobs) write to the same file the
 * dashboard tails.
 */
export const ACTIVITY_JSONL_PATH = join(
  CAE_ROOT,
  ".cae",
  "metrics",
  "activity.jsonl",
)

export interface EmitActivityOpts {
  /** Override the output path — tests + multi-project setups. */
  filePath?: string
}

/**
 * Append a single activity event to the canonical JSONL.
 *
 * Parent directory is created on demand (cheap mkdir -p) so a fresh repo
 * doesn't need anyone to pre-create `.cae/metrics/`.
 *
 * Throws only on filesystem failures (permission denied, out of disk, etc).
 * Callers that must not fail the user action (e.g. git hooks) should wrap
 * in try/catch and log.
 */
export async function emitActivity(
  event: ActivityEvent,
  opts: EmitActivityOpts = {},
): Promise<void> {
  const filePath = opts.filePath ?? ACTIVITY_JSONL_PATH
  await mkdir(dirname(filePath), { recursive: true })
  const line = JSON.stringify(event) + "\n"
  await appendFile(filePath, line, "utf8")
}

/**
 * Convenience wrapper: current ISO timestamp, commit-type event.
 * Exposed so producers don't have to re-derive the ts format every time.
 */
export function buildCommitEvent(args: {
  sha: string
  shortSha: string
  subject: string
  author: string
  filesChangedCount: number
  ts?: string
}): ActivityEvent {
  return {
    ts: args.ts ?? new Date().toISOString(),
    type: "commit",
    source: "git-post-commit",
    actor: args.author,
    summary: `${args.shortSha} ${args.subject}`,
    meta: {
      sha: args.sha,
      short_sha: args.shortSha,
      subject: args.subject,
      files_changed_count: args.filesChangedCount,
    },
  }
}
