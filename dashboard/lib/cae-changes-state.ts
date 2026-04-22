/**
 * Phase 9 Plan 02 — Changes timeline aggregator.
 *
 * Reads `git log --all --merges --since='30 days ago'` across every project
 * returned by `listProjects()` and joins each merge-commit against the
 * per-project `.cae/metrics/circuit-breakers.jsonl` `forge_end` events using
 * the task_id embedded in the branch name (`forge/p{N}-pl{letter}-t{id}-{hex}`).
 *
 * Design contract (09-02-PLAN.md must_haves):
 *   1. Dual source: git-log merges (primary) + circuit-breakers.jsonl forge_end
 *      (supplement). Non-forge merges are kept but have null branch/phase/task.
 *   2. Dedupe by SHA across projects (subtree-merged repos surface the same
 *      commit twice — gotcha #2).
 *   3. Graceful per-project try/catch — one bad project must not poison the
 *      aggregated stream (mirrors cae-metrics-state.ts).
 *   4. GitHub URL derivation via `git config --get remote.origin.url`. Null on
 *      no-remote or non-github (gotcha #14 — no `#` fallback).
 *   5. Deterministic prose template — ZERO LLM tokens per render (D-02).
 *   6. 30s in-process cache.
 *   7. Cap per project at 500 merges. maxBuffer: 4 * 1024 * 1024.
 *
 * Ground truth references:
 *   - 09-CONTEXT.md §D-01 (data source), §D-02 (prose), §Gotchas 1, 2, 14
 *   - lib/cae-home-state.ts (listProjects iteration, execAsync pattern,
 *     try/catch-per-project invariant, CbEvent reader style)
 *   - lib/cae-metrics-state.ts (30s cache shape)
 */

import { exec } from "child_process";
import { promisify } from "util";
import { basename, join } from "path";
import { listProjects, tailJsonl } from "./cae-state";
import { agentMetaFor } from "./copy/agent-meta";
import type { CbEvent, Project } from "./cae-types";
import { log } from "./log";

const lChanges = log("cae-changes-state");

/**
 * Indirection over `promisify(exec)` so tests can substitute a stub without
 * spawning real `/bin/sh` (jsdom env). Production: real shell-backed exec.
 */
type ExecResult = { stdout: string; stderr: string };
type ExecAsync = (cmd: string, opts?: { cwd?: string; maxBuffer?: number }) => Promise<ExecResult>;

const realExecAsync = promisify(exec) as unknown as ExecAsync;
let execAsync: ExecAsync = realExecAsync;

/** Test-only hook — substitute the exec shim. Pass `null` to reset. */
export function __setExecAsyncForTest(fn: ExecAsync | null): void {
  execAsync = fn ?? realExecAsync;
}

// === Constants ===

const CACHE_TTL_MS = 30_000;
const PER_PROJECT_CAP = 500;
const SINCE = "30 days ago";
const GIT_MAX_BUFFER = 4 * 1024 * 1024;
const COMMIT_MAX_BUFFER = 1 * 1024 * 1024;

// === Types (freeze — Wave 2 UI consumes these via /api/changes) ===

export interface CommitRef {
  sha: string;
  shaShort: string;
  subject: string;
}

export interface ChangeEvent {
  ts: string;
  project: string;
  projectName: string;
  sha: string;
  shaShort: string;
  mergeSubject: string;
  branch: string | null;
  phase: string | null;
  task: string | null;
  githubUrl: string | null;
  agent: string | null;
  model: string | null;
  tokens: number | null;
  commits: CommitRef[];
  prose: string;
}

export interface ProjectGroup {
  project: string;
  projectName: string;
  count: number;
  events: ChangeEvent[];
}

// === Pure helpers (exported for unit tests) ===

export function toProjectName(projectPath: string): string {
  return basename(projectPath.replace(/\/+$/, ""));
}

