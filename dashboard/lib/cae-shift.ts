/**
 * lib/cae-shift.ts — thin wrapper around /home/shift/bin/shift v3.0.0.
 *
 * Phase 10 D-01: dashboard does NOT reimplement Shift intake — it wraps it.
 * ~80% process-control code (spawn tmux, pipe logs), ~20% state-file patching
 * (approve gates).
 *
 * SECURITY (T-10-02-01 through T-10-02-05):
 * - All shell interpolations go through quote() (POSIX single-quote escape).
 * - Project names regex-validated: /^[a-zA-Z0-9_-]{1,64}$/.
 * - resolveProject enforces whitelist via listProjects(); never shell-executes unknown paths.
 * - buildAnswersFile writes to /tmp/shift-answers-<uuid>.json with mode 0o600.
 * - Callers (server actions + API routes, plan 10-05) MUST call auth() before
 *   invoking any function here. This lib cannot check NextAuth context.
 */

import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { readFile, writeFile } from "fs/promises";
import { join, basename, resolve } from "path";
import { tmpdir } from "os";
import type { Project } from "./cae-types";
import { listProjects } from "./cae-state";

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

/** Shift lifecycle phase string — comes straight from .shift/state.json::phase. */
export type ShiftPhase =
  | "idea"
  | "research"
  | "prd"
  | "roadmap"
  | "waiting_for_plans"
  | "executing"
  | "done";

/** Shape of .shift/state.json — subset we care about. Unknown fields preserved via index signature. */
export interface ShiftState {
  schema_version: number;
  project_name: string;
  phase: ShiftPhase | string;
  updated: string;
  idea?: { what?: string; who?: string; type?: string };
  prd?: { path?: string; user_approved?: boolean };
  roadmap?: { path?: string; user_approved?: boolean };
  history?: Array<{ ts: string; action: string; outcome: string }>;
  [key: string]: unknown; // preserve unknown keys across read/write
}

/**
 * Wizard answers for `shift new` intake.
 * Keys match Shift's own question ids so callers can also pass raw objects.
 */
export interface WizardAnswers {
  /** Shift qid `idea.what` — one-line problem statement. */
  "idea.what": string;
  /** Shift qid `idea.who` — target user. */
  "idea.who": string;
  /** Shift qid `idea.type_ok` — project type, usually "web". */
  "idea.type_ok": string;
}

// ---------------------------------------------------------------------------
// Internal constants + helpers
// ---------------------------------------------------------------------------

const SHIFT_PROJECTS_HOME = process.env.SHIFT_PROJECTS_HOME ?? "/home/cae";
const SHIFT_BIN = "/home/shift/bin/shift";

/** POSIX single-quote quoting: wraps in single quotes, escapes embedded singles. */
function quote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

// ---------------------------------------------------------------------------
// resolveProject
// ---------------------------------------------------------------------------

/**
 * Match `slugOrPath` against the listProjects() whitelist.
 * - Absolute paths must equal a Project.path exactly (resolve() collapses traversal).
 * - Short slugs match path.basename(Project.path); any `/` or `..` in slug → null.
 * - Returns null on any mismatch; never throws.
 */
export async function resolveProject(slugOrPath: string): Promise<Project | null> {
  if (typeof slugOrPath !== "string" || slugOrPath.length === 0) return null;
  const projects = await listProjects();

  if (slugOrPath.startsWith("/")) {
    // Absolute path branch — normalize to collapse ../traversal attempts
    const abs = resolve(slugOrPath);
    return projects.find((p) => p.path === abs) ?? null;
  }

  // Slug branch — reject anything with a slash or ".."
  if (slugOrPath.includes("/") || slugOrPath.includes("..")) return null;

  return projects.find((p) => basename(p.path) === slugOrPath) ?? null;
}

// ---------------------------------------------------------------------------
// readShiftState
// ---------------------------------------------------------------------------

/**
 * Read and JSON.parse `.shift/state.json`.
 * Returns null when file absent (ENOENT). Throws on malformed JSON or permission errors.
 */
export async function readShiftState(projectPath: string): Promise<ShiftState | null> {
  const stateFile = join(projectPath, ".shift", "state.json");
  try {
    const raw = await readFile(stateFile, "utf8");
    return JSON.parse(raw) as ShiftState;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err; // malformed JSON or permission error — propagate
  }
}

// ---------------------------------------------------------------------------
// buildAnswersFile
// ---------------------------------------------------------------------------

/**
 * Write /tmp/shift-answers-<uuid>.json keyed by Shift's question ids.
 * Permissions 0o600 (answers may include sensitive info).
 * Returns the absolute path (safe to pass as SHIFT_ANSWERS env var).
 */
export async function buildAnswersFile(answers: WizardAnswers): Promise<string> {
  const file = join(tmpdir(), `shift-answers-${randomUUID()}.json`);
  await writeFile(file, JSON.stringify(answers, null, 2), {
    mode: 0o600,
    encoding: "utf8",
  });
  return file;
}

// ---------------------------------------------------------------------------
// runShiftNew + runShiftNext
// ---------------------------------------------------------------------------

/**
 * Spawn tmux-detached `shift new <name>` under SHIFT_PROJECTS_HOME with
 * SHIFT_NONINTERACTIVE=1 + SHIFT_ANSWERS=<answersFile>.
 * Returns `{ sid, projectPath, logFile }`.
 * Does NOT wait for completion — this is a 30-600s operation.
 *
 * T-10-02-01: project name is regex-validated; all interpolations use quote().
 */
