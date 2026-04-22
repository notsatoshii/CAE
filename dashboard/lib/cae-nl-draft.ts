/**
 * Natural-language → WorkflowSpec heuristic drafter.
 *
 * Pure rules-based stub — NO network, NO LLM SDK, NO Anthropic/openai imports.
 * The "real" chat-first drafting lives in Phase 9 (chat rail). This module
 * powers the Phase 6 draft textarea: press "Draft it" → get a valid-shape
 * WorkflowSpec stub that the user can then refine in YAML or the step-graph.
 *
 * Invariants (enforced by cae-nl-draft.test.ts sweep):
 *   - heuristicDraft(anyText) always returns a WorkflowSpec that passes
 *     validateWorkflow() with zero errors.
 *   - Never throws.
 *   - Never makes a network call.
 *
 * Rule order (applied in sequence):
 *   1. Name: first sentence, first 5 words, slugified. Fallback "new-recipe".
 *   2. Trigger: scan for cron keywords (every <day>, every day, weekly, daily),
 *      event keywords (when task fails), optional hour extractor ("N am/pm").
 *      Default manual.
 *   3. Steps: split input on sentence terminators OR the word "then", then
 *      for each fragment emit the first matching step type (agent | gate |
 *      action). Empty fragments are skipped. Order is preserved.
 */

import { validateWorkflow, slugifyName } from "./cae-workflows";
import type { WorkflowSpec, WorkflowStep, WorkflowTrigger } from "./cae-workflows";

const AGENT_NAMES = [
  "forge",
  "sentinel",
  "scout",
  "scribe",
  "phantom",
  "aegis",
  "arch",
  "herald",
  "nexus",
] as const;

type AgentName = (typeof AGENT_NAMES)[number];

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

// ---------- Name derivation ----------

function deriveName(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "new-recipe";
  const firstSentence = trimmed.split(/[.!?]/)[0] ?? trimmed;
  const words = firstSentence.trim().split(/\s+/).slice(0, 5).join(" ");
  const slug = slugifyName(words);
  return slug === "untitled" ? "new-recipe" : slug;
}

// ---------- Trigger detection ----------

function extractHour(text: string): number | null {
  const m = text.match(/(\d{1,2})\s*(am|pm)\b/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const meridiem = m[2].toLowerCase();
  if (hour < 0 || hour > 12) return null;
  if (meridiem === "am") {
    if (hour === 12) hour = 0;
  } else {
    if (hour !== 12) hour += 12;
  }
  return hour;
}

function detectTrigger(text: string): WorkflowTrigger {
  const lower = text.toLowerCase();

  // Event triggers first (more specific).
  if (/\bwhen task fails?\b|\bon task failure\b|\bon failure\b/.test(lower)) {
    return { type: "event", on: "task.failed" };
  }

  // Daily.
  if (/\bevery day\b|\bdaily\b/.test(lower)) {
    const hour = extractHour(lower) ?? 9;
    return { type: "cron", schedule: `0 ${hour} * * *` };
  }

  // Every <day>.
  const dayMatch = lower.match(/\bevery\s+(sunday|sun|monday|mon|tuesday|tues?|wednesday|wed|thursday|thurs?|thur|friday|fri|saturday|sat)\b/);
  if (dayMatch) {
    const day = DAY_MAP[dayMatch[1]];
    const hour = extractHour(lower) ?? 9;
    return { type: "cron", schedule: `0 ${hour} * * ${day}` };
  }

  // Weekly (no specific day) — defaults Monday.
  if (/\bweekly\b/.test(lower)) {
    const hour = extractHour(lower) ?? 9;
    return { type: "cron", schedule: `0 ${hour} * * 1` };
  }

  return { type: "manual" };
}

// ---------- Step detection ----------

function splitFragments(text: string): string[] {
  // Split on sentence terminators, commas (serial lists like "forge runs, sentinel
  // reviews, approve, push"), or the word "then" (word-boundary, case-insensitive).
  return text
    .split(/[.!?,]|\bthen\b/i)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
}

function findAgent(fragmentLower: string): AgentName | null {
  for (const a of AGENT_NAMES) {
    const re = new RegExp(`\\b${a}\\b`, "i");
    if (re.test(fragmentLower)) return a;
  }
  return null;
}

function stepFromFragment(fragment: string): WorkflowStep | null {
  const lower = fragment.toLowerCase();
  const agent = findAgent(lower);

  if (agent) {
    // Normalize sentinel "review" tasks.
    if (agent === "sentinel" && /\breview\w*\b/.test(lower)) {
      return { agent: "sentinel", task: "review" };
    }
    // Derive task as everything minus the agent name token.
    const taskRaw = fragment
      .replace(new RegExp(`\\b${agent}\\b`, "i"), "")
      .replace(/^[,;:\s]+|[,;:\s]+$/g, "")
      .trim();
    const task = taskRaw || "run";
    return { agent, task };
  }

  // Gate keywords.
  if (/\b(approve|approval|ask me first|human approval|gate)\b/.test(lower)) {
    return { gate: "approval", notify: "telegram" };
  }

  // Action keywords.
  if (/\b(push to main|push to master|push|deploy|ship it)\b/.test(lower)) {
    return { action: "push" };
  }
  if (/\b(abort|cancel)\b/.test(lower)) {
    return { action: "abort" };
  }
  if (/\bbranch\b/.test(lower)) {
    return { action: "branch" };
  }

  return null;
}

function detectSteps(text: string): WorkflowStep[] {
  const fragments = splitFragments(text);
  const steps: WorkflowStep[] = [];
  for (const frag of fragments) {
    const step = stepFromFragment(frag);
    if (step) steps.push(step);
  }
  return steps;
}

// ---------- Public API ----------

export function heuristicDraft(text: string): WorkflowSpec {
  const trimmed = typeof text === "string" ? text : "";
  const name = deriveName(trimmed);
  const trigger = detectTrigger(trimmed);
  const steps = detectSteps(trimmed);
  const description = trimmed.slice(0, 200);

  const spec: WorkflowSpec = {
    name,
    description,
    trigger,
    steps,
  };

  // Defensive: if anything yields an invalid spec, fall back to a valid stub
  // that preserves the derived name.
  if (validateWorkflow(spec).length > 0) {
    return {
      name: name || "new-recipe",
      description: "",
      trigger: { type: "manual" },
      steps: [],
    };
  }

  return spec;
}
