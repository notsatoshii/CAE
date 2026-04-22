/**
 * Workflow domain layer — pure TS, Node-runnable.
 *
 * Responsibilities:
 *   - WorkflowSpec / WorkflowRecord / ValidationError types
 *   - parseWorkflow / validateWorkflow / serializeWorkflow (pure)
 *   - slugifyName (pure)
 *   - listWorkflows / getWorkflow / writeWorkflow (disk I/O to
 *     `$CAE_ROOT/.cae/workflows/*.yml`)
 *
 * Design:
 *   - Zero React / Next / agent-meta imports — safe for node:test harnesses
 *     and server-only routes alike.
 *   - Uses the `yaml` package (v2, `parse` + `stringify`), never `js-yaml`.
 *   - `WORKFLOWS_DIR()` is a function (not a const) so tests can set
 *     `process.env.CAE_ROOT` per-test without module-load-time capture.
 *   - validateWorkflow never throws — returns a typed error list so the UI
 *     can render field-level messages.
 *
 * Downstream consumers (Phase 6 plans 02-04):
 *   - `app/api/workflows/*` routes import parseWorkflow + writeWorkflow.
 *   - `components/workflows/*` widgets import listWorkflows + types.
 *   - `lib/cae-nl-draft.ts` imports WorkflowSpec + validateWorkflow + slugifyName.
 */

import { readdir, readFile, writeFile, mkdir, stat } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { parse, stringify } from "yaml";

// ---------- Types ----------

export type StepAgent = {
  agent:
    | "forge"
    | "sentinel"
    | "scout"
    | "scribe"
    | "phantom"
    | "aegis"
    | "arch"
    | "herald"
    | "nexus";
  task: string;
  timeout?: string;
};

export type StepGate = { gate: "approval" | "auto"; notify?: "telegram" | "email" };

export type StepAction = { action: "push" | "abort" | "branch" };

export type WorkflowStep = StepAgent | StepGate | StepAction;

export interface WorkflowTrigger {
  type: "manual" | "cron" | "event";
  schedule?: string;
  on?: string;
}

export interface WorkflowSpec {
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
}

export interface WorkflowRecord {
  slug: string;
  filepath: string;
  spec: WorkflowSpec;
  yaml: string;
  mtime: number;
}

export interface ValidationError {
  path: string;
  message: string;
}

// ---------- Constants ----------

// Hardcoded to keep this module dependency-light (no agent-meta import).
// Mirror AgentName values from lib/copy/agent-meta.ts.
const VALID_AGENTS = new Set([
  "nexus",
  "forge",
  "sentinel",
  "scout",
  "scribe",
  "phantom",
  "aegis",
  "arch",
  "herald",
]);

const VALID_TRIGGER_TYPES = new Set(["manual", "cron", "event"]);
const VALID_GATES = new Set(["approval", "auto"]);
const VALID_ACTIONS = new Set(["push", "abort", "branch"]);

// ---------- Pure helpers ----------

export function WORKFLOWS_DIR(): string {
  const root = process.env.CAE_ROOT ?? "/home/cae/ctrl-alt-elite";
  return join(root, ".cae", "workflows");
}

export function slugifyName(name: string): string {
  if (typeof name !== "string") return "untitled";
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

// ---------- Validation ----------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function validateWorkflow(spec: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isRecord(spec)) {
    errors.push({ path: "name", message: "name required" });
    errors.push({ path: "trigger", message: "trigger required" });
    errors.push({ path: "steps", message: "steps required" });
    return errors;
  }

  // name
  if (typeof spec.name !== "string" || !spec.name.trim()) {
    errors.push({ path: "name", message: "name required" });
  }

  // trigger
  const trigger = spec.trigger;
  if (!isRecord(trigger)) {
    errors.push({ path: "trigger", message: "trigger required" });
  } else {
    const tType = trigger.type;
    if (typeof tType !== "string" || !VALID_TRIGGER_TYPES.has(tType)) {
      errors.push({
        path: "trigger.type",
        message: "trigger.type must be one of manual | cron | event",
      });
    } else {
      if (tType === "cron" && (typeof trigger.schedule !== "string" || !trigger.schedule.trim())) {
        errors.push({
          path: "trigger.schedule",
          message: "schedule required when trigger.type is cron",
        });
      }
      if (tType === "event" && (typeof trigger.on !== "string" || !trigger.on.trim())) {
        errors.push({
          path: "trigger.on",
          message: "on required when trigger.type is event",
        });
      }
    }
  }

  // steps
  if (!Array.isArray(spec.steps)) {
    errors.push({ path: "steps", message: "steps required" });
  } else {
    spec.steps.forEach((step, i) => {
      const base = `steps[${i}]`;
      if (!isRecord(step)) {
        errors.push({ path: base, message: "step must be an object" });
        return;
      }
      const hasAgent = "agent" in step;
      const hasGate = "gate" in step;
      const hasAction = "action" in step;
      const kindCount = [hasAgent, hasGate, hasAction].filter(Boolean).length;
      if (kindCount === 0) {
        errors.push({
          path: base,
          message: "step must have agent+task, gate, or action",
        });
        return;
      }
      if (kindCount > 1) {
        errors.push({
          path: base,
          message: "step must be exactly one of agent, gate, or action",
        });
        return;
      }
      if (hasAgent) {
        if (typeof step.agent !== "string" || !VALID_AGENTS.has(step.agent)) {
          errors.push({
            path: `${base}.agent`,
            message: `unknown agent; expected one of ${[...VALID_AGENTS].join(", ")}`,
          });
        }
        if (typeof step.task !== "string" || !step.task.trim()) {
          errors.push({ path: `${base}.task`, message: "task required for agent step" });
        }
        if (step.timeout !== undefined && typeof step.timeout !== "string") {
          errors.push({ path: `${base}.timeout`, message: "timeout must be a string" });
        }
      } else if (hasGate) {
        if (typeof step.gate !== "string" || !VALID_GATES.has(step.gate)) {
          errors.push({
            path: `${base}.gate`,
            message: "gate must be 'approval' or 'auto'",
          });
        }
        if (
          step.notify !== undefined &&
          step.notify !== "telegram" &&
          step.notify !== "email"
        ) {
          errors.push({
            path: `${base}.notify`,
            message: "notify must be 'telegram' or 'email'",
          });
        }
      } else if (hasAction) {
        if (typeof step.action !== "string" || !VALID_ACTIONS.has(step.action)) {
          errors.push({
            path: `${base}.action`,
            message: "action must be 'push', 'abort', or 'branch'",
          });
        }
      }
    });
  }

  return errors;
}

