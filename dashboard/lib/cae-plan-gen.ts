/**
 * lib/cae-plan-gen.ts — ROADMAP → BUILDPLAN → auto-PLAN pipeline.
 *
 * Phase 10 REQ-10-06:
 *  - extractPhase1: pull ## Phase 1 section from ROADMAP markdown
 *  - writeBuildplan: write .planning/phases/01-<slug>/BUILDPLAN.md
 *  - runPlanGen: spawn tmux-detached claude --print invocation
 *  - stubPlan: D-09 fallback — write a waiting_for_plans PLAN.md
 *
 * SECURITY (T-10-03-01):
 *  All shell interpolations go through quote() (POSIX single-quote escape).
 *  BUILDPLAN content is written to disk by writeBuildplan (via fs/promises, not
 *  shell), then claude reads the file inside its own cwd.
 */

import { spawn } from "child_process";
import { mkdir, readdir, writeFile } from "fs/promises";
import { join } from "path";
import type { Project } from "./cae-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CAE_ROOT = "/home/cae/ctrl-alt-elite";
/** System-prompt file passed to claude --append-system-prompt-file. */
const CAE_ARCH_PERSONA = join(CAE_ROOT, ".claude/skills/cae-arch/SKILL.md");
const PLAN_GEN_MODEL = "claude-opus-4-7";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanGenResult {
  /** true = tmux subprocess spawned; false = stub written (auto-gen declined / failed). */
  spawned: boolean;
  /** tmux session id when spawned. */
  sid?: string;
  /** absolute path of PLAN.md (stub or real) after this call returns. */
  planPath: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * POSIX single-quote shell escaping — wraps `s` in single quotes and escapes
 * any embedded single quotes via the `'\''` pattern.
 */
function quote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

/**
 * Derive a URL-safe slug from a Phase 1 heading line.
 * "## Phase 1: Foundation" → "foundation"
 * "## Phase 1: Core Feature" → "core-feature"
 * empty / garbage → "phase-one"
 */
function slugFromHeading(line: string): string {
  const m = /^##\s+Phase\s+\d+:?\s*(.*)$/i.exec(line.trim());
  const text = (m?.[1] ?? "").toLowerCase();
  const slug = text.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "phase-one";
}

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

/**
 * Extract the '## Phase 1' section from ROADMAP markdown verbatim.
 * Includes the heading line and everything up to (but not including) the
 * next '## Phase N' heading or end of file.
 * Returns null when no '## Phase 1' heading is found.
 */
export function extractPhase1(roadmapMd: string): string | null {
  // Sentinel approach: JS regex lacks \Z (true end-of-string in multiline).
  // We append a sentinel heading so the lookahead always matches a boundary.
  const sentinel = "\n## Phase 999999: sentinel";
  const src = roadmapMd + sentinel;

  // Match ## Phase 1 section up to the next ## Phase N heading.
  const re = /^(##\s+Phase\s+1\b[^\n]*\n[\s\S]*?)(?=^##\s+Phase\s+\d+\b)/m;
  const m = re.exec(src);
  if (!m) return null;

  // Return trimmed, ensuring we don't include the sentinel boundary.
  return m[1].replace(/\n## Phase 999999: sentinel[\s\S]*$/, "").trimEnd();
}

/**
 * Write <projectRoot>/.planning/phases/01-<slug>/BUILDPLAN.md.
 * Creates parent directories as needed.
 *
 * @param projectRoot - absolute path to the project directory
 * @param slug - directory slug (e.g. "foundation")
 * @param content - verbatim content to write
 * @returns absolute path of the written file
 */
export async function writeBuildplan(
  projectRoot: string,
  slug: string,
  content: string,
): Promise<string>;

/**
 * Write <proj.path>/.planning/phases/01-<slug>/BUILDPLAN.md.
 * Slug is derived from the first line of phase1Text.
 *
 * @param proj - Project object with .path
 * @param phase1Text - verbatim Phase 1 section text
 * @returns absolute path of the written file
 */
export async function writeBuildplan(
  proj: Project,
  phase1Text: string,
): Promise<string>;

// Implementation covering both overloads.
export async function writeBuildplan(
  projOrRoot: string | Project,
  slugOrContent: string,
  content?: string,
): Promise<string> {
  let root: string;
  let slug: string;
  let body: string;

  if (typeof projOrRoot === "string") {
    // Called as writeBuildplan(projectRoot, slug, content)
    root = projOrRoot;
    slug = slugOrContent;
    body = content!;
  } else {
    // Called as writeBuildplan(proj, phase1Text)
    root = projOrRoot.path;
    const firstLine = slugOrContent.split("\n", 1)[0] ?? "";
    slug = slugFromHeading(firstLine);
    body = slugOrContent;
  }

  const dir = join(root, ".planning", "phases", `01-${slug}`);
  await mkdir(dir, { recursive: true });
  const file = join(dir, "BUILDPLAN.md");
  await writeFile(file, body, "utf8");
  return file;
}

/**
 * Spawn a tmux-detached claude --print invocation to generate PLAN.md from
 * the BUILDPLAN.md written by writeBuildplan.
 *
 * When the phases/01-* directory doesn't exist or spawn throws, falls back
 * to stubPlan and returns { spawned: false, planPath }.
 */
export async function runPlanGen(proj: Project): Promise<PlanGenResult> {
  const phasesDir = join(proj.path, ".planning", "phases");
  const entries = await readdir(phasesDir).catch(() => [] as string[]);
  const phase01 = entries.find((e) => /^01-/.test(e));

  if (!phase01) {
    // No BUILDPLAN.md directory exists — stub immediately.
    const planPath = await stubPlan(proj);
    return { spawned: false, planPath };
  }

  const planDir = join(phasesDir, phase01);
  const planPath = join(planDir, "PLAN.md");
  const logFile = join(planDir, "plan-gen.log");
  const sid = `plan-gen-${phase01}-${Date.now().toString(36)}`;

  const prompt =
    `Draft PLAN.md in the current directory from BUILDPLAN.md. ` +
    `Follow the GSD plan structure. Write the plan to ${planPath}. ` +
    `Use ${PLAN_GEN_MODEL} quality reasoning.`;

  // Class-18 root/sudo wrapper: claude CLI ≥2.1.117 refuses to run as root
  // and the tmux server in this process group runs as root. Drop to cae
  // via sudo so the claude subprocess can start. `-E` preserves env (PATH,
  // TZ, etc.); `env HOME=/home/cae` forces HOME to cae's home so Claude's
  // credential and config lookup lands on the mirrored
  // /home/cae/.claude/.credentials.json (see /usr/local/bin/cae-creds-resync.sh).
  const inner =
    `cd ${quote(planDir)} && ` +
    `sudo -u cae -E env HOME=/home/cae ` +
    `claude --print --append-system-prompt-file ${quote(CAE_ARCH_PERSONA)} ` +
    `--model ${PLAN_GEN_MODEL} ${quote(prompt)} ` +
    `> ${quote(planPath)} 2> ${quote(logFile)}`;

  try {
    const child = spawn("tmux", ["new-session", "-d", "-s", sid, inner], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return { spawned: true, sid, planPath };
  } catch {
    const path = await stubPlan(proj);
    return { spawned: false, planPath: path };
  }
}

/**
 * Write a waiting_for_plans stub PLAN.md — the D-09 fallback when auto-gen
 * fails or times out.
 *
 * Overload 1: stubPlan(projectRoot, slug) — plain strings
 * Overload 2: stubPlan(proj) — Project object; slug derived from existing 01-* dir
 *
 * Safe to call idempotently; overwrites with the same content.
 */
export async function stubPlan(projectRoot: string, slug: string): Promise<string>;
export async function stubPlan(proj: Project): Promise<string>;
export async function stubPlan(
  projOrRoot: string | Project,
  slug?: string,
): Promise<string> {
  let root: string;
  let resolvedSlug: string;

  if (typeof projOrRoot === "string") {
    root = projOrRoot;
    resolvedSlug = slug!;
  } else {
    root = projOrRoot.path;
    const phasesDir = join(root, ".planning", "phases");
    const entries = await readdir(phasesDir).catch(() => [] as string[]);
    const phase01 = entries.find((e) => /^01-/.test(e)) ?? "01-phase-one";
    resolvedSlug = phase01.replace(/^01-/, "");
  }

  const planDir = join(root, ".planning", "phases", `01-${resolvedSlug}`);
  await mkdir(planDir, { recursive: true });
  const planPath = join(planDir, "PLAN.md");
  const body =
    "# WAITING FOR PLANS\n\n" +
    "Auto-generation failed. Run `/gsd-plan-phase 01` interactively.\n";
  await writeFile(planPath, body, "utf8");
  return planPath;
}
