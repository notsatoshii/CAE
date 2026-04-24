/**
 * cae-queue-item.ts — Queue-item detail + mutation helpers (class19b).
 *
 * Powers the new /build/queue clicked-card sheet. Queue items are NOT phases,
 * so they need their own shape — the Phase 4 TaskDetailSheet was built for
 * phase-shaped data and that mismatch is what caused the 8 `toast.info`
 * stubs and the "Phase 8/9" hardcodes.
 *
 * Responsibilities:
 *   - QueueItemDetail type — title, summary, log path, status, tags,
 *     createdAt, hasReviewMarker, hasHaltMarker, hasDone, outboxSummary.
 *   - getQueueItem(taskId) — async loader that reads the inbox + outbox for
 *     a single task. Returns null when the id is unknown.
 *   - Mutation primitives used by the API route handlers:
 *       abortTask, retryTask, approveReview, denyReview
 *     Each is a thin wrapper around tmux / filesystem markers; the API
 *     layer is responsible for auth + RBAC.
 *
 * Task-id validation — shared with /api/workflows/[slug]/run. Any caller
 * that takes a taskId from user input MUST run TASK_ID_RE first before
 * passing it to shell strings.
 */

import { exec } from "child_process";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { promisify } from "util";
import { spawn } from "child_process";
import { INBOX_ROOT, OUTBOX_ROOT } from "./cae-config";

const execP = promisify(exec);

/** Task id allowlist — alphanumeric + hyphen + underscore. Same as workflows. */
export const TASK_ID_RE = /^[a-zA-Z0-9_-]+$/;

export interface QueueItemDetail {
  /** taskId as stored on disk (directory name under inbox/ or outbox/). */
  taskId: string;
  /** First non-blank heading line of BUILDPLAN.md; falls back to taskId. */
  title: string;
  /** Short human-friendly summary — from outbox DONE.md or META.yaml description. */
  summary: string;
  /** Relative-to-repo log path for SSE tailing (or "" when no log yet). */
  logPath: string;
  /** Absolute path to the BUILDPLAN.md the agent is executing. */
  buildplanPath: string;
  /** ms-since-epoch; createdAt of the inbox dir, or mtime of outbox DONE.md. */
  ts: number;
  /** Tags scraped from META.yaml (`tags: [a, b]`) — empty array if none. */
  tags: string[];
  /** Lifecycle state inferred from markers + tmux + outbox. */
  status: "waiting" | "in_progress" | "double_checking" | "stuck" | "shipped";
  /** True iff inbox dir contains SENTINEL_REVIEW marker. */
  hasReviewMarker: boolean;
  /** True iff inbox dir contains HALT marker. */
  hasHaltMarker: boolean;
  /** True iff outbox/<id>/DONE.md exists. */
  hasDone: boolean;
  /** True iff a live tmux session matches this task. */
  running: boolean;
  /** Raw outbox status ("success" | "error" | "failed" | etc), when present. */
  outboxStatus: string | null;
}

// ---------- Helpers ----------

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function safeRead(p: string): Promise<string | null> {
  try {
    return await readFile(p, "utf8");
  } catch {
    return null;
  }
}

function firstHeading(text: string, fallback: string): string {
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const stripped = line.replace(/^#+\s*/, "").trim();
    if (!stripped) continue;
    return stripped.length > 120 ? stripped.slice(0, 117) + "…" : stripped;
  }
  return fallback;
}

/** Dead-simple YAML-ish tag extractor — looks for `tags:` then either
 *  inline `[a, b]` or a bulleted list on following lines. Good enough for
 *  META.yaml files the cae CLI writes; keeps us out of the yaml-parse
 *  dependency tree for this one field. */
function extractTags(metaText: string): string[] {
  const lines = metaText.split("\n");
  const tagIdx = lines.findIndex((l) => /^\s*tags\s*:/.test(l));
  if (tagIdx < 0) return [];
  const tagLine = lines[tagIdx];
  const inlineMatch = tagLine.match(/\[(.*)\]/);
  if (inlineMatch) {
    return inlineMatch[1]
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  const out: string[] = [];
  for (let i = tagIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(/^\s*-\s*["']?([^"'\n]+?)["']?\s*$/);
    if (!m) break;
    out.push(m[1].trim());
  }
  return out;
}

async function listRunningTmuxSessions(): Promise<Set<string>> {
  try {
    const { stdout } = await execP("tmux list-sessions -F '#S' 2>/dev/null", {
      timeout: 2000,
    });
    return new Set(
      stdout
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("buildplan-")),
    );
  } catch {
    return new Set();
  }
}

