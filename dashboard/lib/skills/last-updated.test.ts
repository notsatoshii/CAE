/**
 * Tests for lib/skills/last-updated.ts
 *
 * Covers:
 *   - getSkillsLastUpdatedMap: git log mocked, asserts map shape + memoization.
 *   - getRecentSkillsCommits: git log mocked, asserts parse + memoization.
 *   - groupCommitsByDay: pure, asserts grouping + ordering.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getSkillsLastUpdatedMap,
  getSkillLastUpdated,
  getRecentSkillsCommits,
  groupCommitsByDay,
  __resetLastUpdatedMemoForTests,
  type SkillsCommit,
} from "./last-updated";

beforeEach(() => {
  __resetLastUpdatedMemoForTests();
});

describe("getSkillsLastUpdatedMap", () => {
  it("returns ISO per skill using mocked git log", async () => {
    const execGit = vi.fn(async (args: string[], _cwd: string) => {
      // args = ["log", "-1", "--format=%cI", "--", "skills/<name>"]
      const relPath = args[args.length - 1];
      if (relPath === "skills/cae-herald") return "2026-04-17T02:40:37+09:00\n";
      if (relPath === "skills/cae-scout") return "2026-04-10T11:00:00+00:00\n";
      return "";
    });
    const readSkillsDir = () => ["cae-herald", "cae-scout", "cae-empty"];

    const map = await getSkillsLastUpdatedMap({
      repoRoot: "/fake/repo",
      execGit,
      readSkillsDir,
    });

    expect(map).toEqual({
      "cae-herald": "2026-04-17T02:40:37+09:00",
      "cae-scout": "2026-04-10T11:00:00+00:00",
      "cae-empty": null,
    });
    expect(execGit).toHaveBeenCalledTimes(3);
  });

  it("memoizes for 60s — second call does not re-shell git", async () => {
    const execGit = vi.fn(async () => "2026-04-17T02:40:37+09:00\n");
    const readSkillsDir = () => ["cae-herald"];

    const t0 = 1_000_000;
    const now1 = vi.fn(() => t0);

    await getSkillsLastUpdatedMap({
      repoRoot: "/fake/repo",
      execGit,
      readSkillsDir,
      now: now1,
    });
    const callsAfterFirst = execGit.mock.calls.length;

    // Advance the clock by 30s — still within 60s TTL.
    const now2 = vi.fn(() => t0 + 30_000);
    await getSkillsLastUpdatedMap({
      repoRoot: "/fake/repo",
      execGit,
      readSkillsDir,
      now: now2,
    });

    expect(execGit.mock.calls.length).toBe(callsAfterFirst);
  });

  it("re-fetches after the 60s TTL expires", async () => {
    const execGit = vi.fn(async () => "2026-04-17T02:40:37+09:00\n");
    const readSkillsDir = () => ["cae-herald"];

    const t0 = 1_000_000;
    await getSkillsLastUpdatedMap({
      repoRoot: "/fake/repo",
      execGit,
      readSkillsDir,
      now: () => t0,
    });
    const callsAfterFirst = execGit.mock.calls.length;

    // Advance past the 60s TTL.
    await getSkillsLastUpdatedMap({
      repoRoot: "/fake/repo",
      execGit,
      readSkillsDir,
      now: () => t0 + 61_000,
    });

    expect(execGit.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it("getSkillLastUpdated delegates to the map", async () => {
    const execGit = vi.fn(async () => "2026-04-01T00:00:00Z\n");
    const readSkillsDir = () => ["cae-forge"];
    const iso = await getSkillLastUpdated("cae-forge", {
      repoRoot: "/fake/repo",
      execGit,
      readSkillsDir,
    });
    expect(iso).toBe("2026-04-01T00:00:00Z");
  });

  it("returns null for a skill when git log fails", async () => {
    const execGit = vi.fn(async () => {
      throw new Error("not a git repo");
    });
    const readSkillsDir = () => ["cae-herald"];
    const map = await getSkillsLastUpdatedMap({
      repoRoot: "/fake/repo",
      execGit,
      readSkillsDir,
    });
    expect(map["cae-herald"]).toBeNull();
  });
});

describe("getRecentSkillsCommits", () => {
  it("parses git log output into typed commits", async () => {
    const SEP = "\x1f";
    const line = (
      sha: string,
      fullSha: string,
      iso: string,
      author: string,
      subject: string
    ) => [sha, fullSha, iso, author, subject].join(SEP);
    const stdout = [
      line("5c5ee4e", "5c5ee4e6f00281307164ebaa0f5eb0632e8c5889", "2026-04-17T02:40:37+09:00", "eric", "Herald shipped"),
      line("4f907eb", "4f907ebdeadbeefcafef00dbabecafefeedface0", "2026-04-16T10:00:00+00:00", "eric", "GSD integration"),
    ].join("\n");

    const execGit = vi.fn(async () => stdout);
    const commits = await getRecentSkillsCommits(20, {
      repoRoot: "/fake/repo",
      execGit,
    });

    expect(commits).toHaveLength(2);
    expect(commits[0]).toEqual({
      sha: "5c5ee4e",
      fullSha: "5c5ee4e6f00281307164ebaa0f5eb0632e8c5889",
      iso: "2026-04-17T02:40:37+09:00",
      author: "eric",
      subject: "Herald shipped",
    });
    expect(commits[1].sha).toBe("4f907eb");
  });

  it("returns empty array when git log fails", async () => {
    const execGit = vi.fn(async () => {
      throw new Error("boom");
    });
    const commits = await getRecentSkillsCommits(20, {
      repoRoot: "/fake/repo",
      execGit,
    });
    expect(commits).toEqual([]);
  });

  it("memoizes within 60s", async () => {
    const stdout = `aaaaaaa\x1faaaaaaabbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\x1f2026-04-17T00:00:00Z\x1feric\x1ffirst\n`;
    const execGit = vi.fn(async () => stdout);

    const t0 = 2_000_000;
    await getRecentSkillsCommits(20, {
      repoRoot: "/fake/repo",
      execGit,
      now: () => t0,
    });
    const callsAfterFirst = execGit.mock.calls.length;

    await getRecentSkillsCommits(20, {
      repoRoot: "/fake/repo",
      execGit,
      now: () => t0 + 10_000,
    });
    expect(execGit.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe("groupCommitsByDay", () => {
  const mk = (iso: string, sha: string): SkillsCommit => ({
    sha,
    fullSha: sha.repeat(5).slice(0, 40),
    iso,
    author: "eric",
    subject: `work ${sha}`,
  });

  it("groups commits by YYYY-MM-DD preserving input order", () => {
    const input = [
      mk("2026-04-17T15:00:00Z", "aaa"),
      mk("2026-04-17T09:00:00Z", "bbb"),
      mk("2026-04-16T10:00:00Z", "ccc"),
      mk("2026-04-14T08:00:00Z", "ddd"),
    ];

    const out = groupCommitsByDay(input);
    expect(out.map((g) => g.day)).toEqual([
      "2026-04-17",
      "2026-04-16",
      "2026-04-14",
    ]);
    expect(out[0].commits.map((c) => c.sha)).toEqual(["aaa", "bbb"]);
    expect(out[1].commits.map((c) => c.sha)).toEqual(["ccc"]);
  });

  it("returns [] for empty input", () => {
    expect(groupCommitsByDay([])).toEqual([]);
  });

  it("handles a single commit", () => {
    const out = groupCommitsByDay([mk("2026-04-17T15:00:00Z", "aaa")]);
    expect(out).toEqual([
      { day: "2026-04-17", commits: [expect.objectContaining({ sha: "aaa" })] },
    ]);
  });
});