/**
 * Split a `%H|%h|%ci|%s|%an` git-log line. The subject field can contain
 * literal `|` characters (commit messages with pipe-separated tags), so we
 * take the first three pipe-delimited fields and the LAST one, then rejoin
 * the middle as the subject.
 */
export function parseMergeLine(line: string): {
  sha: string;
  shaShort: string;
  ts: string;
  subject: string;
  author: string;
} | null {
  if (!line) return null;
  const parts = line.split("|");
  if (parts.length < 5) return null;
  const sha = parts[0];
  const shaShort = parts[1];
  const ts = parts[2];
  const author = parts[parts.length - 1];
  const subject = parts.slice(3, parts.length - 1).join("|");
  if (!sha || !shaShort || !ts) return null;
  return { sha, shaShort, ts, subject, author };
}

/**
 * Parse a forge-style merge subject into branch/phase/task tuple.
 * Pattern: `Merge forge/p{N}-pl{letter(s)}-t{id}-{hex}` — anchor at start of
 * the branch token.
 *
 * Example: `Merge forge/p9-plA-t1-ab12cd (Sentinel-approved)` →
 *   { branch: "forge/p9-plA-t1-ab12cd", phase: "p9", task: "p9-plA-t1-ab12cd" }
 *
 * Non-matching subjects (GitHub PR merges, manual merges) → all-null tuple.
 */
export function parseBranchFromSubject(subject: string): {
  branch: string | null;
  phase: string | null;
  task: string | null;
} {
  if (!subject) return { branch: null, phase: null, task: null };
  const m = subject.match(/Merge (forge\/p(\d+)-pl\w+-t\d+-[0-9a-f]+)/);
  if (!m) return { branch: null, phase: null, task: null };
  const branch = m[1];
  const phase = `p${m[2]}`;
  const task = branch.replace(/^forge\//, "");
  return { branch, phase, task };
}

/**
 * Parse a git remote URL into `https://github.com/owner/repo`.
 * Accepts:
 *   - `git@github.com:OWNER/REPO(.git)?`
 *   - `https://github.com/OWNER/REPO(.git)?/?`
 * Returns null for any other form (gitlab, bitbucket, file://, empty, etc.).
 *
 * Gotcha #14: graceful null — NEVER return `#` or similar sentinel so the UI
 * can render "no link" cleanly instead of a dead anchor.
 */
export function parseGithubUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const ssh = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?\/?$/);
  if (ssh) return `https://github.com/${ssh[1]}/${ssh[2]}`;
  const https = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/);
  if (https) return `https://github.com/${https[1]}/${https[2]}`;
  return null;
}

export function commitUrlFor(base: string | null, sha: string): string | null {
  if (!base) return null;
  return `${base}/commit/${sha}`;
}

/**
 * Best-effort github URL derivation for a project directory.
 * Returns null on non-github, missing remote, or command failure.
 */
async function resolveGithubUrlBase(projectPath: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync("git config --get remote.origin.url", {
      cwd: projectPath,
    });
    return parseGithubUrl(stdout);
  } catch {
    return null;
  }
}

/**
 * Same-day hour-of-day buckets operate on UTC-indexed hours so that test
 * assertions stay deterministic across TZ settings. Founder-speak fragments
 * per D-02.
 *
 * Buckets:
 *   - <60s ago              → "just now"
 *   - same calendar day:
 *       hour < 12           → "this morning"
 *       12 <= hour < 18     → "this afternoon"
 *       hour >= 18          → "this evening"
 *   - prior calendar day    → "yesterday"
 *   - 2-6 days prior        → weekday name ("Saturday")
 *   - >= 7 days prior       → M/D (e.g. "4/10")
 */