function shortIdForTmux(taskId: string): string {
  return taskId.replace(/^web-/, "").replace(/^wf-/, "").slice(0, 128);
}

/** Locate the stdout/stderr log path for a queue task. The cae CLI writes
 *  per-task logs under `/home/cae/inbox/<id>/agent.log` by convention; if
 *  that's missing we return "" so SheetLiveLog renders "no stream". */
async function resolveLogPath(taskId: string): Promise<string> {
  if (!TASK_ID_RE.test(taskId)) return "";
  const candidates = [
    join(INBOX_ROOT, taskId, "agent.log"),
    join(INBOX_ROOT, taskId, "run.log"),
    join(OUTBOX_ROOT, taskId, "agent.log"),
  ];
  for (const p of candidates) {
    if (await fileExists(p)) return p;
  }
  return "";
}

// ---------- Public read ----------

export async function getQueueItem(taskId: string): Promise<QueueItemDetail | null> {
  if (!TASK_ID_RE.test(taskId)) return null;

  const inboxDir = join(INBOX_ROOT, taskId);
  const outboxDir = join(OUTBOX_ROOT, taskId);
  const [inboxExists, outboxExists, tmuxSessions] = await Promise.all([
    fileExists(inboxDir),
    fileExists(outboxDir),
    listRunningTmuxSessions(),
  ]);

  if (!inboxExists && !outboxExists) return null;

  const buildplanPath = join(inboxDir, "BUILDPLAN.md");
  const metaPath = join(inboxDir, "META.yaml");
  const reviewMarker = join(inboxDir, "SENTINEL_REVIEW");
  const haltMarker = join(inboxDir, "HALT");
  const donePath = join(outboxDir, "DONE.md");

  const [buildplanText, metaText, hasReview, hasHalt, hasDone, donePathStat] =
    await Promise.all([
      safeRead(buildplanPath),
      safeRead(metaPath),
      fileExists(reviewMarker),
      fileExists(haltMarker),
      fileExists(donePath),
      stat(donePath).catch(() => null),
    ]);

  const inboxStat = inboxExists ? await stat(inboxDir).catch(() => null) : null;
  const ts = donePathStat?.mtimeMs ?? inboxStat?.birthtimeMs ?? inboxStat?.mtimeMs ?? Date.now();
  const title = buildplanText ? firstHeading(buildplanText, taskId) : taskId;
  const tags = metaText ? extractTags(metaText) : [];

  const sessionName = "buildplan-" + shortIdForTmux(taskId);
  const running = tmuxSessions.has(sessionName);

  // Outbox status — best-effort parse of DONE.md first line or STATUS file.
  const outboxStatusText = outboxExists
    ? (await safeRead(join(outboxDir, "STATUS"))) ?? ""
    : "";
  const outboxStatus = outboxStatusText.trim() || (hasDone ? "success" : null);

  let status: QueueItemDetail["status"];
  if (running) status = "in_progress";
  else if (hasReview) status = "double_checking";
  else if (hasHalt || outboxStatus === "error" || outboxStatus === "failed") status = "stuck";
  else if (hasDone) status = "shipped";
  else status = "waiting";

  const summary = hasDone
    ? firstHeading((await safeRead(donePath)) ?? "", "Shipped")
    : hasHalt
      ? "Halted — retry to resume"
      : hasReview
        ? "Awaiting review"
        : running
          ? "Agent is working on this"
          : "Queued — will start when capacity frees";

  return {
    taskId,
    title,
    summary,
    logPath: await resolveLogPath(taskId),
    buildplanPath,
    ts,
    tags,
    status,
    hasReviewMarker: hasReview,
    hasHaltMarker: hasHalt,
    hasDone,
    running,
    outboxStatus,
  };
}

// ---------- Mutations ----------

export type MutationResult =
  | { ok: true; action: string; taskId: string }
  | { ok: false; action: string; taskId: string; error: string };

