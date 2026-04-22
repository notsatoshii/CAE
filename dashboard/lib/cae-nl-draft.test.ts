/**
 * Unit tests for lib/cae-nl-draft.ts
 *
 * Run: `npx tsx lib/cae-nl-draft.test.ts`
 *
 * Every rule (name / trigger / step) has its own test. Final sweep asserts
 * every heuristic output passes validateWorkflow() with zero errors — this
 * is the hard invariant: the UI draft button must never produce a spec that
 * fails validation.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { heuristicDraft } from "./cae-nl-draft";
import { validateWorkflow } from "./cae-workflows";

// ---------- Empty / trivial ----------

test("heuristicDraft: empty string returns minimal stub", () => {
  const d = heuristicDraft("");
  assert.equal(d.name, "new-recipe");
  assert.equal(d.trigger.type, "manual");
  assert.deepEqual(d.steps, []);
});

test("heuristicDraft: whitespace-only string returns stub", () => {
  const d = heuristicDraft("   \n  \t ");
  assert.equal(d.name, "new-recipe");
  assert.equal(d.trigger.type, "manual");
});

// ---------- Trigger detection ----------

test("heuristicDraft: 'every Monday' → cron schedule 0 9 * * 1", () => {
  const d = heuristicDraft("every Monday forge runs tests");
  assert.equal(d.trigger.type, "cron");
  assert.equal(d.trigger.schedule, "0 9 * * 1");
});

test("heuristicDraft: 'every tuesday at 7am' → hour extracted", () => {
  const d = heuristicDraft("every tuesday at 7am forge runs");
  assert.equal(d.trigger.type, "cron");
  assert.equal(d.trigger.schedule, "0 7 * * 2");
});

test("heuristicDraft: 'every day' → daily cron", () => {
  const d = heuristicDraft("every day forge does something");
  assert.equal(d.trigger.type, "cron");
  assert.equal(d.trigger.schedule, "0 9 * * *");
});

test("heuristicDraft: 'weekly' without day defaults to Monday", () => {
  const d = heuristicDraft("weekly forge runs");
  assert.equal(d.trigger.type, "cron");
  assert.equal(d.trigger.schedule, "0 9 * * 1");
});

test("heuristicDraft: 'when task fails' → event trigger", () => {
  const d = heuristicDraft("when task fails sentinel reviews");
  assert.equal(d.trigger.type, "event");
  assert.equal(d.trigger.on, "task.failed");
});

test("heuristicDraft: no trigger keyword → manual", () => {
  const d = heuristicDraft("forge runs pnpm test then push");
  assert.equal(d.trigger.type, "manual");
});

test("heuristicDraft: '12pm' and '12am' handled correctly", () => {
  const noon = heuristicDraft("every wednesday at 12pm forge runs");
  assert.equal(noon.trigger.schedule, "0 12 * * 3");
  const midnight = heuristicDraft("every thursday at 12am forge runs");
  assert.equal(midnight.trigger.schedule, "0 0 * * 4");
});

test("heuristicDraft: all day names recognized", () => {
  const days: Array<[string, number]> = [
    ["sunday", 0],
    ["monday", 1],
    ["tuesday", 2],
    ["wednesday", 3],
    ["thursday", 4],
    ["friday", 5],
    ["saturday", 6],
  ];
  for (const [day, n] of days) {
    const d = heuristicDraft(`every ${day} forge runs`);
    assert.equal(d.trigger.type, "cron");
    assert.equal(d.trigger.schedule, `0 9 * * ${n}`);
  }
});

// ---------- Step detection ----------

test("heuristicDraft: 'forge runs pnpm test' → forge step", () => {
  const d = heuristicDraft("forge runs pnpm test");
  assert.ok(d.steps.some((s) => "agent" in s && s.agent === "forge"));
  const forge = d.steps.find((s) => "agent" in s) as {
    agent: string;
    task: string;
  };
  assert.ok(forge.task.includes("pnpm test") || forge.task.includes("runs pnpm test"));
});

test("heuristicDraft: 'sentinel reviews' → sentinel step with task 'review'", () => {
  const d = heuristicDraft("sentinel reviews");
  const sentinel = d.steps.find(
    (s) => "agent" in s && s.agent === "sentinel",
  ) as { agent: string; task: string } | undefined;
  assert.ok(sentinel);
  assert.equal(sentinel!.task, "review");
});

test("heuristicDraft: 'approve' → approval gate with telegram notify", () => {
  const d = heuristicDraft("approve");
  const gate = d.steps.find((s) => "gate" in s) as {
    gate: string;
    notify?: string;
  } | undefined;
  assert.ok(gate);
  assert.equal(gate!.gate, "approval");
  assert.equal(gate!.notify, "telegram");
});

test("heuristicDraft: 'ask me first' → approval gate", () => {
  const d = heuristicDraft("ask me first");
  const gate = d.steps.find((s) => "gate" in s);
  assert.ok(gate);
});

test("heuristicDraft: 'push to main' → push action", () => {
  const d = heuristicDraft("push to main");
  const action = d.steps.find((s) => "action" in s) as { action: string } | undefined;
  assert.ok(action);
  assert.equal(action!.action, "push");
});

test("heuristicDraft: 'abort' → abort action", () => {
  const d = heuristicDraft("abort");
  const action = d.steps.find((s) => "action" in s) as { action: string } | undefined;
  assert.ok(action);
  assert.equal(action!.action, "abort");
});

test("heuristicDraft: 'branch' → branch action", () => {
  const d = heuristicDraft("branch");
  const action = d.steps.find((s) => "action" in s) as { action: string } | undefined;
  assert.ok(action);
  assert.equal(action!.action, "branch");
});

// ---------- Full-sentence composition (the canonical example) ----------

test("heuristicDraft: weekly recipe with 4 steps in order", () => {
  const d = heuristicDraft(
    "Upgrade deps weekly. Forge updates npm. Sentinel reviews. Approve. Push.",
  );
  assert.equal(d.trigger.type, "cron");
  assert.equal(d.trigger.schedule, "0 9 * * 1");
  // Name = first sentence slugified, first 5 words
  assert.equal(d.name, "upgrade-deps-weekly");
  // 4 steps in order: forge, sentinel, gate, push
  assert.equal(d.steps.length, 4);
  assert.ok("agent" in d.steps[0] && d.steps[0].agent === "forge");
  assert.ok("agent" in d.steps[1] && d.steps[1].agent === "sentinel");
  assert.ok("gate" in d.steps[2]);
  assert.ok("action" in d.steps[3] && d.steps[3].action === "push");
});

test("heuristicDraft: canonical example from plan", () => {
  const d = heuristicDraft(
    "every Monday, forge runs tests, sentinel reviews, I approve, push",
  );
  assert.equal(d.trigger.type, "cron");
  assert.equal(d.trigger.schedule, "0 9 * * 1");
  assert.equal(d.steps.length, 4);
  assert.ok("agent" in d.steps[0] && d.steps[0].agent === "forge");
  assert.ok("agent" in d.steps[1] && d.steps[1].agent === "sentinel");
  assert.ok("gate" in d.steps[2]);
  assert.ok("action" in d.steps[3] && d.steps[3].action === "push");
});

test("heuristicDraft: 'then' splits fragments like sentences do", () => {
  const d = heuristicDraft("forge runs tests then sentinel reviews then push");
  // Expect at least 3 steps
  assert.ok(d.steps.length >= 3);
});

// ---------- Name derivation ----------

test("heuristicDraft: name from first sentence, first 5 words, slugified", () => {
  const d = heuristicDraft("Upgrade all the dependencies quickly this week. Forge runs.");
  assert.equal(d.name, "upgrade-all-the-dependencies-quickly");
});

test("heuristicDraft: single-word input still produces valid name", () => {
  const d = heuristicDraft("forge runs");
  assert.ok(d.name.length > 0);
});

// ---------- Safety: no network / LLM / throws ----------

test("heuristicDraft: does not throw on garbage input", () => {
  assert.doesNotThrow(() => heuristicDraft("!!!\n@@@\n###"));
  assert.doesNotThrow(() => heuristicDraft("a".repeat(5000)));
});

// ---------- Sweep: every output is valid ----------

test("heuristicDraft: SWEEP — every heuristic output passes validateWorkflow()", () => {
  const inputs = [
    "",
    "   ",
    "every Monday forge runs tests",
    "every tuesday at 7am forge runs",
    "every day forge does something",
    "weekly forge runs",
    "when task fails sentinel reviews",
    "forge runs pnpm test",
    "sentinel reviews",
    "ask me first",
    "approve",
    "push to main",
    "abort",
    "branch",
    "Upgrade deps weekly. Forge updates npm. Sentinel reviews. Approve. Push.",
    "every Monday, forge runs tests, sentinel reviews, I approve, push",
    "forge runs tests then sentinel reviews then push",
    "!!!@@@###",
    "every thursday at 12am forge runs",
    "every wednesday at 12pm forge runs",
    "Upgrade all the dependencies quickly this week. Forge runs.",
    "gate",
    "cancel",
    "deploy",
    "ship it",
    "random text with no keywords at all",
  ];
  for (const input of inputs) {
    const d = heuristicDraft(input);
    const errs = validateWorkflow(d);
    assert.deepEqual(
      errs,
      [],
      `input produced invalid spec: ${JSON.stringify(input)} → ${JSON.stringify(errs)}`,
    );
  }
});
