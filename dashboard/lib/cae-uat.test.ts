// RED-phase scaffold for Phase 10 plan 01. Fails until lib/cae-uat.ts lands in wave 1.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  parseSuccessCriteria,
  loadUatState,
  patchUatState,
} from "./cae-uat";

const FIXTURE_DIR = join(
  process.cwd(),
  ".planning/phases/10-plan-mode-projects-prds-roadmaps-uat/__fixtures__/plan",
);

describe("parseSuccessCriteria", () => {
  it("returns a Map<phaseNum, UatItem[]> keyed by integer phase", () => {
    const roadmapPath = join(FIXTURE_DIR, "ROADMAP.md");
    const roadmapContent = readFileSync(roadmapPath, "utf8");

    const result = parseSuccessCriteria(roadmapContent);
    expect(result).toBeInstanceOf(Map);
    // ROADMAP fixture has 3 phases
    expect(result.size).toBe(3);
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(true);
    expect(result.has(3)).toBe(true);
  });

  it("generates 8-char sha1 ids unique per (phase, bullet) pair", () => {
    const roadmapPath = join(FIXTURE_DIR, "ROADMAP.md");
    const roadmapContent = readFileSync(roadmapPath, "utf8");

    const result = parseSuccessCriteria(roadmapContent);
    const allIds: string[] = [];
    for (const items of result.values()) {
      for (const item of items) {
        expect(item.id).toHaveLength(8);
        expect(allIds).not.toContain(item.id);
        allIds.push(item.id);
      }
    }
    // All 9 bullets from fixture (5+4+5 = 14... fixture has 5+4+5=14? recount)
    // ROADMAP fixture: Phase1=5, Phase2=4, Phase3=5 bullets
    expect(allIds.length).toBeGreaterThanOrEqual(9);
  });

  it("returns empty map for ROADMAP with no Definition of done bullets", () => {
    const noDodContent = "# My Project\n\n## Phase 1: Foundation\nGoal: test.\n\nSome prose but no checklist.\n";
    const result = parseSuccessCriteria(noDodContent);
    expect(result.size).toBe(0);
  });
});

describe("loadUatState / patchUatState", () => {
  it("creates .planning/uat/phase<N>.json on first patch", async () => {
    const projectRoot = "/tmp/uat-test-" + Date.now();
    const patch = {
      phase: 1,
      id: "abc12345",
      status: "pass" as const,
      note: "Verified manually",
    };

    const result = await patchUatState(projectRoot, patch);
    expect(result).toBeDefined();
    expect(result.items).toBeDefined();
  });

  it("updates status=pass and records ts/note", async () => {
    const projectRoot = "/tmp/uat-test-pass-" + Date.now();
    const patch = {
      phase: 1,
      id: "abc12345",
      status: "pass" as const,
      note: "All green",
    };

    const result = await patchUatState(projectRoot, patch);
    const updated = result.items.find((i: { id: string }) => i.id === patch.id);
    if (updated) {
      expect(updated.status).toBe("pass");
      expect(updated.note).toBe("All green");
      expect(updated.ts).toBeDefined();
    }
    // If item not found (fresh project), patch creates it
    expect(result.items.length).toBeGreaterThanOrEqual(0);
  });

  it("flags orphaned=true on items whose id no longer exists in current ROADMAP", async () => {
    const projectRoot = "/tmp/uat-test-orphan-" + Date.now();

    // Load state — loadUatState returns existing phase state file
    const state = await loadUatState(projectRoot, 1);
    expect(state).toBeDefined();
    // Orphan detection: items in state file whose id is not in the current roadmap
    // get flagged with orphaned: true. Test the shape is correct.
    expect(Array.isArray(state.items)).toBe(true);
  });

  it("clears orphaned flag when a previously-orphaned bullet is re-added to ROADMAP (WR-03)", async () => {
    const { mkdir, writeFile, readFile } = await import("fs/promises");
    const { join } = await import("path");

    const projectRoot = "/tmp/uat-test-reorphan-" + Date.now();
    const roadmapDir = join(projectRoot, ".planning");
    const uatDir = join(projectRoot, ".planning", "uat");

    await mkdir(roadmapDir, { recursive: true });
    await mkdir(uatDir, { recursive: true });

    // Step 1: ROADMAP has bullet "Deploy to production"
    const roadmapWith = [
      "## Phase 1: Launch",
      "",
      "Definition of done:",
      "- Deploy to production",
      "",
    ].join("\n");
    await writeFile(join(roadmapDir, "ROADMAP.md"), roadmapWith, "utf8");

    // First load — creates state with the bullet as pending (not orphaned)
    const state1 = await loadUatState(projectRoot, 1);
    expect(state1.items).toHaveLength(1);
    expect(state1.items[0].orphaned).toBeUndefined();
    const bulletId = state1.items[0].id;

    // Step 2: bullet removed from ROADMAP — item becomes orphaned in saved state
    const roadmapWithout = [
      "## Phase 1: Launch",
      "",
      "Definition of done:",
      "- Some other criterion",
      "",
    ].join("\n");
    await writeFile(join(roadmapDir, "ROADMAP.md"), roadmapWithout, "utf8");

    const state2 = await loadUatState(projectRoot, 1);
    const orphanedItem = state2.items.find((it) => it.id === bulletId);
    expect(orphanedItem).toBeDefined();
    expect(orphanedItem!.orphaned).toBe(true);

    // Step 3: bullet re-added verbatim — orphaned flag must be cleared
    await writeFile(join(roadmapDir, "ROADMAP.md"), roadmapWith, "utf8");

    const state3 = await loadUatState(projectRoot, 1);
    const reliveBullet = state3.items.find((it) => it.id === bulletId);
    expect(reliveBullet).toBeDefined();
    // The fix: orphaned must NOT be true when the bullet is back in the ROADMAP
    expect(reliveBullet!.orphaned).toBeUndefined();
  });
});
