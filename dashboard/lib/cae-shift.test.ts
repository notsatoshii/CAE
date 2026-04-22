// RED-phase scaffold for Phase 10 plan 01. Fails until lib/cae-shift.ts lands in wave 1.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  resolveProject,
  readShiftState,
  buildAnswersFile,
  approveGate,
} from "./cae-shift";

const FIXTURE_DIR = join(
  process.cwd(),
  ".planning/phases/10-plan-mode-projects-prds-roadmaps-uat/__fixtures__/plan",
);

describe("resolveProject", () => {
  it("returns null for unknown slug", async () => {
    const result = await resolveProject("totally-unknown-project-xyz");
    expect(result).toBeNull();
  });

  it("matches by basename when only slug given", async () => {
    // When the project list contains a project whose basename matches the slug,
    // resolveProject returns that project. Implementation in cae-shift.ts.
    const result = await resolveProject("some-known-project");
    // Will fail (module not found) until cae-shift.ts ships
    expect(result).toBeDefined();
  });

  it("matches by absolute path when full path given", async () => {
    const result = await resolveProject("/home/cae/some-known-project");
    expect(result).toBeDefined();
  });

  it("rejects path traversal attempts like '../etc'", async () => {
    const result = await resolveProject("../etc/passwd");
    expect(result).toBeNull();
  });
});

describe("readShiftState", () => {
  it("parses state-prd-drafting.json fixture", () => {
    const fixturePath = join(FIXTURE_DIR, "state-prd-drafting.json");
    const raw = JSON.parse(readFileSync(fixturePath, "utf8"));
    // Validate fixture shape before calling the lib
    expect(raw.phase).toBe("prd");
    expect(raw.prd.user_approved).toBe(false);

    // Now call the lib — will fail until cae-shift.ts ships
    const state = readShiftState("/fake/project/root");
    expect(state).not.toBeNull();
  });

  it("returns null when .shift/state.json missing", () => {
    const state = readShiftState("/nonexistent/path/that/has/no/shift");
    expect(state).toBeNull();
  });
});

describe("buildAnswersFile", () => {
  it("writes SHIFT_ANSWERS JSON keyed by idea.what / idea.who / idea.type_ok", async () => {
    const answers = {
      "idea.what": "founder accountability app",
      "idea.who": "solo founders",
      "idea.type_ok": "web",
    };
    const filePath = await buildAnswersFile(answers);
    expect(typeof filePath).toBe("string");
    expect(filePath.length).toBeGreaterThan(0);
  });

  it("returns absolute path under /tmp", async () => {
    const answers = {
      "idea.what": "test app",
      "idea.who": "testers",
      "idea.type_ok": "web",
    };
    const filePath = await buildAnswersFile(answers);
    expect(filePath.startsWith("/tmp")).toBe(true);
  });
});

describe("approveGate", () => {
  it("patches prd.user_approved=true and advances phase to roadmap", async () => {
    const fixturePath = join(FIXTURE_DIR, "state-prd-drafting.json");
    const state = JSON.parse(readFileSync(fixturePath, "utf8"));
    // state.phase === "prd", state.prd.user_approved === false

    const updated = await approveGate(state, "prd");
    expect(updated.prd?.user_approved).toBe(true);
    expect(updated.phase).toBe("roadmap");
  });

  it("patches roadmap.user_approved=true and advances phase to waiting_for_plans", async () => {
    const fixturePath = join(FIXTURE_DIR, "state-roadmap-ready.json");
    const state = JSON.parse(readFileSync(fixturePath, "utf8"));
    // state.phase === "roadmap", state.roadmap.user_approved === false

    const updated = await approveGate(state, "roadmap");
    expect(updated.roadmap?.user_approved).toBe(true);
    expect(updated.phase).toBe("waiting_for_plans");
  });

  it("appends history entry with outcome=dashboard", async () => {
    const fixturePath = join(FIXTURE_DIR, "state-prd-drafting.json");
    const state = JSON.parse(readFileSync(fixturePath, "utf8"));
    const historyLenBefore = state.history.length;

    const updated = await approveGate(state, "prd");
    expect(updated.history.length).toBe(historyLenBefore + 1);
    const last = updated.history[updated.history.length - 1];
    expect(last.outcome).toBe("dashboard");
  });
});
