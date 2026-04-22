/**
 * Queue-state aggregator — powers /api/queue (Phase 6 KANBAN).
 *
 * Responsibilities:
 *   - QueueCard / QueueState / QueueCardStatus types
 *   - `bucketTasks(inbox, outbox, ctx)` — PURE routing function
 *     (unit-tested in cae-queue-state.test.ts).
 *   - `getQueueState()` — async wrapper that wires readdir/stat/tmux/jsonl.
 *
 * Bucketing heuristics (from 06-CONTEXT.md §Bucketing heuristics + 06-02 plan):
 *   - waiting: inbox task, no tmux session, no review/stuck marker
 *   - in_progress: inbox task with matching `buildplan-{shortId}` tmux session
 *   - double_checking: inbox task with SENTINEL_REVIEW marker
 *   - stuck: inbox task with HALT marker / retry_count ≥ 3  OR
 *            outbox task with status `error` / `failed`
 *   - shipped: outbox task with status `success` (or hasDone + no explicit status)
 *
 * Shape of the shortId for matching tmux sessions:
 *   - Phase 2 `web-{uuid8}` → strips `web-` → session `buildplan-{uuid8}`
 *   - Phase 6 `wf-{slug}-{ts}-{uuid4}` → strips `wf-` → session `buildplan-{slug-ts-uuid4}`
 */

import { exec } from "child_process";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { promisify } from "util";

import { listInbox, listOutbox, listProjects, tailJsonl } from "./cae-state";
import type { InboxTask, OutboxTask } from "./cae-types";

const execP = promisify(exec);

// ---------- Types ----------

export type QueueCardStatus =
  | "waiting"
  | "in_progress"
  | "double_checking"
  | "stuck"
  | "shipped";

export interface QueueCard {
  taskId: string;
  title: string;
  agent: string;
  project: string;
  status: QueueCardStatus;
  ts: number;
  tags: string[];
}

export interface QueueState {
  columns: {
    waiting: QueueCard[];
    in_progress: QueueCard[];
    double_checking: QueueCard[];
    stuck: QueueCard[];
    shipped: QueueCard[];
  };
  counts: {
    waiting: number;
    in_progress: number;
    double_checking: number;
    stuck: number;
    shipped: number;
  };
  fetchedAt: number;
}

export interface BucketCtx {
  runningTmuxSessions: Set<string>;
  stuckTaskIds: Set<string>;
  reviewTaskIds: Set<string>;
  inboxTitles: Map<string, string>;
}

// ---------- Constants ----------

const COLUMN_CAP = 50;
const DEFAULT_AGENT = "forge";
const DEFAULT_PROJECT = "—";

// ---------- Pure bucket logic (unit-tested) ----------

function shortIdForTmux(taskId: string): string {
  // Mirror Phase 2's `web-{uuid8}` → `buildplan-{uuid8}` + Phase 6's
  // `wf-{slug}-{ts}-{uuid4}` → `buildplan-{slug-ts-uuid4}`.
  return taskId.replace(/^web-/, "").replace(/^wf-/, "").slice(0, 128);
}

function inboxCard(task: InboxTask, status: QueueCardStatus, title: string): QueueCard {
  return {
    taskId: task.taskId,
    title,
    agent: DEFAULT_AGENT,
    project: DEFAULT_PROJECT,
    status,
    ts: task.createdAt instanceof Date ? task.createdAt.getTime() : Number(task.createdAt) || 0,
    tags: [],
  };
}

function outboxCard(task: OutboxTask, status: QueueCardStatus, ts: number): QueueCard {
  const title =
    (typeof task.summary === "string" && task.summary.trim().length > 0
      ? task.summary.trim().slice(0, 80)
      : null) ?? task.taskId;
  return {
    taskId: task.taskId,
    title,
    agent: DEFAULT_AGENT,
    project: DEFAULT_PROJECT,
    status,
    ts,
    tags: [],
  };
}

