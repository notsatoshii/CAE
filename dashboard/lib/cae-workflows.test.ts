/**
 * Unit tests for lib/cae-workflows.ts
 *
 * Run: `npx tsx lib/cae-workflows.test.ts`
 *
 * Uses node:test + node:assert/strict. Temp-dir isolation for file CRUD:
 * each file test sets process.env.CAE_ROOT to a fresh mkdtempSync dir so
 * WORKFLOWS_DIR() resolves there; no global state bleeds between tests.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  parseWorkflow,
  validateWorkflow,
  serializeWorkflow,
  slugifyName,
  listWorkflows,
  getWorkflow,
  writeWorkflow,
  WORKFLOWS_DIR,
  type WorkflowSpec,
} from "./cae-workflows";

// ---------- slugifyName ----------

test("slugifyName: basic lowercase", () => {
  assert.equal(slugifyName("upgrade-deps"), "upgrade-deps");
});

test("slugifyName: strips punctuation + multi-dash collapse", () => {
  assert.equal(slugifyName("Upgrade All Deps!"), "upgrade-all-deps");
});

test("slugifyName: trims leading/trailing dashes", () => {
  assert.equal(slugifyName("--hello--world--"), "hello-world");
});

test("slugifyName: empty returns untitled", () => {
  assert.equal(slugifyName(""), "untitled");
  assert.equal(slugifyName("   "), "untitled");
  assert.equal(slugifyName("!!!"), "untitled");
});

// ---------- validateWorkflow ----------

test("validateWorkflow: empty object returns 3 errors (name, trigger, steps)", () => {
  const errs = validateWorkflow({});
  const paths = new Set(errs.map((e) => e.path));
  assert.ok(paths.has("name"));
  assert.ok(paths.has("trigger"));
  assert.ok(paths.has("steps"));
});

test("validateWorkflow: empty name + bogus agent", () => {
  const errs = validateWorkflow({
    name: "",
    trigger: { type: "manual" },
    steps: [{ agent: "bogus", task: "x" }],
  });
  assert.ok(errs.length >= 2);
  assert.ok(errs.some((e) => e.path === "name"));
  assert.ok(errs.some((e) => e.path.startsWith("steps[0]")));
});

test("validateWorkflow: cron without schedule", () => {
  const errs = validateWorkflow({
    name: "x",
    trigger: { type: "cron" },
    steps: [],
  });
  assert.ok(errs.some((e) => e.path === "trigger.schedule"));
});

test("validateWorkflow: event without on", () => {
  const errs = validateWorkflow({
    name: "x",
    trigger: { type: "event" },
    steps: [],
  });
  assert.ok(errs.some((e) => e.path === "trigger.on"));
});

test("validateWorkflow: valid manual + approval gate", () => {
  const errs = validateWorkflow({
    name: "x",
    trigger: { type: "manual" },
    steps: [{ gate: "approval" }],
  });
  assert.deepEqual(errs, []);
});

test("validateWorkflow: valid cron + forge step + push action", () => {
  const errs = validateWorkflow({
    name: "upgrade-deps",
    trigger: { type: "cron", schedule: "0 9 * * 1" },
    steps: [
      { agent: "forge", task: "run tests" },
      { action: "push" },
    ],
  });
  assert.deepEqual(errs, []);
});

test("validateWorkflow: unknown step shape", () => {
  const errs = validateWorkflow({
    name: "x",
    trigger: { type: "manual" },
    steps: [{ foo: "bar" }],
  });
  assert.ok(errs.some((e) => e.path.startsWith("steps[0]")));
});

test("validateWorkflow: bad gate value", () => {
  const errs = validateWorkflow({
    name: "x",
    trigger: { type: "manual" },
    steps: [{ gate: "whatever" }],
  });
  assert.ok(errs.some((e) => e.path.startsWith("steps[0]")));
});

test("validateWorkflow: bad action value", () => {
  const errs = validateWorkflow({
    name: "x",
    trigger: { type: "manual" },
    steps: [{ action: "bogus" }],
  });
  assert.ok(errs.some((e) => e.path.startsWith("steps[0]")));
});

test("validateWorkflow: never throws on null / undefined / string", () => {
  assert.doesNotThrow(() => validateWorkflow(null));
  assert.doesNotThrow(() => validateWorkflow(undefined));
  assert.doesNotThrow(() => validateWorkflow("nope"));
  assert.doesNotThrow(() => validateWorkflow(42));
});

// ---------- parseWorkflow ----------

test("parseWorkflow: minimal valid YAML", () => {
  const r = parseWorkflow("name: foo\ntrigger:\n  type: manual\nsteps: []\n");
  assert.deepEqual(r.errors, []);
  assert.ok(r.spec);
  assert.equal(r.spec!.name, "foo");
  assert.equal(r.spec!.trigger.type, "manual");
  assert.deepEqual(r.spec!.steps, []);
});

test("parseWorkflow: bad YAML returns error with path 'yaml'", () => {
  const r = parseWorkflow(":\n  - not valid\n  foo:\n    :::");
  assert.equal(r.spec, null);
  assert.ok(r.errors.length >= 1);
  assert.equal(r.errors[0].path, "yaml");
});

test("parseWorkflow: cron without schedule flags error via validator", () => {
  const r = parseWorkflow("name: foo\ntrigger:\n  type: cron\n");
  assert.equal(r.spec, null);
  assert.ok(r.errors.some((e) => e.path === "steps" || e.path === "trigger.schedule"));
});

// ---------- serializeWorkflow round-trip ----------

test("serializeWorkflow: round-trips through parseWorkflow", () => {
  const spec: WorkflowSpec = {
    name: "upgrade-deps",
    description: "Bump deps",
    trigger: { type: "cron", schedule: "0 9 * * 1" },
    steps: [
      { agent: "forge", task: "run pnpm update --latest" },
      { agent: "sentinel", task: "review" },
      { gate: "approval", notify: "telegram" },
      { action: "push" },
    ],
  };
  const yaml = serializeWorkflow(spec);
  assert.ok(yaml.includes("name: upgrade-deps"));
  const r = parseWorkflow(yaml);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.spec, spec);
});

// ---------- WORKFLOWS_DIR reads env fresh ----------

test("WORKFLOWS_DIR: reads CAE_ROOT env fresh each call", () => {
  const tmp = mkdtempSync(join(tmpdir(), "cae-wf-envread-"));
  const orig = process.env.CAE_ROOT;
  try {
    process.env.CAE_ROOT = tmp;
    assert.equal(WORKFLOWS_DIR(), join(tmp, ".cae", "workflows"));
  } finally {
    if (orig === undefined) delete process.env.CAE_ROOT;
    else process.env.CAE_ROOT = orig;
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------- File CRUD (each test isolates via temp CAE_ROOT) ----------

function withTempRoot<T>(fn: (root: string) => Promise<T> | T): Promise<T> {
  const tmp = mkdtempSync(join(tmpdir(), "cae-wf-"));
  const orig = process.env.CAE_ROOT;
  process.env.CAE_ROOT = tmp;
  return Promise.resolve()
    .then(() => fn(tmp))
    .finally(() => {
      if (orig === undefined) delete process.env.CAE_ROOT;
      else process.env.CAE_ROOT = orig;
      rmSync(tmp, { recursive: true, force: true });
    });
}

test("listWorkflows: returns [] when dir missing", async () => {
  await withTempRoot(async () => {
    const list = await listWorkflows();
    assert.deepEqual(list, []);
  });
});

test("writeWorkflow + listWorkflows: round-trip on disk", async () => {
  await withTempRoot(async (root) => {
    const spec: WorkflowSpec = {
      name: "Upgrade Deps",
      trigger: { type: "manual" },
      steps: [{ agent: "forge", task: "update" }],
    };
    const rec = await writeWorkflow(spec);
    assert.equal(rec.slug, "upgrade-deps");
    assert.ok(existsSync(join(root, ".cae", "workflows", "upgrade-deps.yml")));
    assert.equal(rec.spec.name, "Upgrade Deps");

    const list = await listWorkflows();
    assert.equal(list.length, 1);
    assert.equal(list[0].slug, "upgrade-deps");
    assert.equal(list[0].spec.name, "Upgrade Deps");
    assert.ok(list[0].yaml.includes("Upgrade Deps"));
    assert.ok(list[0].mtime > 0);
  });
});

test("writeWorkflow: collision appends -{8hex} suffix", async () => {
  await withTempRoot(async (root) => {
    const spec: WorkflowSpec = {
      name: "upgrade-deps",
      trigger: { type: "manual" },
      steps: [],
    };
    const r1 = await writeWorkflow(spec);
    const r2 = await writeWorkflow(spec);
    assert.notEqual(r1.slug, r2.slug);
    assert.ok(r2.slug.startsWith("upgrade-deps-"));
    assert.match(r2.slug, /-[0-9a-f]{8}$/);
    const files = readdirSync(join(root, ".cae", "workflows"));
    assert.equal(files.length, 2);
  });
});

test("writeWorkflow: explicit opts.slug overwrites same slug", async () => {
  await withTempRoot(async (root) => {
    const spec: WorkflowSpec = {
      name: "upgrade-deps",
      trigger: { type: "manual" },
      steps: [],
    };
    const r1 = await writeWorkflow(spec, { slug: "pinned" });
    const r2 = await writeWorkflow(
      { ...spec, description: "v2" },
      { slug: "pinned" },
    );
    assert.equal(r1.slug, "pinned");
    assert.equal(r2.slug, "pinned");
    const files = readdirSync(join(root, ".cae", "workflows"));
    assert.equal(files.length, 1);
    const fetched = await getWorkflow("pinned");
    assert.ok(fetched);
    assert.equal(fetched!.spec.description, "v2");
  });
});

test("getWorkflow: returns null for nonexistent slug", async () => {
  await withTempRoot(async () => {
    const res = await getWorkflow("nope");
    assert.equal(res, null);
  });
});

test("getWorkflow: returns WorkflowRecord for existing slug", async () => {
  await withTempRoot(async () => {
    const spec: WorkflowSpec = {
      name: "foo",
      trigger: { type: "manual" },
      steps: [{ action: "push" }],
    };
    await writeWorkflow(spec);
    const r = await getWorkflow("foo");
    assert.ok(r);
    assert.equal(r!.slug, "foo");
    assert.equal(r!.spec.name, "foo");
    assert.ok(r!.yaml.includes("foo"));
    assert.ok(r!.mtime > 0);
    assert.ok(r!.filepath.endsWith("foo.yml"));
  });
});

test("listWorkflows: skips malformed YAML files without throwing", async () => {
  await withTempRoot(async (root) => {
    // Write one valid + one malformed
    const good: WorkflowSpec = {
      name: "good",
      trigger: { type: "manual" },
      steps: [],
    };
    await writeWorkflow(good);
    const wfDir = join(root, ".cae", "workflows");
    writeFileSync(join(wfDir, "broken.yml"), ":\n   !!!garbage:::: :::");
    // Silence console.warn during the test
    const origWarn = console.warn;
    console.warn = () => {};
    try {
      const list = await listWorkflows();
      assert.equal(list.length, 1);
      assert.equal(list[0].slug, "good");
    } finally {
      console.warn = origWarn;
    }
  });
});
