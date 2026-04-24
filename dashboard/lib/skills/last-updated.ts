/**
 * lib/skills/last-updated.ts — git-log-sourced "last updated" timestamps per skill.
 *
 * Source of truth: `git log -1 --format=%cI -- skills/<name>` from the repo root.
 * Cached server-side in-memory for 60 seconds so a page render doesn't shell out
 * per skill on every request.
 *
 * Used by:
 *   - /build/skills page: to decorate each SkillCard with a last-updated chip.
 *   - RecentEditsTimeline: to render last 20 commits touching any skills/ path.
 *
 * The helpers here are server-only (they shell out to git). Import from
 * server components and route handlers; never from "use client" files.
 */
import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const MEMO_TTL_MS = 60_000;

type MapEntry = {
  value: Record<string, string | null>;
  fetchedAt: number;
};

type CommitEntry = {
  value: SkillsCommit[];
  fetchedAt: number;
};

export interface SkillsCommit {
  /** 7-char short SHA */
  sha: string;
  /** Full 40-char SHA */
  fullSha: string;
  /** ISO 8601 committer date, e.g. "2026-04-17T02:40:37+09:00" */
  iso: string;
  /** Commit subject (first line) */
  subject: string;
  /** Author name */
  author: string;
}

// Keyed by repoRoot+skillsDir so tests with different dirs don't collide.
const _mapMemo = new Map<string, MapEntry>();
const _commitsMemo = new Map<string, CommitEntry>();

/**
 * Resolve the git repo root from the dashboard cwd. Cached after first call.
 *
 * Falls back to the known CAE repo root if `git rev-parse` fails (e.g. in tests
 * where cwd is elsewhere but we don't want to crash).
 */
let _repoRootCache: string | null = null;
export async function getRepoRoot(): Promise<string> {
  if (_repoRootCache) return _repoRootCache;
  try {
    const { stdout } = await execFileP("git", ["rev-parse", "--show-toplevel"], {
      cwd: process.cwd(),
      timeout: 5_000,
    });
    _repoRootCache = stdout.trim();
  } catch {
    _repoRootCache = path.resolve(process.cwd(), "..");
  }
  return _repoRootCache;
}

/** Test-only: reset memo + repo-root cache so each test runs cleanly. */
export function __resetLastUpdatedMemoForTests(): void {
  _mapMemo.clear();
  _commitsMemo.clear();
  _repoRootCache = null;
}

export interface LastUpdatedOpts {
  /** Absolute path to the repo root — defaults to `git rev-parse --show-toplevel`. */
  repoRoot?: string;
  /** Skills subdirectory under repoRoot (relative). Defaults to "skills". */
  skillsSubdir?: string;
  /** Override the git executor — for mocking in tests. */
  execGit?: (args: string[], cwd: string) => Promise<string>;
  /** Override the directory-read used to enumerate skill folders — for tests. */
  readSkillsDir?: (abs: string) => string[];
  /** Override the "now" clock used for memo TTL — for tests. */
  now?: () => number;
}

async function defaultExecGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileP("git", args, { cwd, timeout: 5_000 });
  return stdout;
}

