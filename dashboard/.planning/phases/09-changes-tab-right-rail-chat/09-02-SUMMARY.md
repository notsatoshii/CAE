---
phase: 09-changes-tab-right-rail-chat
plan: 02
subsystem: backend
tags: [wave-1, aggregator, api, labels, parallel-with-09-03, changes-timeline, chat-labels]

# Dependency graph
requires:
  - phase: 04-build-home-rewrite
    provides: "agentMetaFor + founder_label (lib/copy/agent-meta.ts)"
  - phase: 09-changes-tab-right-rail-chat
    plan: 01
    provides: "AgentName + MODEL_BY_AGENT + docs/voices/ (unused here — next wave)"
provides:
  - "lib/cae-changes-state.ts — getChanges, getChangesGrouped, ChangeEvent, ProjectGroup, proseForEvent, relativeTime, plus the pure sub-helpers (parseMergeLine, parseBranchFromSubject, parseGithubUrl, commitUrlFor, dedupeBySha, joinCbEvents)"
  - "app/api/changes/route.ts — GET /api/changes, auth-gated, returns {projects, generated_at, cache_ttl_ms}"
  - "lib/copy/labels.ts — changes.* AND chat.* sections added in Labels interface + FOUNDER + DEV (three-way)"
affects: [09-04, 09-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Indirection over promisify(exec) via module-scope execAsync + __setExecAsyncForTest hook — bypasses jsdom's inability to spawn real /bin/sh in vitest, lets integration tests stub git-log output deterministically"
    - "30s result cache + per-project try/catch + cap-500 merges per project — mirrors the Phase 7 cae-metrics-state pattern"
    - "Three-way labels addition (interface + FOUNDER + DEV) with both changes.* and chat.* sections — lets Wave 2 (plan 09-04) and Wave 2b (plan 09-05) consume labels without editing this file"

key-files:
  created:
    - "dashboard/lib/cae-changes-state.ts"
    - "dashboard/lib/cae-changes-state.test.ts"
    - "dashboard/app/api/changes/route.ts"
  modified:
    - "dashboard/lib/copy/labels.ts"

key-decisions:
  - "Dedupe by sha, not by (project, sha) — subtree-merged repos (dashboard-as-subtree inside CAE) surface the same merge under two projects; first occurrence wins and the project shown is whichever listProjects() returned first (CAE_ROOT before dashboard/)"
  - "tokens field is null (not 0) when there is NO matching forge_end cb event — preserves the distinction between 'unknown cost' and 'known zero cost' for the Wave 2 UI"
  - "githubUrl null on non-github remotes AND on missing remote AND on git-command failure — no '#' fallback (gotcha #14)"
  - "relativeTime buckets evaluate on UTC components so tests stay deterministic regardless of runner TZ; weekday fallback covers 2-6 days, M/D for >=7 days"
  - "Per-merge commit list fetched via second execAsync (git log -n 20 SHA^..SHA) — best-effort, catches root-commit 'unknown revision' errors and falls back to [] so a bad merge doesn't drop the event"
  - "Test mocking uses __setExecAsyncForTest hook instead of vi.mock('child_process'): promisify(exec) captures the exec reference at module-init, and vitest's ESM mock replacement under jsdom doesn't propagate into the internal promisified closure — the explicit hook is reliable and readable"

patterns-established:
  - "ExecAsync substitution pattern: export an __setExecAsyncForTest(fn | null) from any lib that calls promisify(exec). Tests inject a controllable async fn; production callers see realExecAsync"
  - "proseForEvent is a pure function with no I/O — D-02 'zero LLM tokens per render' is statically enforceable"

requirements-completed: [CHG-01, CHG-03]

# Metrics
duration: 13min
completed: 2026-04-22
---

# Phase 9 Plan 02: Wave 1a — Changes aggregator + /api/changes + Phase-9 labels Summary

**Dual-source merge-timeline aggregator (`git log --all --merges` + `circuit-breakers.jsonl forge_end` joined by task_id) with SHA dedupe, zero-token prose templates, 30s cache, auth-gated GET route, and both `changes.*` + `chat.*` label sets added to `lib/copy/labels.ts` — 35 vitest assertions, tsc clean, build registers `/api/changes`.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-22T15:08:40Z (approx, from plan start)
- **Completed:** 2026-04-22T15:21:40Z
- **Tasks:** 3 / 3
- **Files created:** 3 (aggregator, test, route)
- **Files modified:** 1 (labels.ts)

## Accomplishments

- **Changes aggregator (D-01):** Walks `listProjects()`, runs `git log --all --merges --since="30 days ago" -n 500 --pretty=format:'%H|%h|%ci|%s|%an'` per project with `maxBuffer: 4 * 1024 * 1024`, parses each line, joins against `.cae/metrics/circuit-breakers.jsonl` `forge_end` events (by task_id extracted from branch name), dedupes by SHA across projects (subtree gotcha #2), sorts newest-first, caches for 30s. Per-project try/catch — one bad project doesn't poison the stream.
- **Pure sub-helpers (tested in isolation):** `parseMergeLine`, `parseBranchFromSubject`, `parseGithubUrl` (ssh + https variants, null on gitlab/bitbucket/empty/undefined), `commitUrlFor`, `dedupeBySha`, `joinCbEvents`, `relativeTime` (founder-speak buckets — just now / this morning|afternoon|evening / yesterday / weekday / M/D), `proseForEvent` (D-02 deterministic template, ZERO LLM tokens).
- **API route (CHG-01):** `GET /api/changes` auth-gated with `auth()` (401 on no session, mirrors memory routes), returns `{projects: ProjectGroup[], generated_at, cache_ttl_ms}`. No POST/PUT/DELETE. `export const dynamic = "force-dynamic"`. 500 on aggregator throw.
- **Labels three-way addition:** 17 new `changes.*` keys + 28 new `chat.*` keys added to the `Labels` interface, the `FOUNDER` object, and the `DEV` object. Each key appears exactly 3 times in `labels.ts`. `chat.*` keys are pre-seeded for Wave 2b (plan 09-05). No `$` literal anywhere — `scripts/lint-no-dollar.sh` PASS.
- **Test coverage:** 35 vitest assertions across 8 describe blocks — parseMergeLine (incl. pipe-in-subject defensive case), parseBranchFromSubject (forge happy, two-digit phase, non-forge, empty), parseGithubUrl (ssh, https, trailing slash, gitlab null, empty, undefined, bitbucket null), commitUrlFor (happy + null base), dedupeBySha (first-occurrence wins + empty), joinCbEvents (populate, null-on-miss, null-on-no-task, null-tokens-not-zero), relativeTime (all 7 buckets with fixed `now`), proseForEvent (known agent, null agent, zero commits), getChanges (integration: multi-project + subtree dedupe + forge_end join + URL derivation + bad-project isolation).

## Interface frozen (Wave 2 + 2b consume these)

### `ChangeEvent`

```ts
interface CommitRef {
  sha: string;
  shaShort: string;
  subject: string;
}

interface ChangeEvent {
  ts: string;                  // ISO8601 from %ci
  project: string;             // absolute path
  projectName: string;         // basename(project)
  sha: string;                 // full merge hash (%H)
  shaShort: string;            // %h
  mergeSubject: string;        // %s
  branch: string | null;       // "forge/p9-plA-t1-ab12cd" or null
  phase: string | null;        // "p9" or null
  task: string | null;         // "p9-plA-t1-ab12cd" or null
  githubUrl: string | null;    // ${base}/commit/${sha} or null
  agent: string | null;        // joined from forge_end cb event
  model: string | null;        // joined from forge_end cb event
  tokens: number | null;       // input+output from forge_end, null on no join (NOT 0)
  commits: CommitRef[];        // -n 20 SHA^..SHA
  prose: string;               // proseForEvent output (D-02)
}
```

### `ProjectGroup`

```ts
interface ProjectGroup {
  project: string;
  projectName: string;
  count: number;
  events: ChangeEvent[];       // newest first within the group
}
```

### API response

```ts
GET /api/changes
  → 401 on !auth()
  → 200 { projects: ProjectGroup[], generated_at: string, cache_ttl_ms: 30000 }
  → 500 { error: "changes_failed" } on aggregator throw
```

## parseBranchFromSubject regex

```ts
/Merge (forge\/p(\d+)-pl\w+-t\d+-[0-9a-f]+)/
```

Matches `Merge forge/p9-plA-t1-ab12cd (Sentinel-approved)` → group 1 = `forge/p9-plA-t1-ab12cd`, group 2 = `9`. Returns `{ branch, phase: "p9", task: "p9-plA-t1-ab12cd" }`. Non-matching subjects yield all-null.

## relativeTime bucket rules

All comparisons use UTC components on the timestamp.

| Condition | Return |
|-----------|--------|
| delta < 60_000 ms | `"just now"` |
| same UTC calendar day, UTC hour < 12 | `"this morning"` |
| same UTC calendar day, 12 ≤ UTC hour < 18 | `"this afternoon"` |
| same UTC calendar day, UTC hour ≥ 18 | `"this evening"` |
| 1 day earlier (UTC calendar) | `"yesterday"` |
| 2–6 day UTC delta | weekday name (Sunday–Saturday) |
| ≥ 7 day UTC delta (or future) | `"M/D"` using UTC month/date |

## proseForEvent template (D-02)

```
${founderLabel} shipped ${count} ${change|changes} to ${projectName} ${timeFrag}.
```

- `founderLabel = agentMetaFor(e.agent).founder_label` when `agent` set, else `"CAE"`.
- `count = e.commits.length`.
- `noun = "change"` iff `count === 1`, else `"changes"`.
- `timeFrag = relativeTime(e.ts, now)`.

Examples:

- `{agent: "forge", projectName: "cae-dashboard", commits: […3], ts: <morning>}`
  → `"the builder shipped 3 changes to cae-dashboard this morning."`
- `{agent: null, projectName: "lever", commits: […1], ts: <morning>}`
  → `"CAE shipped 1 change to lever this morning."`

Zero LLM tokens per render.

## `changes.*` label keys added

**Founder-speak (17 keys):**

| Key | Shape |
|-----|-------|
| changesPageHeading | `"What shipped"` |
| changesPageLede | `(n) => n === 0 ? "Nothing's shipped today — yet." : \`\${n} change(s) today.\`` |
| changesEmpty | `"Nothing's shipped in the last 30 days."` |
| changesFailedToLoad | `"Couldn't load the timeline. Try refreshing."` |
| changesProjectHeader | `(name, n) => \`\${name} · \${n} shipped\`` |
| changesDayToday | `"Today"` |
| changesDayYesterday | `"Yesterday"` |
| changesDayWeek | `(day) => day` |
| changesDevToggleLabel | `"technical"` |
| changesDevBranchLabel | `(b) => \`branch: \${b}\`` |
| changesDevShaLabel | `(s) => \`sha: \${s}\`` |
| changesDevAgentLabel | `(a, m) => m ? \`\${a} (\${m})\` : a` |
| changesDevTokensLabel | `(t) => \`\${t} tok\`` |
| changesDevGithubLabel | `"view on GitHub"` |
| changesDevCommitsHeading | `(n) => \`\${n} commit(s)\`` |
| changesExplainTimeline | `"Every time CAE ships something, it lands here — newest first, grouped by project."` |
| changesExplainDevToggle | `"Flip to see the raw git details: branch name, SHAs, commit subjects, GitHub link."` |

**Dev-speak:** same keys, tech-forward phrasing (`"Changes"` / `"no merges in 30d window"` / `"/api/changes failed"` / etc.). See `lib/copy/labels.ts` DEV block for exact strings.

## `chat.*` label keys added (consumed by Wave 2b plan 09-05)

28 keys total — rail aria, input, send/pending, suggestions heading, new-conversation button, empty thread, thinking indicator, rate-limited banner, unread aria, failed-to-load, session list (heading, empty, item), message roles, gate dialog (title, summary, cost, diff, accept, cancel), instant toast, undo toast, and three explain-mode blurbs. Both FOUNDER and DEV branches filled. No USD.

## Task Commits

Each task was committed atomically on the shared working tree (parallel with 09-03):

1. **Task 1: aggregator + 35-test TDD file** — `cbc1fa3` (feat)
2. **Task 2: /api/changes GET route** — `e5eeb4f` (feat)
3. **Task 3: changes.* + chat.* labels (3-way)** — `8c0124c` (feat)

## Decisions Made

- **execAsync substitution hook over vi.mock('child_process').** Spent one failing cycle trying `vi.mock` on child_process and `util.promisify` — both failed under jsdom because `promisify(exec)` captures the exec reference at module-init and Node's internals still spawn `/bin/sh`, which doesn't exist in the vitest worker. The `__setExecAsyncForTest` hook is explicit, typed, and trivially reversible (pass `null` to restore). Established as a reusable pattern for any future lib that calls `promisify(exec)` and needs vitest coverage.
- **tokens: null (not 0) when no forge_end match.** `joinCbEvents` leaves all three snake_case fields null unless the map hits. Unit test explicitly asserts `null` not `0`, so `cb.input_tokens === 0` + `cb.output_tokens === 0` still yields `tokens: 0`, distinguishing "unknown" from "known-zero".
- **Pre-seeded chat.\* keys in 09-02 instead of 09-05.** Planner owned labels.ts ownership per parallel-ownership rule; 09-05 will need the keys but should focus on components. Locking the copy here (both voices) also freezes the founder-speak tone before UI iteration.
- **Regex for branch parse anchors on the literal substring `Merge forge/…`.** Non-forge merges like `Merge pull request #42` correctly yield null. Accepts two-digit phase numbers (`p12-…`) via `\d+`, but keeps the task-id suffix rule (`t\d+-[0-9a-f]+`) tight so stray text doesn't false-match.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written. One vitest mocking path was revised in-session (vi.mock('child_process') → exec-hook substitution) but this was discovered by running the TDD-RED cycle and iterating on the mock strategy, not a deviation from plan scope.

### Deferred Items

None from 09-02's scope. Pre-existing working-tree items untouched (next.config.ts M, .planning/STATE.md M, .planning/ROADMAP.md M — orchestrator territory).

## Issues Encountered

- **vi.mock('child_process') + util.promisify interaction under jsdom.** Real `/bin/sh ENOENT` leaked through both `vi.mock('child_process', importOriginal)` and `vi.mock('util', importOriginal)` because `promisify(exec)` resolves synchronously at module-init and Node's internal child_process path still dispatches to `spawn('/bin/sh', …)`. Resolved by exporting `__setExecAsyncForTest` from the module and wiring it in `beforeEach`. Documented as a pattern in the decisions section.
- **Integration test's initial prose assertion was wrong.** Test stubbed project path `/a` and asserted `prose.toContain("to cae")` — but `toProjectName("/a") === "a"`, so the prose contained `"to a"`. Fixed in one line; not a Rule-1 bug in the implementation.

## Authentication Gates

None encountered. All work local.

## Self-Check: PASSED

**Files (4):**
- FOUND: dashboard/lib/cae-changes-state.ts
- FOUND: dashboard/lib/cae-changes-state.test.ts
- FOUND: dashboard/app/api/changes/route.ts
- FOUND: dashboard/lib/copy/labels.ts (modified — three Phase 9 sections added)

**Commits (3):**
- FOUND: cbc1fa3 (Task 1 — aggregator + tests)
- FOUND: e5eeb4f (Task 2 — /api/changes route)
- FOUND: 8c0124c (Task 3 — labels three-way)

**Verification sweeps:**
- `pnpm test lib/cae-changes-state.test.ts` → 35/35 passed
- `pnpm tsc --noEmit` → exit 0, no output
- `pnpm build` → `/api/changes` registered in route table, build completes
- `./scripts/lint-no-dollar.sh` → PASS
- Key-count check: `changesPageHeading` / `chatRailExpandedTitle` / `chatGateDialogTitle` / `changesDevToggleLabel` / `chatExplainGate` each appear exactly 3 times in labels.ts (interface + FOUNDER + DEV).

## Next Phase Readiness

**Ready for Wave 2 (09-04 + 09-05, parallel):**

- `09-04` (Changes UI) imports `ChangeEvent`, `ProjectGroup`, `relativeTime`, `proseForEvent` from `lib/cae-changes-state` and fetches `/api/changes`. All `changes.*` labels already in `labels.ts`.
- `09-05` (Chat UI) consumes `chat.*` labels (already in `labels.ts`) plus the 09-03 chat state/routes (parallel plan, independent files).

**Blockers:** None.

**Test suite note:** No regressions introduced. Pre-existing vitest failures in the repo (noted in 09-01-SUMMARY) are out of scope.

---
*Phase: 09-changes-tab-right-rail-chat*
*Completed: 2026-04-22*