export async function abortTask(taskId: string): Promise<MutationResult> {
  if (!TASK_ID_RE.test(taskId))
    return { ok: false, action: "abort", taskId, error: "invalid taskId" };
  const inboxDir = join(INBOX_ROOT, taskId);
  if (!(await fileExists(inboxDir)))
    return { ok: false, action: "abort", taskId, error: "task not found" };
  const sessionName = "buildplan-" + shortIdForTmux(taskId);
  // Best-effort tmux kill; a missing session just means the task wasn't running.
  try {
    await execP("tmux kill-session -t " + JSON.stringify(sessionName) + " 2>/dev/null", {
      timeout: 2000,
    });
  } catch {
    // Non-fatal — the task may not have a session.
  }
  // Drop a HALT marker so the kanban reports "stuck" and the CLI retry loop
  // stops attempting to re-spawn. We do NOT delete the inbox dir — retry
  // must still be able to resume without re-creating BUILDPLAN.md.
  try {
    await writeFile(join(inboxDir, "HALT"), "aborted-by-dashboard\n", "utf8");
  } catch (err) {
    return {
      ok: false,
      action: "abort",
      taskId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  return { ok: true, action: "abort", taskId };
}

export async function retryTask(taskId: string): Promise<MutationResult> {
  if (!TASK_ID_RE.test(taskId))
    return { ok: false, action: "retry", taskId, error: "invalid taskId" };
  const inboxDir = join(INBOX_ROOT, taskId);
  if (!(await fileExists(inboxDir)))
    return { ok: false, action: "retry", taskId, error: "task not found" };
  // Remove HALT marker (resume path) + clear SENTINEL_REVIEW so the runner
  // picks this back up cleanly.
  for (const m of ["HALT", "SENTINEL_REVIEW"]) {
    const p = join(inboxDir, m);
    if (await fileExists(p)) await unlink(p).catch(() => {});
  }
  // Kick off a fresh tmux session — `cae execute-buildplan` is idempotent;
  // if the task is already running in another session this just starts a
  // no-op twin that exits quickly.
  const shortId = shortIdForTmux(taskId);
  try {
    const child = spawn(
      "tmux",
      [
        "new-session",
        "-d",
        "-s",
        "buildplan-" + shortId,
        "cae execute-buildplan " + taskId,
      ],
      { detached: true, stdio: "ignore" },
    );
    child.unref();
  } catch (err) {
    return {
      ok: false,
      action: "retry",
      taskId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  return { ok: true, action: "retry", taskId };
}

export async function approveReview(taskId: string): Promise<MutationResult> {
  if (!TASK_ID_RE.test(taskId))
    return { ok: false, action: "approve", taskId, error: "invalid taskId" };
  const inboxDir = join(INBOX_ROOT, taskId);
  const reviewMarker = join(inboxDir, "SENTINEL_REVIEW");
  if (!(await fileExists(reviewMarker)))
    return {
      ok: false,
      action: "approve",
      taskId,
      error: "no review marker — nothing to approve",
    };
  try {
    await unlink(reviewMarker);
    await writeFile(join(inboxDir, "APPROVED"), "approved-by-dashboard\n", "utf8");
  } catch (err) {
    return {
      ok: false,
      action: "approve",
      taskId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  return { ok: true, action: "approve", taskId };
}

export async function denyReview(taskId: string): Promise<MutationResult> {
  if (!TASK_ID_RE.test(taskId))
    return { ok: false, action: "deny", taskId, error: "invalid taskId" };
  const inboxDir = join(INBOX_ROOT, taskId);
  const reviewMarker = join(inboxDir, "SENTINEL_REVIEW");
  if (!(await fileExists(reviewMarker)))
    return {
      ok: false,
      action: "deny",
      taskId,
      error: "no review marker — nothing to deny",
    };
  try {
    await unlink(reviewMarker);
    await writeFile(join(inboxDir, "HALT"), "denied-by-dashboard\n", "utf8");
  } catch (err) {
    return {
      ok: false,
      action: "deny",
      taskId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  return { ok: true, action: "deny", taskId };
}

// ---------- Test hooks ----------
// Re-exports so tests can stub fs / tmux without poking internals.
export const __internal__ = {
  extractTags,
  firstHeading,
  shortIdForTmux,
};