function defaultReadSkillsDir(abs: string): string[] {
  try {
    return fs
      .readdirSync(abs, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/**
 * Returns a map of `<skill-name> → ISO timestamp of the last commit that
 * touched that skill's directory`, or `null` for skills with no git history.
 *
 * Memoized for 60s per (repoRoot, skillsSubdir) pair.
 */
export async function getSkillsLastUpdatedMap(
  opts: LastUpdatedOpts = {}
): Promise<Record<string, string | null>> {
  const skillsSubdir = opts.skillsSubdir ?? "skills";
  const repoRoot = opts.repoRoot ?? (await getRepoRoot());
  const execGit = opts.execGit ?? defaultExecGit;
  const readSkillsDir = opts.readSkillsDir ?? defaultReadSkillsDir;
  const now = opts.now ?? Date.now;

  const cacheKey = `${repoRoot}::${skillsSubdir}`;
  const cached = _mapMemo.get(cacheKey);
  if (cached && now() - cached.fetchedAt < MEMO_TTL_MS) {
    return cached.value;
  }

  const skillsAbs = path.join(repoRoot, skillsSubdir);
  const names = readSkillsDir(skillsAbs);

  const out: Record<string, string | null> = {};
  await Promise.all(
    names.map(async (name) => {
      const relPath = `${skillsSubdir}/${name}`;
      try {
        const stdout = await execGit(
          ["log", "-1", "--format=%cI", "--", relPath],
          repoRoot
        );
        const iso = stdout.trim();
        out[name] = iso.length > 0 ? iso : null;
      } catch {
        out[name] = null;
      }
    })
  );

  _mapMemo.set(cacheKey, { value: out, fetchedAt: now() });
  return out;
}

/** Convenience: single-skill lookup. Consumes the same memoized map. */
export async function getSkillLastUpdated(
  name: string,
  opts: LastUpdatedOpts = {}
): Promise<string | null> {
  const map = await getSkillsLastUpdatedMap(opts);
  return map[name] ?? null;
}

/**
 * Returns the last N commits touching any path under `skills/`. Union of all
 * skill dirs — used by the "Recent edits" timeline panel.
 *
 * Format: --format="%h%x1f%H%x1f%cI%x1f%an%x1f%s" (1F = field sep, avoids
 * collisions with tab/pipe in commit subjects).
 */
export async function getRecentSkillsCommits(
  limit: number = 20,
  opts: LastUpdatedOpts = {}
): Promise<SkillsCommit[]> {
  const skillsSubdir = opts.skillsSubdir ?? "skills";
  const repoRoot = opts.repoRoot ?? (await getRepoRoot());
  const execGit = opts.execGit ?? defaultExecGit;
  const now = opts.now ?? Date.now;

  const cacheKey = `${repoRoot}::${skillsSubdir}::commits::${limit}`;
  const cached = _commitsMemo.get(cacheKey);
  if (cached && now() - cached.fetchedAt < MEMO_TTL_MS) {
    return cached.value;
  }

  let stdout = "";
  try {
    stdout = await execGit(
      [
        "log",
        `-${limit}`,
        "--format=%h%x1f%H%x1f%cI%x1f%an%x1f%s",
        "--",
        skillsSubdir,
      ],
      repoRoot
    );
  } catch {
    _commitsMemo.set(cacheKey, { value: [], fetchedAt: now() });
    return [];
  }

  const commits: SkillsCommit[] = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [sha, fullSha, iso, author, subject] = line.split("\x1f");
      return {
        sha: sha ?? "",
        fullSha: fullSha ?? "",
        iso: iso ?? "",
        author: author ?? "",
        subject: subject ?? "",
      };
    })
    .filter((c) => c.sha.length > 0 && c.iso.length > 0);

  _commitsMemo.set(cacheKey, { value: commits, fetchedAt: now() });
  return commits;
}

/**
 * Groups a list of commits by YYYY-MM-DD of their committer date.
 * Preserves input order within each day group (git log is already
 * reverse-chronological).
 *
 * Returns an array of `{ day, commits }` so consumers render in the order
 * git emitted them (newest day first).
 */
export function groupCommitsByDay(
  commits: SkillsCommit[]
): Array<{ day: string; commits: SkillsCommit[] }> {
  const map = new Map<string, SkillsCommit[]>();
  const order: string[] = [];
  for (const c of commits) {
    // ISO 8601 starts with YYYY-MM-DD; safe to slice.
    const day = c.iso.slice(0, 10);
    const existing = map.get(day);
    if (existing) {
      existing.push(c);
    } else {
      map.set(day, [c]);
      order.push(day);
    }
  }
  return order.map((day) => ({ day, commits: map.get(day)! }));
}
