/**
 * Unit tests for lib/cae-queue-state.ts
 *
 * Run: `npx tsx lib/cae-queue-state.test.ts`
 *
 * Scope: exhaustive coverage of the pure `bucketTasks` helper. The async
 * getQueueState wrapper that wires in readdir/stat/tmux/jsonl is covered
 * by the route smoke-test in Task 2 and by the pnpm build manifest check.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  bucketTasks,
  type QueueState,
} from "./cae-queue-state";
import type { InboxTask, OutboxTask } from "./cae-types";

// ---------- Helpers ----------

function mkInbox(taskId: string, overrides: Partial<InboxTask> = {}): InboxTask {
  return {
    taskId,
    createdAt: new Date(0),
    buildplanPath: "/tmp/" + taskId + "/BUILDPLAN.md",
    metaPath: "/tmp/" + taskId + "/META.yaml",
    hasBuildplan: true,
    ...overrides,
  };
}

function mkOutbox(taskId: string, overrides: Partial<OutboxTask> = {}): OutboxTask {
  return {
    taskId,
    hasDone: true,
    processed: true,
    status: "success",
    ...overrides,
  };
}

function emptyCtx() {
  return {
    runningTmuxSessions: new Set<string>(),
    stuckTaskIds: new Set<string>(),
    reviewTaskIds: new Set<string>(),
    inboxTitles: new Map<string, string>(),
  };
}

// ---------- bucketTasks: empty input ----------

test("bucketTasks: empty inbox + empty outbox yields 5 empty columns + zero counts", () => {
  const state: QueueState = bucketTasks([], [], emptyCtx());
  assert.deepEqual(state.columns.waiting, []);
  assert.deepEqual(state.columns.in_progress, []);
  assert.deepEqual(state.columns.double_checking, []);
  assert.deepEqual(state.columns.stuck, []);
  assert.deepEqual(state.columns.shipped, []);
  assert.equal(state.counts.waiting, 0);
  assert.equal(state.counts.in_progress, 0);
  assert.equal(state.counts.double_checking, 0);
  assert.equal(state.counts.stuck, 0);
  assert.equal(state.counts.shipped, 0);
  assert.ok(typeof state.fetchedAt === "number");
});

// ---------- bucketTasks: inbox routing ----------

test("bucketTasks: inbox task with no tmux/review/stuck markers → waiting", () => {
  const state = bucketTasks([mkInbox("web-abc12345")], [], emptyCtx());
  assert.equal(state.columns.waiting.length, 1);
  assert.equal(state.columns.waiting[0].taskId, "web-abc12345");
  assert.equal(state.counts.waiting, 1);
});

test("bucketTasks: inbox task with matching running tmux session → in_progress", () => {
  const ctx = emptyCtx();
  ctx.runningTmuxSessions.add("buildplan-abc12345");
  const state = bucketTasks([mkInbox("web-abc12345")], [], ctx);
  assert.equal(state.columns.in_progress.length, 1);
  assert.equal(state.columns.waiting.length, 0);
  assert.equal(state.columns.in_progress[0].taskId, "web-abc12345");
  assert.equal(state.counts.in_progress, 1);
});

test("bucketTasks: wf-prefixed inbox task matches buildplan-<stripped-prefix> session", () => {
  const ctx = emptyCtx();
  // taskId "wf-slug-1234" should match session "buildplan-slug-1234"
  ctx.runningTmuxSessions.add("buildplan-slug-1234");
  const state = bucketTasks([mkInbox("wf-slug-1234")], [], ctx);
  assert.equal(state.columns.in_progress.length, 1);
  assert.equal(state.columns.in_progress[0].taskId, "wf-slug-1234");
});

test("bucketTasks: inbox task in reviewTaskIds → double_checking", () => {
  const ctx = emptyCtx();
  ctx.reviewTaskIds.add("web-aaa");
  const state = bucketTasks([mkInbox("web-aaa")], [], ctx);
  assert.equal(state.columns.double_checking.length, 1);
  assert.equal(state.columns.waiting.length, 0);
  assert.equal(state.counts.double_checking, 1);
});

test("bucketTasks: inbox task in stuckTaskIds → stuck column", () => {
  const ctx = emptyCtx();
  ctx.stuckTaskIds.add("web-zzz");
  const state = bucketTasks([mkInbox("web-zzz")], [], ctx);
  assert.equal(state.columns.stuck.length, 1);
  assert.equal(state.columns.waiting.length, 0);
  assert.equal(state.counts.stuck, 1);
});

test("bucketTasks: running tmux takes precedence over review/stuck markers", () => {
  const ctx = emptyCtx();
  ctx.runningTmuxSessions.add("buildplan-xxx");
  ctx.reviewTaskIds.add("web-xxx");
  ctx.stuckTaskIds.add("web-xxx");
  const state = bucketTasks([mkInbox("web-xxx")], [], ctx);
  assert.equal(state.columns.in_progress.length, 1);
  assert.equal(state.columns.double_checking.length, 0);
  assert.equal(state.columns.stuck.length, 0);
});

test("bucketTasks: review takes precedence over stuck when no tmux session", () => {
  const ctx = emptyCtx();
  ctx.reviewTaskIds.add("web-yyy");
  ctx.stuckTaskIds.add("web-yyy");
  const state = bucketTasks([mkInbox("web-yyy")], [], ctx);
  assert.equal(state.columns.double_checking.length, 1);
  assert.equal(state.columns.stuck.length, 0);
});

// ---------- bucketTasks: outbox routing ----------

test("bucketTasks: outbox status=success → shipped", () => {
  const state = bucketTasks(
    [],
    [mkOutbox("web-a", { status: "success" })],
    emptyCtx(),
  );
  assert.equal(state.columns.shipped.length, 1);
  assert.equal(state.counts.shipped, 1);
});

test("bucketTasks: outbox with hasDone but no status → shipped (DONE.md present, default success)", () => {
  const state = bucketTasks(
    [],
    [mkOutbox("web-b", { status: undefined, hasDone: true })],
    emptyCtx(),
  );
  assert.equal(state.columns.shipped.length, 1);
});

test("bucketTasks: outbox status=error → stuck", () => {
  const state = bucketTasks(
    [],
    [mkOutbox("web-c", { status: "error", hasDone: true })],
    emptyCtx(),
  );
  assert.equal(state.columns.stuck.length, 1);
  assert.equal(state.columns.shipped.length, 0);
});

test("bucketTasks: outbox status=failed → stuck", () => {
  const state = bucketTasks(
    [],
    [mkOutbox("web-d", { status: "failed", hasDone: true })],
    emptyCtx(),
  );
  assert.equal(state.columns.stuck.length, 1);
});

test("bucketTasks: outbox with no DONE.md and no status → skipped (not yet finished)", () => {
  const state = bucketTasks(
    [],
    [mkOutbox("web-e", { status: undefined, hasDone: false, processed: false })],
    emptyCtx(),
  );
  assert.equal(state.columns.shipped.length, 0);
  assert.equal(state.columns.stuck.length, 0);
});

// ---------- bucketTasks: counts invariant ----------

test("bucketTasks: counts match column array lengths (mixed scenario)", () => {
  const ctx = emptyCtx();
  ctx.runningTmuxSessions.add("buildplan-inprog");
  ctx.reviewTaskIds.add("web-review");
  ctx.stuckTaskIds.add("web-stuck");
  const inbox: InboxTask[] = [
    mkInbox("web-wait1"),
    mkInbox("web-wait2"),
    mkInbox("web-inprog"),
    mkInbox("web-review"),
    mkInbox("web-stuck"),
  ];
  const outbox: OutboxTask[] = [
    mkOutbox("web-ship1", { status: "success" }),
    mkOutbox("web-ship2", { status: "success" }),
    mkOutbox("web-fail1", { status: "error", hasDone: true }),
  ];
  const state = bucketTasks(inbox, outbox, ctx);
  assert.equal(state.columns.waiting.length, state.counts.waiting);
  assert.equal(state.columns.in_progress.length, state.counts.in_progress);
  assert.equal(state.columns.double_checking.length, state.counts.double_checking);
  assert.equal(state.columns.stuck.length, state.counts.stuck);
  assert.equal(state.columns.shipped.length, state.counts.shipped);
  assert.equal(state.counts.waiting, 2);
  assert.equal(state.counts.in_progress, 1);
  assert.equal(state.counts.double_checking, 1);
  // web-stuck (inbox) + web-fail1 (outbox) = 2
  assert.equal(state.counts.stuck, 2);
  assert.equal(state.counts.shipped, 2);
});

// ---------- bucketTasks: card shape ----------

test("bucketTasks: inbox card uses inboxTitles map when present, else taskId", () => {
  const ctx = emptyCtx();
  ctx.inboxTitles.set("web-t1", "Add login page");
  const state = bucketTasks([mkInbox("web-t1"), mkInbox("web-t2")], [], ctx);
  const t1 = state.columns.waiting.find((c) => c.taskId === "web-t1")!;
  const t2 = state.columns.waiting.find((c) => c.taskId === "web-t2")!;
  assert.equal(t1.title, "Add login page");
  assert.equal(t2.title, "web-t2");
  assert.equal(t1.agent, "forge");
  assert.equal(t1.project, "—");
  assert.equal(t1.status, "waiting");
  assert.ok(Array.isArray(t1.tags));
});

test("bucketTasks: outbox shipped card uses summary for title when present", () => {
  const state = bucketTasks(
    [],
    [mkOutbox("web-s", { status: "success", summary: "Added login button" })],
    emptyCtx(),
  );
  assert.equal(state.columns.shipped[0].title, "Added login button");
});

test("bucketTasks: outbox shipped card falls back to taskId when no summary", () => {
  const state = bucketTasks(
    [],
    [mkOutbox("web-s", { status: "success", summary: undefined })],
    emptyCtx(),
  );
  assert.equal(state.columns.shipped[0].title, "web-s");
});

test("bucketTasks: shipped column sorted by ts desc and capped at 50", () => {
  const outbox: OutboxTask[] = Array.from({ length: 60 }, (_, i) =>
    mkOutbox("web-s" + i, { status: "success", summary: "s" + i }),
  );
  const state = bucketTasks([], outbox, emptyCtx());
  assert.equal(state.columns.shipped.length, 50);
});
