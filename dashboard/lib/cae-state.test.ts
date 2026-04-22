// RED-phase scaffold for Phase 10 plan 01. Fails until lib/cae-state.ts Shift extension lands in plan 10-04.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// We re-import after setting env so the lib re-reads SHIFT_PROJECTS_HOME
let tmpRoot: string;
let savedShiftHome: string | undefined;

beforeEach(async () => {
  savedShiftHome = process.env.SHIFT_PROJECTS_HOME;
  tmpRoot = await fs.mkdtemp(join(tmpdir(), "cae-state-test-"));
});

afterEach(async () => {
  if (savedShiftHome === undefined) delete process.env.SHIFT_PROJECTS_HOME;
  else process.env.SHIFT_PROJECTS_HOME = savedShiftHome;
  try {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  vi.resetModules();
});

async function importListProjects() {
  vi.resetModules();
  const mod = await import("./cae-state");
  return mod.listProjects;
}

describe("listProjects with Shift discovery", () => {
  it("surfaces directories under SHIFT_PROJECTS_HOME with .shift/state.json", async () => {
    // Create a fake Shift project under tmpRoot
    const projDir = join(tmpRoot, "my-project");
    const shiftDir = join(projDir, ".shift");
    await fs.mkdir(shiftDir, { recursive: true });
    await fs.writeFile(
      join(shiftDir, "state.json"),
      JSON.stringify({
        schema_version: 1,
        project_name: "my-project",
        phase: "prd",
        updated: "2026-04-23T10:15:00Z",
        idea: { what: "test", who: "testers", type: "web" },
        history: [],
      }),
    );
    process.env.SHIFT_PROJECTS_HOME = tmpRoot;

    const listProjects = await importListProjects();
    const projects = await listProjects();
    const found = projects.find((p) => p.name === "my-project");
    expect(found).toBeDefined();
  });

  it("attaches shiftPhase + shiftUpdated from state.json", async () => {
    const projDir = join(tmpRoot, "shift-proj");
    const shiftDir = join(projDir, ".shift");
    await fs.mkdir(shiftDir, { recursive: true });
    await fs.writeFile(
      join(shiftDir, "state.json"),
      JSON.stringify({
        schema_version: 1,
        project_name: "shift-proj",
        phase: "roadmap",
        updated: "2026-04-23T10:30:00Z",
        idea: { what: "test", who: "testers", type: "web" },
        history: [],
      }),
    );
    process.env.SHIFT_PROJECTS_HOME = tmpRoot;

    const listProjects = await importListProjects();
    const projects = await listProjects();
    const found = projects.find((p) => p.name === "shift-proj");
    expect(found?.shiftPhase).toBe("roadmap");
    expect(found?.shiftUpdated).toBe("2026-04-23T10:30:00Z");
  });

  it("sorts by shiftUpdated desc when present", async () => {
    // Create two Shift projects with different timestamps
    for (const [name, ts] of [
      ["proj-old", "2026-04-22T08:00:00Z"],
      ["proj-new", "2026-04-23T10:00:00Z"],
    ]) {
      const projDir = join(tmpRoot, name);
      const shiftDir = join(projDir, ".shift");
      await fs.mkdir(shiftDir, { recursive: true });
      await fs.writeFile(
        join(shiftDir, "state.json"),
        JSON.stringify({
          schema_version: 1,
          project_name: name,
          phase: "idea",
          updated: ts,
          idea: { what: "test", who: "testers", type: "web" },
          history: [],
        }),
      );
    }
    process.env.SHIFT_PROJECTS_HOME = tmpRoot;

    const listProjects = await importListProjects();
    const projects = await listProjects();
    const shiftProjects = projects.filter((p) => p.shiftUpdated != null);
    if (shiftProjects.length >= 2) {
      const dates = shiftProjects.map((p) => new Date(p.shiftUpdated!).getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
    }
  });

  it("deduplicates by absolute path against the hard-coded candidates list", async () => {
    // If a directory shows up both as a hard-coded candidate and via SHIFT_PROJECTS_HOME scan,
    // it should appear only once in the output.
    process.env.SHIFT_PROJECTS_HOME = tmpRoot;

    const listProjects = await importListProjects();
    const projects = await listProjects();
    const paths = projects.map((p) => p.path);
    const unique = new Set(paths);
    expect(paths.length).toBe(unique.size);
  });

  it("skips directories without .shift/state.json (not a Shift project)", async () => {
    // Create a plain directory with no .shift/
    const plainDir = join(tmpRoot, "plain-dir");
    await fs.mkdir(plainDir, { recursive: true });
    process.env.SHIFT_PROJECTS_HOME = tmpRoot;

    const listProjects = await importListProjects();
    const projects = await listProjects();
    const found = projects.find((p) => p.name === "plain-dir" && p.shiftPhase != null);
    expect(found).toBeUndefined();
  });
});
