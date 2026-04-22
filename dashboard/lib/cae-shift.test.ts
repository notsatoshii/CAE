// RED-phase scaffold for Phase 10 plan 01. Fails until lib/cae-shift.ts lands in wave 1.

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  resolveProject,
  readShiftState,
  buildAnswersFile,
  approveGate,
  runShiftNew,
} from "./cae-shift";

vi.mock("child_process");

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

  it("returns null when .shift/state.json missing", async () => {
    const state = await readShiftState("/nonexistent/path/that/has/no/shift");
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
    const history = updated.history!;
    expect(history.length).toBe(historyLenBefore + 1);
    const last = history[history.length - 1];
    expect(last.outcome).toBe("dashboard");
  });
});

describe("runShiftNew — log directory creation (WR-01)", () => {
  it("includes mkdir -p <projectPath> before tee in the tmux inner command", async () => {
    const { spawn } = await import("child_process");
    const capturedArgs: string[][] = [];
    vi.mocked(spawn).mockImplementation((_cmd: unknown, args: unknown) => {
      capturedArgs.push(args as string[]);
      return { unref: () => {} } as ReturnType<typeof spawn>;
    });

    await runShiftNew("my-project", "/tmp/answers-test.json");

    expect(capturedArgs.length).toBe(1);
    // tmux args: ["new-session", "-d", "-s", <sid>, <inner>] — inner is index 4
    const inner = capturedArgs[0][4];
    // mkdir -p must appear before tee so the log directory exists when tee opens the file
    const mkdirPos = inner.indexOf("mkdir -p");
    const teePos = inner.indexOf("tee");
    expect(mkdirPos).toBeGreaterThanOrEqual(0);
    expect(teePos).toBeGreaterThanOrEqual(0);
    expect(mkdirPos).toBeLessThan(teePos);
  });

  it("mkdir -p targets the projectPath that contains the logFile", async () => {
    const { spawn } = await import("child_process");
    const capturedArgs: string[][] = [];
    vi.mocked(spawn).mockImplementation((_cmd: unknown, args: unknown) => {
      capturedArgs.push(args as string[]);
      return { unref: () => {} } as ReturnType<typeof spawn>;
    });

    await runShiftNew("my-project2", "/tmp/answers-test2.json");

    // tmux args: ["new-session", "-d", "-s", <sid>, <inner>] — inner is index 4
    const inner = capturedArgs[0][4];
    // mkdir -p must quote the projectPath containing "my-project2"
    expect(inner).toMatch(/mkdir -p '[^']*my-project2'/);
  });
});