export function bucketTasks(
  inbox: InboxTask[],
  outbox: OutboxTask[],
  ctx: BucketCtx,
): QueueState {
  const waiting: QueueCard[] = [];
  const in_progress: QueueCard[] = [];
  const double_checking: QueueCard[] = [];
  const stuck: QueueCard[] = [];
  const shipped: QueueCard[] = [];

  for (const t of inbox) {
    const sessionName = "buildplan-" + shortIdForTmux(t.taskId);
    const title = ctx.inboxTitles.get(t.taskId) ?? t.taskId;

    if (ctx.runningTmuxSessions.has(sessionName)) {
      in_progress.push(inboxCard(t, "in_progress", title));
    } else if (ctx.reviewTaskIds.has(t.taskId)) {
      double_checking.push(inboxCard(t, "double_checking", title));
    } else if (ctx.stuckTaskIds.has(t.taskId)) {
      stuck.push(inboxCard(t, "stuck", title));
    } else {
      waiting.push(inboxCard(t, "waiting", title));
    }
  }

  for (const t of outbox) {
    const ts = 0; // mtime-of-DONE not in OutboxTask shape; async wrapper fills.
    if (t.status === "error" || t.status === "failed") {
      stuck.push(outboxCard(t, "stuck", ts));
    } else if (t.status === "success" || (t.hasDone && !t.status)) {
      shipped.push(outboxCard(t, "shipped", ts));
    }
    // else: no DONE.md yet + no status → skip (inbox side likely has it)
  }

  // Sort shipped + stuck by ts desc, cap at 50.
  shipped.sort((a, b) => b.ts - a.ts);
  stuck.sort((a, b) => b.ts - a.ts);

  return {
    columns: {
      waiting: waiting.slice(0, COLUMN_CAP),
      in_progress: in_progress.slice(0, COLUMN_CAP),
      double_checking: double_checking.slice(0, COLUMN_CAP),
      stuck: stuck.slice(0, COLUMN_CAP),
      shipped: shipped.slice(0, COLUMN_CAP),
    },
    counts: {
      waiting: Math.min(waiting.length, COLUMN_CAP),
      in_progress: Math.min(in_progress.length, COLUMN_CAP),
      double_checking: Math.min(double_checking.length, COLUMN_CAP),
      stuck: Math.min(stuck.length, COLUMN_CAP),
      shipped: Math.min(shipped.length, COLUMN_CAP),
    },
    fetchedAt: Date.now(),
  };
}

// ---------- Async wiring ----------

async function listRunningTmuxSessions(): Promise<Set<string>> {
  try {
    const { stdout } = await execP("tmux list-sessions -F '#S' 2>/dev/null", {
      timeout: 2000,
    });
    const lines = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("buildplan-"));
    return new Set(lines);
  } catch {
    // tmux not running / no sessions / not installed → all fine, no sessions.
    return new Set();
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function firstLine(path: string, fallback: string): Promise<string> {
  try {
    const text = await readFile(path, "utf8");
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const stripped = line.replace(/^#+\s*/, "").trim();
      if (!stripped) continue;
      return stripped.length > 80 ? stripped.slice(0, 77) + "…" : stripped;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

async function computeStuckFromCircuitBreakers(): Promise<Set<string>> {
  const stuckIds = new Set<string>();
  try {
    const projects = await listProjects();
    for (const proj of projects) {
      const cbPath = join(proj.path, ".cae", "metrics", "circuit-breakers.jsonl");
      const entries = await tailJsonl(cbPath, 300).catch(() => [] as unknown[]);
      const retryCount = new Map<string, number>();
      const haltIds = new Set<string>();
      const resumeIds = new Set<string>();
      for (const entry of entries) {
        if (typeof entry !== "object" || entry === null) continue;
        const e = entry as Record<string, unknown>;
        const event = typeof e.event === "string" ? e.event : undefined;
        const taskId = typeof e.taskId === "string" ? e.taskId : undefined;
        if (!event || !taskId) continue;
        if (event === "retry") {
          retryCount.set(taskId, (retryCount.get(taskId) ?? 0) + 1);
        } else if (event === "halt") {
          haltIds.add(taskId);
        } else if (event === "resume") {
          resumeIds.add(taskId);
        }
      }
      for (const [taskId, n] of retryCount) {
        if (n >= 3) stuckIds.add(taskId);
      }
      for (const taskId of haltIds) {
        if (!resumeIds.has(taskId)) stuckIds.add(taskId);
      }
    }
  } catch {
    // Non-fatal — empty set is a safe default.
  }
  return stuckIds;
}

export async function getQueueState(): Promise<QueueState> {
  const [inbox, outbox, runningTmuxSessions, stuckTaskIds] = await Promise.all([
    listInbox(),
    listOutbox(),
    listRunningTmuxSessions(),
    computeStuckFromCircuitBreakers(),
  ]);

  // Inbox review markers: task dir contains SENTINEL_REVIEW file.
  const reviewTaskIds = new Set<string>();
  const inboxTitles = new Map<string, string>();
  for (const t of inbox) {
    const taskDir = t.buildplanPath.replace(/\/BUILDPLAN\.md$/, "");
    const reviewMarker = join(taskDir, "SENTINEL_REVIEW");
    const haltMarker = join(taskDir, "HALT");
    const [hasReview, hasHalt] = await Promise.all([
      fileExists(reviewMarker),
      fileExists(haltMarker),
    ]);
    if (hasReview) reviewTaskIds.add(t.taskId);
    if (hasHalt) stuckTaskIds.add(t.taskId);

    if (t.hasBuildplan) {
      const title = await firstLine(t.buildplanPath, t.taskId);
      inboxTitles.set(t.taskId, title);
    }
  }

  const state = bucketTasks(inbox, outbox, {
    runningTmuxSessions,
    stuckTaskIds,
    reviewTaskIds,
    inboxTitles,
  });
  return state;
}