export function relativeTime(isoTs: string, now: Date = new Date()): string {
  const tsMs = Date.parse(isoTs);
  if (!Number.isFinite(tsMs)) return "";
  const deltaMs = now.getTime() - tsMs;

  if (deltaMs >= 0 && deltaMs < 60_000) return "just now";

  // Day comparison on UTC components keeps buckets TZ-deterministic.
  const ts = new Date(tsMs);
  const sameDay =
    ts.getUTCFullYear() === now.getUTCFullYear() &&
    ts.getUTCMonth() === now.getUTCMonth() &&
    ts.getUTCDate() === now.getUTCDate();

  if (sameDay) {
    const h = ts.getUTCHours();
    if (h < 12) return "this morning";
    if (h < 18) return "this afternoon";
    return "this evening";
  }

  // Same year + month + date() - 1
  const yesterday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
  if (
    ts.getUTCFullYear() === yesterday.getUTCFullYear() &&
    ts.getUTCMonth() === yesterday.getUTCMonth() &&
    ts.getUTCDate() === yesterday.getUTCDate()
  ) {
    return "yesterday";
  }

  const dayDeltaMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
    Date.UTC(ts.getUTCFullYear(), ts.getUTCMonth(), ts.getUTCDate());
  const dayDelta = Math.round(dayDeltaMs / 86_400_000);

  if (dayDelta >= 2 && dayDelta <= 6) {
    // Weekday name — UTC to match the bucket math above.
    const weekdays = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return weekdays[ts.getUTCDay()];
  }

  // >= 7 days prior (or future) — M/D UTC.
  return `${ts.getUTCMonth() + 1}/${ts.getUTCDate()}`;
}

/**
 * Deterministic prose template (D-02). ZERO LLM tokens.
 *
 * Shape: `${founderLabel} shipped ${count} ${change|changes} to ${projectName} ${timeFrag}.`
 *
 * Examples:
 *   - forge + 3 commits + cae-dashboard + morning
 *     → "the builder shipped 3 changes to cae-dashboard this morning."
 *   - null agent + 1 commit + lever + yesterday
 *     → "CAE shipped 1 change to lever yesterday."
 */
export function proseForEvent(
  e: Pick<ChangeEvent, "agent" | "projectName" | "commits" | "ts">,
  now: Date = new Date(),
): string {
  const who = e.agent ? agentMetaFor(e.agent).founder_label : "CAE";
  const count = e.commits.length;
  const noun = count === 1 ? "change" : "changes";
  const timeFrag = relativeTime(e.ts, now);
  return `${who} shipped ${count} ${noun} to ${e.projectName} ${timeFrag}.`;
}

/** Keep the first occurrence of each sha; preserves input order otherwise. */
export function dedupeBySha(events: ChangeEvent[]): ChangeEvent[] {
  const seen = new Set<string>();
  const out: ChangeEvent[] = [];
  for (const e of events) {
    if (seen.has(e.sha)) continue;
    seen.add(e.sha);
    out.push(e);
  }
  return out;
}

/**
 * Mutate events in-place, populating agent/model/tokens from a task_id →
 * CbEvent lookup. Events without a task, or with a task not present in the
 * map, are left with null fields (NOT zero — per must_haves bullet 8).
 */
export function joinCbEvents(
  events: ChangeEvent[],
  cbByTaskId: Map<string, Pick<CbEvent, "agent" | "model" | "input_tokens" | "output_tokens">>,
): void {
  for (const e of events) {
    if (!e.task) continue;
    const cb = cbByTaskId.get(e.task);
    if (!cb) continue;
    if (typeof cb.agent === "string" && cb.agent) e.agent = cb.agent;
    if (typeof cb.model === "string" && cb.model) e.model = cb.model;
    const hasTokens =
      typeof cb.input_tokens === "number" || typeof cb.output_tokens === "number";
    if (hasTokens) {
      e.tokens = (cb.input_tokens ?? 0) + (cb.output_tokens ?? 0);
    }
  }
}

// === Per-project reader ===