export async function runShiftNew(
  name: string,
  answersFile: string,
): Promise<{ sid: string; projectPath: string; logFile: string }> {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name)) {
    throw new Error(`invalid project name: ${JSON.stringify(name)}`);
  }

  const projectPath = join(SHIFT_PROJECTS_HOME, name);
  const sid = `plan-new-${name}-${Date.now().toString(36)}`;
  // logFile goes in the project root, not .shift/, because .shift/ won't exist yet
  const logFile = join(projectPath, ".shift-bootstrap.log");

  const inner =
    `mkdir -p ${quote(projectPath)} && ` +
    `cd ${quote(SHIFT_PROJECTS_HOME)} && ` +
    `SHIFT_NONINTERACTIVE=1 SHIFT_ANSWERS=${quote(answersFile)} ` +
    `${SHIFT_BIN} new ${quote(name)} 2>&1 | tee ${quote(logFile)}`;

  const child = spawn("tmux", ["new-session", "-d", "-s", sid, inner], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return { sid, projectPath, logFile };
}

/**
 * Spawn tmux-detached `shift next` inside proj.path.
 * Assumes `.shift/` directory already exists (post-bootstrap project).
 * Returns `{ sid, logFile }`.
 */
export async function runShiftNext(proj: Project): Promise<{ sid: string; logFile: string }> {
  const sid = `plan-next-${basename(proj.path)}-${Date.now().toString(36)}`;
  const logFile = join(proj.path, ".shift", `next-${Date.now()}.log`);

  const inner =
    `cd ${quote(proj.path)} && ` +
    `SHIFT_NONINTERACTIVE=1 ${SHIFT_BIN} next 2>&1 | tee ${quote(logFile)}`;

  const child = spawn("tmux", ["new-session", "-d", "-s", sid, inner], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return { sid, logFile };
}

// ---------------------------------------------------------------------------
// Gate approval helpers (pure state mutation + file I/O)
// ---------------------------------------------------------------------------

/**
 * approveGate — pure state mutation helper.
 *
 * Patches a ShiftState object in-memory:
 * - gate="prd": sets prd.user_approved=true, phase="roadmap", appends history.
 * - gate="roadmap": sets roadmap.user_approved=true, phase="waiting_for_plans", appends history.
 *
 * Does NOT write to disk (callers write state file after gate check).
 * Does NOT spawn shift next (callers decide whether to invoke runShiftNext).
 *
 * Returns the mutated state (same object reference, also returned for convenience).
 */
export async function approveGate(
  state: ShiftState,
  gate: "prd" | "roadmap",
): Promise<ShiftState> {
  const ts = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  if (gate === "prd") {
    if (state.phase !== "prd") {
      throw new Error(
        `state.phase must be 'prd' to approve PRD, got ${state.phase}`,
      );
    }
    state.prd = { ...(state.prd ?? {}), user_approved: true };
    state.phase = "roadmap";
    state.updated = ts;
    if (!Array.isArray(state.history)) state.history = [];
    state.history.push({ ts, action: "prd_approved", outcome: "dashboard" });
  } else if (gate === "roadmap") {
    if (state.phase !== "roadmap") {
      throw new Error(
        `state.phase must be 'roadmap' to approve ROADMAP, got ${state.phase}`,
      );
    }
    state.roadmap = { ...(state.roadmap ?? {}), user_approved: true };
    state.phase = "waiting_for_plans";
    state.updated = ts;
    if (!Array.isArray(state.history)) state.history = [];
    state.history.push({ ts, action: "roadmap_approved", outcome: "dashboard" });
  } else {
    throw new Error(`unknown gate: ${gate}`);
  }

  return state;
}

// ---------------------------------------------------------------------------
// Higher-level gate functions (file I/O + optional shift next spawn)
// ---------------------------------------------------------------------------

/**
 * Patch state.prd.user_approved=true, advance phase=roadmap, append history,
 * then spawn `shift next` to trigger ROADMAP drafting.
 * Throws if state.phase != "prd".
 * Returns { sid } from the runShiftNext call.
 */
export async function approvePrdGate(proj: Project): Promise<{ sid: string }> {
  const stateFile = join(proj.path, ".shift", "state.json");
  const raw = await readFile(stateFile, "utf8");
  const state = JSON.parse(raw) as ShiftState;

  await approveGate(state, "prd");

  await writeFile(stateFile, JSON.stringify(state, null, 2), "utf8");
  const { sid } = await runShiftNext(proj);
  return { sid };
}

/**
 * Patch state.roadmap.user_approved=true, advance phase="waiting_for_plans", append history.
 * Does NOT spawn shift next — D-09 plan-gen handles phase advance.
 * Throws if state.phase != "roadmap".
 * Returns void.
 */
export async function approveRoadmapGate(proj: Project): Promise<void> {
  const stateFile = join(proj.path, ".shift", "state.json");
  const raw = await readFile(stateFile, "utf8");
  const state = JSON.parse(raw) as ShiftState;

  await approveGate(state, "roadmap");

  await writeFile(stateFile, JSON.stringify(state, null, 2), "utf8");
  // Intentionally does NOT call runShiftNext — plan-gen owns the next step (D-09).
}
