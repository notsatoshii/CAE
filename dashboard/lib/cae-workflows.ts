/**
 * Workflow domain layer — server-side disk I/O + re-export of pure schema.
 *
 * The pure pieces (types, parseWorkflow, validateWorkflow, serializeWorkflow,
 * slugifyName) live in `./cae-workflows-schema.ts` so client components can
 * import them without pulling `fs/promises` into the client bundle.
 *
 * This module owns:
 *   - listWorkflows / getWorkflow / writeWorkflow (disk I/O to
 *     `$CAE_ROOT/.cae/workflows/*.yml`)
 *   - WORKFLOWS_DIR() env-fresh helper
 *   - Re-exports of everything in the schema module so existing server-side
 *     import sites (API routes, server components, tests) keep working
 *     unchanged.
 *
 * Design:
 *   - `WORKFLOWS_DIR()` is a function (not a const) so tests can set
 *     `process.env.CAE_ROOT` per-test without module-load-time capture.
 *   - Disk functions never throw on ENOENT — return [] or null instead.
 */

import { readdir, readFile, writeFile, mkdir, stat } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import {
  parseWorkflow,
  serializeWorkflow,
} from "./cae-workflows-schema";
import type { WorkflowSpec, WorkflowRecord } from "./cae-workflows-schema";
import { log } from "./log";

const lWorkflows = log("cae-workflows");

// ---------- Re-exports (pure schema, back-compat for server-side importers) ----------

export type {
  StepAgent,
  StepGate,
  StepAction,
  WorkflowStep,
  WorkflowTrigger,
  WorkflowSpec,
  WorkflowRecord,
  ValidationError,
} from "./cae-workflows-schema";

export {
  slugifyName,
  validateWorkflow,
  parseWorkflow,
  serializeWorkflow,
} from "./cae-workflows-schema";

// ---------- Constants ----------

export function WORKFLOWS_DIR(): string {
  const root = process.env.CAE_ROOT ?? "/home/cae/ctrl-alt-elite";
  return join(root, ".cae", "workflows");
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
        lWorkflows.warn(
          { name, errors: errors.map((e) => `${e.path}: ${e.message}`).join("; ") },
          "skipping malformed workflow",
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
      lWorkflows.warn({ name, message }, "failed to read workflow file");
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
    lWorkflows.warn(
      { slug, errors: errors.map((e) => `${e.path}: ${e.message}`).join("; ") },
      "getWorkflow: workflow file is malformed",
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
    slug = slugifyNameForWrite(spec.name);
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

// Local wrapper so we don't need a separate slugifyName value-import
// (it's already re-exported above for external callers).
function slugifyNameForWrite(name: string): string {
  if (typeof name !== "string") return "untitled";
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}