async function readChangesForProject(p: Project): Promise<ChangeEvent[]> {
  try {
    const { stdout } = await execAsync(
      `git log --all --merges --since="${SINCE}" -n ${PER_PROJECT_CAP} --pretty=format:'%H|%h|%ci|%s|%an'`,
      { cwd: p.path, maxBuffer: GIT_MAX_BUFFER },
    );
    const parsed = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map(parseMergeLine)
      .filter((m): m is NonNullable<ReturnType<typeof parseMergeLine>> => m !== null);

    const ghBase = await resolveGithubUrlBase(p.path);
    const projectName = toProjectName(p.path);

    // Build a task_id → forge_end CbEvent map for this project. Latest wins.
    const cbPath = join(p.path, ".cae", "metrics", "circuit-breakers.jsonl");
    const cbEntries = await tailJsonl(cbPath, 5000).catch(() => [] as unknown[]);
    const cbByTaskId = new Map<
      string,
      Pick<CbEvent, "agent" | "model" | "input_tokens" | "output_tokens">
    >();
    for (const raw of cbEntries) {
      if (typeof raw !== "object" || raw === null) continue;
      const e = raw as CbEvent;
      if (e.event !== "forge_end" || !e.task_id) continue;
      cbByTaskId.set(e.task_id, {
        agent: e.agent,
        model: e.model,
        input_tokens: e.input_tokens,
        output_tokens: e.output_tokens,
      });
    }

    const out: ChangeEvent[] = [];
    for (const m of parsed) {
      const { branch, phase, task } = parseBranchFromSubject(m.subject);

      // Per-merge commit list — best-effort, bounded.
      let commits: CommitRef[] = [];
      try {
        const { stdout: cstdout } = await execAsync(
          `git log --pretty=format:'%H|%h|%s' -n 20 ${m.sha}^..${m.sha}`,
          { cwd: p.path, maxBuffer: COMMIT_MAX_BUFFER },
        );
        commits = cstdout
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const [sha, shaShort, ...rest] = l.split("|");
            return { sha, shaShort, subject: rest.join("|") };
          });
      } catch {
        // Root commits have no parent ref → commits stay [].
      }

      const ev: ChangeEvent = {
        ts: m.ts,
        project: p.path,
        projectName,
        sha: m.sha,
        shaShort: m.shaShort,
        mergeSubject: m.subject,
        branch,
        phase,
        task,
        githubUrl: commitUrlFor(ghBase, m.sha),
        agent: null,
        model: null,
        tokens: null,
        commits,
        prose: "",
      };
      out.push(ev);
    }

    joinCbEvents(out, cbByTaskId);
    for (const ev of out) {
      ev.prose = proseForEvent(ev);
    }
    return out;
  } catch (err) {
    lChanges.error({ err, project: p.name }, "project changes aggregation failed");
    return [];
  }
}

// === Main aggregator + 30s cache ===

let CACHE: { ts: number; value: ChangeEvent[] } | null = null;

/** Test-only cache reset — imported by vitest to isolate cases. */
export function __resetChangesCacheForTest(): void {
  CACHE = null;
}

export async function getChanges(): Promise<ChangeEvent[]> {
  const now = Date.now();
  if (CACHE && now - CACHE.ts < CACHE_TTL_MS) return CACHE.value;

  const projects = await listProjects();
  const perProject = await Promise.all(projects.map(readChangesForProject));
  const flat = perProject.flat();
  const deduped = dedupeBySha(flat);
  deduped.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));

  CACHE = { ts: now, value: deduped };
  return deduped;
}

export async function getChangesGrouped(): Promise<ProjectGroup[]> {
  const all = await getChanges();
  const map = new Map<string, ProjectGroup>();
  for (const e of all) {
    const g = map.get(e.project);
    if (g) {
      g.events.push(e);
      g.count++;
      continue;
    }
    map.set(e.project, {
      project: e.project,
      projectName: e.projectName,
      count: 1,
      events: [e],
    });
  }
  // Groups sorted by their most-recent event ts descending. Events within
  // each group are already newest-first because `all` is sorted.
  return Array.from(map.values()).sort((a, b) =>
    a.events[0].ts < b.events[0].ts ? 1 : a.events[0].ts > b.events[0].ts ? -1 : 0,
  );
}
