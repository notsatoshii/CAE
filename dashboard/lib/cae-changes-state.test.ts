/**
 * Phase 9 Plan 02 — cae-changes-state unit tests.
 *
 * Covers:
 *   - parseMergeLine / parseBranchFromSubject (pure)
 *   - parseGithubUrl (ssh + https + gitlab null + edge cases)
 *   - commitUrlFor
 *   - dedupeBySha
 *   - joinCbEvents
 *   - relativeTime buckets (fixed `now`)
 *   - proseForEvent template (D-02)
 *   - getChanges integration (mocked I/O)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// Mock setup.
//
// listProjects/tailJsonl are mocked via vi.mock of "./cae-state" (ESM import
// substitution works cleanly on our own modules). execAsync is swapped via
// the explicit `__setExecAsyncForTest` hook on cae-changes-state, which is
// more reliable than mocking Node's `util.promisify` / `child_process` under
// jsdom (promisify captures `exec` at module-init; subsequent mocks miss).
// ============================================================================

const { listProjectsMock, tailJsonlMock } = vi.hoisted(() => ({
  listProjectsMock: vi.fn(),
  tailJsonlMock: vi.fn(),
}));

vi.mock("./cae-state", () => ({
  listProjects: (...args: unknown[]) => listProjectsMock(...args),
  tailJsonl: (...args: unknown[]) => tailJsonlMock(...args),
}));

// Import AFTER vi.mock so the mocks are wired up.
import {
  parseMergeLine,
  parseBranchFromSubject,
  parseGithubUrl,
  commitUrlFor,
  dedupeBySha,
  joinCbEvents,
  relativeTime,
  proseForEvent,
  getChanges,
  __resetChangesCacheForTest,
  __setExecAsyncForTest,
  type ChangeEvent,
} from "./cae-changes-state";

// execMock: every call from execAsync routes through this fn. Integration
// tests set an implementation; pure tests don't need this.
const execMock = vi.fn();

// ============================================================================
// parseMergeLine
// ============================================================================

describe("parseMergeLine", () => {
  it("parses a well-formed git-log line into sha/shaShort/ts/subject/author", () => {
    const line =
      "abc1234def5678aaaaaaaaaaaaaaaaaaaaaaaaaa|abc1234|2026-04-20T14:00:00+00:00|Merge forge/p9-plA-t1-ab12cd (Sentinel-approved)|Forge";
    const parsed = parseMergeLine(line);
    expect(parsed).not.toBeNull();
    expect(parsed!.sha).toBe("abc1234def5678aaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(parsed!.shaShort).toBe("abc1234");
    expect(parsed!.ts).toBe("2026-04-20T14:00:00+00:00");
    expect(parsed!.subject).toBe("Merge forge/p9-plA-t1-ab12cd (Sentinel-approved)");
    expect(parsed!.author).toBe("Forge");
  });

  it("returns null on malformed lines (too few fields)", () => {
    expect(parseMergeLine("abc|def")).toBeNull();
    expect(parseMergeLine("")).toBeNull();
  });

  it("preserves pipe characters inside the subject field", () => {
    const line =
      "aaaa|a1234|2026-04-20T14:00:00+00:00|Merge forge/p9-plA-t1-ab12cd | feature | more|Author Name";
    const parsed = parseMergeLine(line);
    expect(parsed).not.toBeNull();
    // Author is the LAST pipe-separated field; subject is everything between ts and author.
    expect(parsed!.author).toBe("Author Name");
    expect(parsed!.subject).toBe("Merge forge/p9-plA-t1-ab12cd | feature | more");
  });
});

// ============================================================================
// parseBranchFromSubject
// ============================================================================

describe("parseBranchFromSubject", () => {
  it("extracts branch/phase/task from a forge merge", () => {
    const r = parseBranchFromSubject("Merge forge/p9-plA-t1-ab12cd (Sentinel-approved)");
    expect(r.branch).toBe("forge/p9-plA-t1-ab12cd");
    expect(r.phase).toBe("p9");
    expect(r.task).toBe("p9-plA-t1-ab12cd");
  });

  it("extracts from a two-digit phase number", () => {
    const r = parseBranchFromSubject("Merge forge/p12-plB-t3-ffeeff");
    expect(r.branch).toBe("forge/p12-plB-t3-ffeeff");
    expect(r.phase).toBe("p12");
    expect(r.task).toBe("p12-plB-t3-ffeeff");
  });

  it("returns null fields on a non-forge merge subject", () => {
    const r = parseBranchFromSubject("Merge pull request #42 from feature");
    expect(r.branch).toBeNull();
    expect(r.phase).toBeNull();
    expect(r.task).toBeNull();
  });

  it("returns null fields on an empty string", () => {
    const r = parseBranchFromSubject("");
    expect(r.branch).toBeNull();
    expect(r.phase).toBeNull();
    expect(r.task).toBeNull();
  });
});

// ============================================================================
// parseGithubUrl + commitUrlFor
// ============================================================================

describe("parseGithubUrl", () => {
  it("parses ssh URL with .git suffix", () => {
    expect(parseGithubUrl("git@github.com:notsatoshii/CAE.git")).toBe(
      "https://github.com/notsatoshii/CAE",
    );
  });

  it("parses https URL with .git suffix", () => {
    expect(parseGithubUrl("https://github.com/notsatoshii/CAE.git")).toBe(
      "https://github.com/notsatoshii/CAE",
    );
  });

  it("parses https URL without .git suffix", () => {
    expect(parseGithubUrl("https://github.com/notsatoshii/CAE")).toBe(
      "https://github.com/notsatoshii/CAE",
    );
  });

  it("parses https URL with trailing slash", () => {
    expect(parseGithubUrl("https://github.com/notsatoshii/CAE/")).toBe(
      "https://github.com/notsatoshii/CAE",
    );
  });

  it("returns null for gitlab URL", () => {
    expect(parseGithubUrl("https://gitlab.com/foo/bar.git")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseGithubUrl("")).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseGithubUrl(undefined)).toBeNull();
  });

  it("returns null for non-github URLs", () => {
    expect(parseGithubUrl("git@bitbucket.org:foo/bar.git")).toBeNull();
  });
});

describe("commitUrlFor", () => {
  it("builds a /commit/<sha> URL from a base", () => {
    expect(commitUrlFor("https://github.com/notsatoshii/CAE", "abc123")).toBe(
      "https://github.com/notsatoshii/CAE/commit/abc123",
    );
  });

  it("returns null when base is null", () => {
    expect(commitUrlFor(null, "abc123")).toBeNull();
  });
});

// ============================================================================
// dedupeBySha
// ============================================================================

describe("dedupeBySha", () => {
  function stubEvent(sha: string, ts = "2026-04-20T14:00:00Z"): ChangeEvent {
    return {
      ts,
      project: "/p",
      projectName: "p",
      sha,
      shaShort: sha.slice(0, 7),
      mergeSubject: `Merge ${sha}`,
      branch: null,
      phase: null,
      task: null,
      githubUrl: null,
      agent: null,
      model: null,
      tokens: null,
      commits: [],
      prose: "",
    };
  }

  it("keeps the first occurrence of each sha", () => {
    const a1 = stubEvent("A", "2026-04-20T10:00:00Z");
    const b1 = stubEvent("B", "2026-04-20T11:00:00Z");
    const a2 = stubEvent("A", "2026-04-20T12:00:00Z"); // duplicate, different project
    const out = dedupeBySha([a1, b1, a2]);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(a1);
    expect(out[1]).toBe(b1);
  });

  it("returns empty array on empty input", () => {
    expect(dedupeBySha([])).toEqual([]);
  });
});

// ============================================================================
// joinCbEvents
// ============================================================================

describe("joinCbEvents", () => {
  function stubEvent(task: string | null): ChangeEvent {
    return {
      ts: "2026-04-20T14:00:00Z",
      project: "/p",
      projectName: "p",
      sha: "abc",
      shaShort: "abc",
      mergeSubject: "m",
      branch: task ? `forge/${task}` : null,
      phase: task ? task.split("-")[0] : null,
      task,
      githubUrl: null,
      agent: null,
      model: null,
      tokens: null,
      commits: [],
      prose: "",
    };
  }

  it("populates agent/model/tokens when cb entry matches task_id", () => {
    const e = stubEvent("p9-plA-t1-ab12cd");
    const cbMap = new Map<string, { agent?: string; model?: string; input_tokens?: number; output_tokens?: number }>([
      ["p9-plA-t1-ab12cd", { agent: "forge", model: "claude-sonnet-4-6", input_tokens: 1000, output_tokens: 500 }],
    ]);
    joinCbEvents([e], cbMap);
    expect(e.agent).toBe("forge");
    expect(e.model).toBe("claude-sonnet-4-6");
    expect(e.tokens).toBe(1500);
  });

  it("leaves fields null when task_id has no matching cb entry", () => {
    const e = stubEvent("p9-plA-t1-missing");
    joinCbEvents([e], new Map());
    expect(e.agent).toBeNull();
    expect(e.model).toBeNull();
    expect(e.tokens).toBeNull();
  });

  it("leaves fields null when event has no task", () => {
    const e = stubEvent(null);
    const cbMap = new Map([["anything", { agent: "forge", model: "x" }]]);
    joinCbEvents([e], cbMap);
    expect(e.agent).toBeNull();
    expect(e.model).toBeNull();
    expect(e.tokens).toBeNull();
  });

  it("treats missing tokens as null, not zero", () => {
    const e = stubEvent("p9-plA-t1-zero");
    const cbMap = new Map([["p9-plA-t1-zero", { agent: "forge" }]]);
    joinCbEvents([e], cbMap);
    expect(e.agent).toBe("forge");
    expect(e.tokens).toBeNull();
  });
});

// ============================================================================
// relativeTime
// ============================================================================

describe("relativeTime", () => {
  const now = new Date("2026-04-22T20:00:00Z");

  it("returns 'just now' for <1m ago", () => {
    expect(relativeTime("2026-04-22T19:59:30Z", now)).toBe("just now");
  });

  it("returns 'this morning' for same-day pre-noon UTC", () => {
    expect(relativeTime("2026-04-22T08:00:00Z", now)).toBe("this morning");
  });

  it("returns 'this afternoon' for same-day 12:00-18:00 UTC", () => {
    expect(relativeTime("2026-04-22T13:00:00Z", now)).toBe("this afternoon");
  });

  it("returns 'this evening' for same-day 18:00+ UTC", () => {
    expect(relativeTime("2026-04-22T19:00:00Z", now)).toBe("this evening");
  });

  it("returns 'yesterday' for the prior calendar day", () => {
    expect(relativeTime("2026-04-21T10:00:00Z", now)).toBe("yesterday");
  });

  it("returns weekday name for events 2-6 days ago", () => {
    // 2026-04-18 is a Saturday in UTC.
    expect(relativeTime("2026-04-18T10:00:00Z", now)).toBe("Saturday");
  });

  it("returns M/D format for events >=7 days ago", () => {
    expect(relativeTime("2026-04-10T10:00:00Z", now)).toBe("4/10");
  });
});

// ============================================================================
// proseForEvent
// ============================================================================

describe("proseForEvent", () => {
  const now = new Date("2026-04-22T20:00:00Z");

  it("uses founder_label when agent is known", () => {
    const out = proseForEvent(
      {
        agent: "forge",
        projectName: "cae-dashboard",
        commits: [
          { sha: "a", shaShort: "a", subject: "s1" },
          { sha: "b", shaShort: "b", subject: "s2" },
          { sha: "c", shaShort: "c", subject: "s3" },
        ],
        ts: "2026-04-22T08:00:00Z", // morning
      },
      now,
    );
    expect(out).toBe("the builder shipped 3 changes to cae-dashboard this morning.");
  });

  it("falls back to 'CAE' when agent is null + singular 'change' for count=1", () => {
    const out = proseForEvent(
      {
        agent: null,
        projectName: "lever",
        commits: [{ sha: "a", shaShort: "a", subject: "s1" }],
        ts: "2026-04-22T08:00:00Z",
      },
      now,
    );
    expect(out).toBe("CAE shipped 1 change to lever this morning.");
  });

  it("handles 0 commits (defensive)", () => {
    const out = proseForEvent(
      { agent: null, projectName: "empty", commits: [], ts: "2026-04-22T08:00:00Z" },
      now,
    );
    expect(out).toBe("CAE shipped 0 changes to empty this morning.");
  });
});

// ============================================================================
// getChanges integration (mocked)
// ============================================================================

describe("getChanges (integration, mocked I/O)", () => {
  beforeEach(() => {
    execMock.mockReset();
    listProjectsMock.mockReset();
    tailJsonlMock.mockReset();
    __resetChangesCacheForTest();
    // Route execAsync through the controllable execMock. The implementation's
    // execMock returns `{stdout: ...}` sync; our shim converts into promise.
    // Synchronous throws from execMock become promise rejections (mirrors
    // real `execAsync` which rejects on non-zero exit / spawn failure).
    __setExecAsyncForTest(async (cmd: string, opts?: unknown) => {
      let res: unknown;
      try {
        res = execMock(cmd, opts);
      } catch (err) {
        throw err;
      }
      if (res instanceof Error) throw res;
      return {
        stdout:
          res && typeof res === "object" && "stdout" in res
            ? ((res as { stdout: string }).stdout ?? "")
            : "",
        stderr: "",
      };
    });
  });

  afterEach(() => {
    __setExecAsyncForTest(null);
    __resetChangesCacheForTest();
  });

  it("returns newest-first events, deduped by sha, joined with cb events", async () => {
    listProjectsMock.mockResolvedValue([
      { name: "cae", path: "/a", hasPlanning: true },
      { name: "dash", path: "/b", hasPlanning: true },
    ]);

    // execMock handles both the merge-list and the per-merge commit-list.
    execMock.mockImplementation((cmd: string, _opts: unknown) => {
      if (cmd.includes("--merges")) {
        if (cmd.includes("--since")) {
          // Different stdout per project path via opts cwd? Simpler: alternate by call.
        }
      }
      // Default: inspect the cwd through opts.
      const opts = _opts as { cwd?: string } | undefined;
      if (cmd.includes("--merges") && opts?.cwd === "/a") {
        return {
          stdout:
            "aaaaaaaa11111111|aaaa111|2026-04-20T14:00:00+00:00|Merge forge/p9-plA-t1-ab12cd|Forge\n" +
            "bbbbbbbb22222222|bbbb222|2026-04-19T10:00:00+00:00|Merge pull request #42 from misc|User",
        };
      }
      if (cmd.includes("--merges") && opts?.cwd === "/b") {
        // Project /b re-reports the same merge aaaa (subtree) + a new one.
        return {
          stdout:
            "aaaaaaaa11111111|aaaa111|2026-04-20T14:00:00+00:00|Merge forge/p9-plA-t1-ab12cd|Forge\n" +
            "cccccccc33333333|cccc333|2026-04-21T09:00:00+00:00|Merge forge/p9-plB-t2-cd34ef|Forge",
        };
      }
      if (cmd.includes("git config --get remote.origin.url")) {
        if (opts?.cwd === "/a") return { stdout: "git@github.com:notsatoshii/CAE.git\n" };
        if (opts?.cwd === "/b") return { stdout: "" }; // no remote
      }
      // Per-merge commit list (git log -n 20 SHA^..SHA)
      if (cmd.includes("^..")) {
        return { stdout: "xxxx|xxxx|one commit subject" };
      }
      return { stdout: "" };
    });

    tailJsonlMock.mockResolvedValue([
      {
        ts: "2026-04-20T13:59:00Z",
        event: "forge_end",
        task_id: "p9-plA-t1-ab12cd",
        agent: "forge",
        model: "claude-sonnet-4-6",
        input_tokens: 700,
        output_tokens: 300,
      },
    ]);

    const out = await getChanges();

    // 3 raw events (2 in /a + 2 in /b) → dedupe on sha aaaa drops one.
    expect(out).toHaveLength(3);
    // Newest-first.
    expect(out[0].sha).toBe("cccccccc33333333"); // 04-21
    expect(out[1].sha).toBe("aaaaaaaa11111111"); // 04-20
    expect(out[2].sha).toBe("bbbbbbbb22222222"); // 04-19

    // aaaa is forge merge → branch parsed, cb joined.
    const aaaa = out.find((e) => e.sha === "aaaaaaaa11111111")!;
    expect(aaaa.branch).toBe("forge/p9-plA-t1-ab12cd");
    expect(aaaa.phase).toBe("p9");
    expect(aaaa.task).toBe("p9-plA-t1-ab12cd");
    expect(aaaa.agent).toBe("forge");
    expect(aaaa.model).toBe("claude-sonnet-4-6");
    expect(aaaa.tokens).toBe(1000);
    // First occurrence wins — project /a's github URL applies, not /b's null.
    expect(aaaa.githubUrl).toBe("https://github.com/notsatoshii/CAE/commit/aaaaaaaa11111111");
    expect(aaaa.project).toBe("/a");

    // Non-forge merge bbbb → branch null, cb not joined.
    const bbbb = out.find((e) => e.sha === "bbbbbbbb22222222")!;
    expect(bbbb.branch).toBeNull();
    expect(bbbb.agent).toBeNull();
    expect(bbbb.tokens).toBeNull();

    // cccc is forge merge in /b but has no matching cb entry.
    const cccc = out.find((e) => e.sha === "cccccccc33333333")!;
    expect(cccc.task).toBe("p9-plB-t2-cd34ef");
    expect(cccc.agent).toBeNull();
    expect(cccc.tokens).toBeNull();
    // No remote on /b → githubUrl null.
    expect(cccc.githubUrl).toBeNull();

    // Prose is populated with the founder label + projectName (basename of "/a" = "a").
    expect(aaaa.prose).toContain("the builder shipped");
    expect(aaaa.prose).toContain("to a");
  });

  it("survives a bad project without poisoning the rest", async () => {
    listProjectsMock.mockResolvedValue([
      { name: "good", path: "/good", hasPlanning: true },
      { name: "bad", path: "/bad", hasPlanning: true },
    ]);

    execMock.mockImplementation((cmd: string, opts: unknown) => {
      const o = opts as { cwd?: string } | undefined;
      if (o?.cwd === "/bad") {
        throw new Error("ENOENT .git missing");
      }
      if (cmd.includes("--merges") && o?.cwd === "/good") {
        return {
          stdout:
            "ddddddddeeeeeeee|dddddde|2026-04-22T10:00:00+00:00|Merge forge/p9-plC-t5-999999|Forge",
        };
      }
      return { stdout: "" };
    });

    tailJsonlMock.mockResolvedValue([]);

    const out = await getChanges();
    expect(out).toHaveLength(1);
    expect(out[0].project).toBe("/good");
  });
});
