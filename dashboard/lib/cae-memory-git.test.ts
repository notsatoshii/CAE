import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

// Stub the allowlist to point at the per-test temp repo.
vi.mock("./cae-memory-sources", async (orig) => {
  const actual = (await orig()) as typeof import("./cae-memory-sources");
  return {
    ...actual,
    getAllowedRoots: vi.fn(),
  };
});

import {
  gitLogForFile,
  gitDiff,
  __setExecFileForTests,
} from "./cae-memory-git";
import { getAllowedRoots } from "./cae-memory-sources";

let tmp: string;

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  }).toString();
}

function makeRepo(): { root: string; agentsAbs: string; shas: string[] } {
  const root = mkdtempSync(join(tmpdir(), "memgit-"));
  runGit(root, ["init", "-q", "-b", "main"]);
  runGit(root, ["config", "commit.gpgsign", "false"]);
  runGit(root, ["config", "user.email", "test@example.com"]);
  runGit(root, ["config", "user.name", "Test"]);

  const agentsPath = join(root, "AGENTS.md");
  const shas: string[] = [];

  writeFileSync(agentsPath, "# AGENTS v1\n");
  runGit(root, ["add", "AGENTS.md"]);
  runGit(root, ["commit", "-q", "-m", "initial agents"]);
  shas.push(runGit(root, ["rev-parse", "HEAD"]).trim());

  writeFileSync(agentsPath, "# AGENTS v2\n\n- added guidance\n");
  runGit(root, ["commit", "-q", "-am", "expand agents"]);
  shas.push(runGit(root, ["rev-parse", "HEAD"]).trim());

  writeFileSync(agentsPath, "# AGENTS v3\n\n- guidance\n- more\n");
  runGit(root, ["commit", "-q", "-am", "more guidance"]);
  shas.push(runGit(root, ["rev-parse", "HEAD"]).trim());

  return { root, agentsAbs: agentsPath, shas };
}

describe("cae-memory-git (integration, temp repo)", () => {
  let repo: { root: string; agentsAbs: string; shas: string[] };

  beforeEach(() => {
    repo = makeRepo();
    (getAllowedRoots as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      repo.root,
    ]);
    __setExecFileForTests(null); // use real git
  });

  afterAll(() => {
    if (tmp) {
      try {
        rmSync(tmp, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    }
  });

  it("gitLogForFile returns 3 entries with sha/ts/author/subject", async () => {
    const entries = await gitLogForFile(repo.root, repo.agentsAbs);
    expect(entries).toHaveLength(3);
    expect(entries[0].sha).toMatch(/^[0-9a-f]{40}$/);
    expect(entries[0].author).toBe("Test");
    expect(entries[0].subject).toMatch(/guidance/i);
    expect(entries[0].ts).toBeGreaterThan(0);
    // Most recent first.
    expect(entries[0].sha).toBe(repo.shas[2]);
    expect(entries[2].sha).toBe(repo.shas[0]);
  });

  it("gitLogForFile rejects non-memory-source files via allowlist check", async () => {
    // README.md is not a memory source (AGENTS.md is).
    const readmePath = join(repo.root, "README.md");
    writeFileSync(readmePath, "# readme");
    runGit(repo.root, ["add", "README.md"]);
    runGit(repo.root, ["commit", "-q", "-m", "readme"]);
    await expect(gitLogForFile(repo.root, readmePath)).rejects.toThrow(
      /memory source/i,
    );
  });

  it("gitLogForFile throws when project root is not allowlisted", async () => {
    (getAllowedRoots as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/some/other/root",
    ]);
    await expect(
      gitLogForFile(repo.root, repo.agentsAbs),
    ).rejects.toThrow(/allowlist/i);
  });

  it("gitDiff between two real shas returns a non-empty diff", async () => {
    const diff = await gitDiff(
      repo.root,
      repo.shas[0],
      repo.shas[1],
      repo.agentsAbs,
    );
    expect(diff.length).toBeGreaterThan(0);
    expect(diff).toMatch(/AGENTS v1/);
    expect(diff).toMatch(/AGENTS v2/);
    expect(diff).toMatch(/^diff --git/m);
  });

  it("gitDiff rejects malformed sha", async () => {
    await expect(
      gitDiff(repo.root, "not-a-sha", repo.shas[1], repo.agentsAbs),
    ).rejects.toThrow(/invalid sha/i);
    await expect(
      gitDiff(repo.root, repo.shas[0], "zz0011", repo.agentsAbs),
    ).rejects.toThrow(/invalid sha/i);
  });
});
