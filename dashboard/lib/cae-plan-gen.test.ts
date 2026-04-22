// RED-phase scaffold for Phase 10 plan 01. Fails until lib/cae-plan-gen.ts lands in wave 1.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  extractPhase1,
  writeBuildplan,
  stubPlan,
} from "./cae-plan-gen";

const FIXTURE_DIR = join(
  process.cwd(),
  ".planning/phases/10-plan-mode-projects-prds-roadmaps-uat/__fixtures__/plan",
);

describe("extractPhase1", () => {
  it("extracts the '## Phase 1' section verbatim including Definition of done", () => {
    const roadmapPath = join(FIXTURE_DIR, "ROADMAP.md");
    const roadmapContent = readFileSync(roadmapPath, "utf8");

    const section = extractPhase1(roadmapContent);
    expect(section).not.toBeNull();
    expect(section).toContain("## Phase 1");
    expect(section).toContain("Definition of done");
  });

  it("returns null when no Phase 1 heading exists", () => {
    const noPhase1Content = "# My Project\n\n## Phase 2: Something\nGoal: test.\n";
    const section = extractPhase1(noPhase1Content);
    expect(section).toBeNull();
  });
});

describe("writeBuildplan", () => {
  it("writes .planning/phases/01-<slug>/BUILDPLAN.md under project root", async () => {
    const projectRoot = "/tmp/test-proj-" + Date.now();
    const slug = "test-proj";
    const content = "## Phase 1: Foundation\nDefinition of done:\n- Thing works\n";

    const outPath = await writeBuildplan(projectRoot, slug, content);
    expect(outPath).toContain("01-" + slug);
    expect(outPath).toContain("BUILDPLAN.md");
  });
});

describe("stubPlan", () => {
  it("writes a waiting_for_plans stub PLAN.md when auto-gen fails", async () => {
    const projectRoot = "/tmp/test-proj-stub-" + Date.now();
    const slug = "test-stub";

    const outPath = await stubPlan(projectRoot, slug);
    expect(outPath).toContain("PLAN.md");
    // The stub content should communicate the manual fallback
    expect(typeof outPath).toBe("string");
  });
});