// ---------- Parse / serialize ----------

export function parseWorkflow(yamlStr: string): {
  spec: WorkflowSpec | null;
  errors: ValidationError[];
} {
  let parsed: unknown;
  try {
    parsed = parse(yamlStr);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { spec: null, errors: [{ path: "yaml", message }] };
  }
  const errors = validateWorkflow(parsed);
  if (errors.length > 0) {
    return { spec: null, errors };
  }
  return { spec: parsed as WorkflowSpec, errors: [] };
}

export function serializeWorkflow(spec: WorkflowSpec): string {
  return stringify(spec, { lineWidth: 100 });
}

// ---------- Disk I/O ----------

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function listWorkflows(): Promise<WorkflowRecord[]> {
  const dir = WORKFLOWS_DIR();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err && err.code === "ENOENT") return [];
    throw e;
  }
  const records: WorkflowRecord[] = [];
  for (const name of entries) {
    if (!name.endsWith(".yml")) continue;
    const filepath = join(dir, name);
    try {
      const yaml = await readFile(filepath, "utf8");
      const { spec, errors } = parseWorkflow(yaml);
      if (!spec) {
        console.warn(
          `[cae-workflows] Skipping malformed workflow ${name}: ${errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
        );
        continue;
      }
      const st = await stat(filepath);
      records.push({
        slug: name.replace(/\.yml$/, ""),
        filepath,
        spec,
        yaml,
        mtime: st.mtimeMs,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn(`[cae-workflows] Failed to read ${name}: ${message}`);
      continue;
    }
  }
  return records;
}

export async function getWorkflow(slug: string): Promise<WorkflowRecord | null> {
  const dir = WORKFLOWS_DIR();
  const filepath = join(dir, `${slug}.yml`);
  let yaml: string;
  try {
    yaml = await readFile(filepath, "utf8");
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err && err.code === "ENOENT") return null;
    throw e;
  }
  const { spec, errors } = parseWorkflow(yaml);
  if (!spec) {
    console.warn(
      `[cae-workflows] getWorkflow(${slug}) malformed: ${errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
    );
    return null;
  }
  const st = await stat(filepath);
  return { slug, filepath, spec, yaml, mtime: st.mtimeMs };
}

export async function writeWorkflow(
  spec: WorkflowSpec,
  opts?: { slug?: string },
): Promise<WorkflowRecord> {
  const dir = WORKFLOWS_DIR();
  await ensureDir(dir);

  let slug: string;
  if (opts?.slug) {
    // Explicit slug — overwrite/match permitted (caller opted in).
    slug = opts.slug;
  } else {
    slug = slugifyName(spec.name);
    const candidatePath = join(dir, `${slug}.yml`);
    if (await fileExists(candidatePath)) {
      // Collision without explicit slug — append 8-hex suffix.
      const suffix = randomBytes(4).toString("hex");
      slug = `${slug}-${suffix}`;
    }
  }

  const filepath = join(dir, `${slug}.yml`);
  const yaml = serializeWorkflow(spec);
  await writeFile(filepath, yaml, "utf8");
  const st = await stat(filepath);
  return { slug, filepath, spec, yaml, mtime: st.mtimeMs };
}
