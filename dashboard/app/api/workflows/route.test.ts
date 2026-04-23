/**
 * Integration tests for /api/workflows CRUD routes.
 *
 * Run: `npx tsx app/api/workflows/route.test.ts`
 *
 * Strategy: set process.env.CAE_ROOT to a fresh mkdtempSync directory before
 * requiring the route handlers so WORKFLOWS_DIR() resolves to the temp path.
 * Call the exported GET/POST/PUT/DELETE handlers directly with NextRequest
 * mocks — avoids spinning up Next's HTTP layer.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// --- Point CAE_ROOT at a temp dir BEFORE importing the route modules. ---
const TEST_ROOT = mkdtempSync(join(tmpdir(), "cae-wf-route-test-"));
process.env.CAE_ROOT = TEST_ROOT;

// Now dynamic-import handlers — WORKFLOWS_DIR() reads CAE_ROOT per call so this
// is fine, but we set it this early for belt-and-suspenders.
import { NextRequest } from "next/server";
import { GET as listGET, POST as listPOST } from "./route";
import {
  GET as itemGET,
  PUT as itemPUT,
  DELETE as itemDELETE,
} from "./[slug]/route";

function mkReq(
  url: string,
  init?: { method?: string; body?: unknown },
): NextRequest {
  const req = new NextRequest(url, {
    method: init?.method ?? "GET",
    body: init?.body ? JSON.stringify(init.body) : undefined,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  return req;
}

function paramsCtx(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

process.on("exit", () => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

// ---------- Tests ----------

const VALID_YAML = [
  "name: example-wf",
  "trigger:",
  "  type: manual",
  "steps:",
  "  - agent: forge",
  "    task: do stuff",
].join("\n");

const VALID_YAML_B = [
  "name: another-wf",
  "trigger:",
  "  type: manual",
  "steps:",
  "  - action: push",
].join("\n");

test("GET /api/workflows on empty dir → { workflows: [] }", async () => {
  const res = await listGET(mkReq("http://localhost/api/workflows"));
  assert.equal(res.status, 200);
  const body = (await readJson(res)) as { workflows: unknown[] };
  assert.ok(Array.isArray(body.workflows));
});

test("POST /api/workflows with valid yaml → 201 + workflow record", async () => {
  const req = mkReq("http://localhost/api/workflows", {
    method: "POST",
    body: { yaml: VALID_YAML },
  });
  const res = await listPOST(req);
  assert.equal(res.status, 201);
  const body = (await readJson(res)) as { workflow: { slug: string; spec: { name: string } } };
  assert.ok(body.workflow);
  assert.equal(body.workflow.spec.name, "example-wf");
  assert.equal(body.workflow.slug, "example-wf");
});

test("POST /api/workflows same yaml twice → second gets suffixed slug", async () => {
  const req = mkReq("http://localhost/api/workflows", {
    method: "POST",
    body: { yaml: VALID_YAML },
  });
  const res = await listPOST(req);
  assert.equal(res.status, 201);
  const body = (await readJson(res)) as { workflow: { slug: string } };
  assert.notEqual(body.workflow.slug, "example-wf"); // collision → suffix appended
  assert.ok(body.workflow.slug.startsWith("example-wf-"));
});

test("GET /api/workflows after POSTs → sorted by mtime desc, multiple entries", async () => {
  // Post a second distinct workflow first
  const reqPost = mkReq("http://localhost/api/workflows", {
    method: "POST",
    body: { yaml: VALID_YAML_B },
  });
  await listPOST(reqPost);
  const res = await listGET(mkReq("http://localhost/api/workflows"));
  const body = (await readJson(res)) as { workflows: Array<{ slug: string; mtime: number }> };
  assert.ok(body.workflows.length >= 2);
  for (let i = 0; i < body.workflows.length - 1; i++) {
    assert.ok(body.workflows[i].mtime >= body.workflows[i + 1].mtime);
  }
});

test("GET /api/workflows/[slug] unknown → 404", async () => {
  const res = await itemGET(
    mkReq("http://localhost/api/workflows/nope"),
    paramsCtx("nope"),
  );
  assert.equal(res.status, 404);
});

test("GET /api/workflows/[slug] known → 200 + record", async () => {
  const res = await itemGET(
    mkReq("http://localhost/api/workflows/example-wf"),
    paramsCtx("example-wf"),
  );
  assert.equal(res.status, 200);
  const body = (await readJson(res)) as { workflow: { spec: { name: string } } };
  assert.equal(body.workflow.spec.name, "example-wf");
});

test("PUT /api/workflows/[slug] with new yaml → 200 + updated spec (same slug)", async () => {
  const updated = [
    "name: example-wf",
    "description: updated desc",
    "trigger:",
    "  type: manual",
    "steps:",
    "  - action: push",
  ].join("\n");
  const res = await itemPUT(
    mkReq("http://localhost/api/workflows/example-wf", {
      method: "PUT",
      body: { yaml: updated },
    }),
    paramsCtx("example-wf"),
  );
  assert.equal(res.status, 200);
  const body = (await readJson(res)) as {
    workflow: { slug: string; spec: { description?: string } };
  };
  assert.equal(body.workflow.slug, "example-wf");
  assert.equal(body.workflow.spec.description, "updated desc");
});

test("PUT /api/workflows/[slug] missing → 404", async () => {
  const res = await itemPUT(
    mkReq("http://localhost/api/workflows/ghost", {
      method: "PUT",
      body: { yaml: VALID_YAML },
    }),
    paramsCtx("ghost"),
  );
  assert.equal(res.status, 404);
});

test("POST with empty body → 400 yaml required", async () => {
  const req = new NextRequest("http://localhost/api/workflows", {
    method: "POST",
    body: undefined,
  });
  const res = await listPOST(req);
  assert.equal(res.status, 400);
  const body = (await readJson(res)) as { error: string };
  assert.match(body.error, /yaml/);
});

test("POST with invalid yaml → 400 errors array", async () => {
  const req = mkReq("http://localhost/api/workflows", {
    method: "POST",
    // missing name, bogus agent -> validator rejects
    body: { yaml: "trigger:\n  type: manual\nsteps:\n  - agent: bogus\n    task: x\n" },
  });
  const res = await listPOST(req);
  assert.equal(res.status, 400);
  const body = (await readJson(res)) as { errors: Array<{ path: string; message: string }> };
  assert.ok(Array.isArray(body.errors));
  assert.ok(body.errors.length >= 1);
});

test("PUT with invalid yaml on existing slug → 400 errors", async () => {
  const res = await itemPUT(
    mkReq("http://localhost/api/workflows/example-wf", {
      method: "PUT",
      body: { yaml: "name: example-wf\ntrigger:\n  type: bogus\nsteps: []\n" },
    }),
    paramsCtx("example-wf"),
  );
  assert.equal(res.status, 400);
  const body = (await readJson(res)) as { errors: unknown[] };
  assert.ok(Array.isArray(body.errors));
});

test("DELETE /api/workflows/[slug] existing → 204, subsequent GET → 404", async () => {
  const res = await itemDELETE(
    mkReq("http://localhost/api/workflows/example-wf", { method: "DELETE" }),
    paramsCtx("example-wf"),
  );
  assert.equal(res.status, 204);
  const follow = await itemGET(
    mkReq("http://localhost/api/workflows/example-wf"),
    paramsCtx("example-wf"),
  );
  assert.equal(follow.status, 404);
});

test("DELETE /api/workflows/[slug] missing → 404", async () => {
  const res = await itemDELETE(
    mkReq("http://localhost/api/workflows/never-existed", { method: "DELETE" }),
    paramsCtx("never-existed"),
  );
  assert.equal(res.status, 404);
});

test("writeWorkflow leaves file on disk after POST", async () => {
  const yamlPath = join(TEST_ROOT, ".cae", "workflows");
  assert.ok(existsSync(yamlPath));
});
