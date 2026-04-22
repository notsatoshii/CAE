# Phase 8: Memory + Graphify — Context (locked decisions)

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Source:** UI-SPEC.md §9 + §S4.5 + §Audience reframe + 08-RESEARCH.md + user upgrade 2026-04-22 ("Why? = REAL, not heuristic-only")
**Primary users:** non-dev founders (Explain-mode default ON, Dev-mode opt-in ⌘Shift+D)

## Phase Boundary

Ship `/memory` as a single page with two tabs (Browse / Graph), a per-file git timeline drawer, and a "Why?" drawer that traces which memory entries CAE actually read during a given task. Graph data comes from `safishamsi/graphify` writing `{CAE_ROOT}/.cae/graph.json`; render is NATIVE react-flow (no iframe). The "Why?" trace is EVENT-DRIVEN via a Claude Code PostToolUse hook on the `Read` tool, with a clearly-labeled heuristic fallback for pre-hook / legacy tasks.

**In scope (Phase 8):**
- Wave 0: prereqs — `pip install graphifyy`, new npm deps (`@xyflow/react`, `@dagrejs/dagre`, `react-markdown`, `remark-gfm`), Vitest install + `vitest.config.ts` + `"test": "vitest run"` script, fixture graphify run against a small repo to confirm JSON shape, relocate `components/metrics/explain-tooltip.tsx` → `components/ui/explain-tooltip.tsx` with Phase-7 import updates, add `.cae/` to `/home/cae/ctrl-alt-elite/.gitignore`.
- Wave 1: memory-consult event plumbing — `/home/cae/ctrl-alt-elite/tools/memory-consult-hook.sh` script, `/home/cae/ctrl-alt-elite/.claude/settings.json` PostToolUse registration, `adapters/claude-code.sh` exports `CAE_TASK_ID` before spawning the inner claude command, `dashboard/lib/cae-memory-consult.ts` aggregator, `dashboard/app/api/memory/consult/[task_id]/route.ts`.
- Wave 2: server modules + core API routes — `lib/cae-memory-sources.ts`, `lib/cae-graph-state.ts`, `lib/cae-memory-git.ts`, `lib/cae-memory-whytrace.ts`; routes `/api/memory/tree`, `/api/memory/search`, `/api/memory/file/[...path]`, `/api/memory/graph`, `/api/memory/regenerate`, `/api/memory/git-log/[...path]`, `/api/memory/diff`; labels.ts `memory.*` keys.
- Wave 3: Browse tab client island — file tree + markdown viewer + search bar + search results (parallel-safe with Wave 4; zero file overlap).
- Wave 4: Graph tab client island — react-flow canvas with dagre layout + filter chips + node drawer + Regenerate button (parallel-safe with Wave 3).
- Wave 5: "Why?" drawer (REAL trace via Wave 1 API + heuristic fallback) + git-timeline drawer + diff viewer.
- Wave 6: `/memory/page.tsx` shell + `MemoryClient` + base-ui Tabs + Explain tooltips everywhere + provider wiring.
- Wave 7: 08-VERIFICATION.md (vitest green + lint-no-dollar scope unchanged + live hook end-to-end smoke) + human UAT.

**Out of scope (explicit):**
- Cron-based auto-regeneration (deferred to Phase 12 polish).
- Graph edit/mutation UI (memory is read-only — edits happen via agents).
- Per-project graph sharding (single global `.cae/graph.json` v1).
- Commit nodes in graph (deferred v1 per D-04).
- Changes tab / chat rail (Phase 9).
- Plan mode routes (Phase 10).
- Mobile layout (deferred per UI-SPEC §15).

---

## Locked Decisions (non-negotiable; cite by D-XX in task actions)

### D-01 — Graph file location: `{CAE_ROOT}/.cae/graph.json` (single global)
One file, at `/home/cae/ctrl-alt-elite/.cae/graph.json`. Matches the existing `.cae/metrics/*.jsonl` convention. Gitignored at the CAE root (Wave 0 adds `.cae/` to `/home/cae/ctrl-alt-elite/.gitignore`; the dashboard-local `.gitignore` already excludes `.cae/`). Server code uses `CAE_ROOT` from `lib/cae-config.ts` as the source of truth.

### D-02 — Graphify install: `pip install graphifyy`; run with `--mode fast --no-viz`
Wave 0 documents the install. The dashboard spawns graphify via `execFile("graphify", [".", "--mode", "fast", "--no-viz", "--update"], { cwd: CAE_ROOT, timeout: 120_000 })`. `--mode fast` is AST-only (zero Claude-key requirement + zero token cost); we deliberately give up semantic edges in v1 to keep regen free and deterministic. `--no-viz` skips the HTML viz graphify defaults to emitting. After graphify exits, server code reads `{CAE_ROOT}/graphify-out/graph.json` and moves it atomically to `{CAE_ROOT}/.cae/graph.json`.

### D-03 — "Why?" = REAL via Claude Code PostToolUse hook (UPGRADED)
Previously scoped as heuristic-only. Upgraded by user on 2026-04-22: real ground-truth trace is the MVP, heuristic is fallback only.

**Hook location:** `/home/cae/ctrl-alt-elite/.claude/settings.json` → `hooks.PostToolUse` matcher `Read`. Hook script at `/home/cae/ctrl-alt-elite/tools/memory-consult-hook.sh` (new).

**Hook behavior:** reads JSON from stdin (Claude Code's PostToolUse payload), extracts `tool_input.file_path`, verifies it resolves inside one of the known memory-source globs (see D-10), and appends one line to `{cwd}/.cae/metrics/memory-consult.jsonl` of the form:
```json
{"ts":"2026-04-22T12:34:56Z","task_id":"p8-plC-t1-abc123","source_path":"/home/cae/ctrl-alt-elite/AGENTS.md","event":"memory_consult"}
```
- `ts` = `date -u +%Y-%m-%dT%H:%M:%SZ`
- `task_id` = `$CAE_TASK_ID` if set, else `$CLAUDE_SESSION_ID`, else `"unknown"`
- `source_path` = resolved absolute path of the file that was read
- `event` = constant `"memory_consult"`

**Hook safety rules (MUST):**
1. Hook script exits 0 on ANY internal error — it never fails the caller. All errors are swallowed (`|| true`) and logged to stderr only.
2. Hook has its own hard timeout (`timeout 2s ...` at the top or a wall-clock guard). A slow hook must never block the agent.
3. Path validation: only log when `file_path` is absolute AND resolves inside one of the memory-source globs (prevents `/etc/passwd` noise, `/tmp/...` noise, etc.). Reject with silent exit 0 otherwise.
4. JSONL writes use `flock` (or `(flock 200; ...) 200>>file`) to prevent torn lines under parallel Reads. If `flock` is unavailable, fall back to `>> file` atomic-append (POSIX guarantees `O_APPEND` on single-line writes ≤ PIPE_BUF ~= 4KB).
5. Never create `.cae/metrics/` — its presence is the opt-in signal. If the dir doesn't exist under the project root, silently exit 0.

**Adapter wiring:** `adapters/claude-code.sh` exports `CAE_TASK_ID="$TASK_ID"` (computed the same way as Phase 7 Wave 0 — `basename $TASK_FILE` minus `.txt`/`.md`) before building `INNER_CMD`, so the env var is inherited by the tmux pane and then by the spawned `claude` subprocess, and therefore visible to the hook.

**Dashboard aggregator:** `lib/cae-memory-consult.ts` walks every project returned by `listProjects()`, reads each `.cae/metrics/memory-consult.jsonl` via `tailJsonl`, groups events by `task_id`, and returns `{ task_id, entries: Array<{ source_path, ts }> }`. API route `/api/memory/consult/[task_id]` proxies this.

**Heuristic fallback:** if a task has ZERO rows in any `memory-consult.jsonl` (pre-hook / legacy task), the "Why?" drawer falls back to the intersection of `task.files_modified` ∩ `memory_source_paths` and renders an explicit pill labelled `"Heuristic — no trace captured"`. Real traces render with a pill labelled `"Live trace"`. Both labels are dev-mode-flippable.

### D-04 — Commit nodes OFF in graph v1
Graphify's `fast` mode yields AST-derived file nodes only; we do not add virtual commit nodes. The classify function returns one of `phases | agents | notes | PRDs` (four kinds, not five). If a node classifies to `commits`, it's dropped before return. Filter chip set = 4, not 5.

### D-05 — Node cap: 500 + pagination warning banner
Render budget cap at 500 nodes. If `graph.json` contains more, render the FIRST 500 (alphabetical by id) and show a banner: `"Showing 500 of N nodes — narrow your filter to see more"`. No infinite scroll, no virtual windowing; 500 is the declared upper bound.

### D-06 — Regenerate button: 60-second client-side debounce + server 429 fallback
Client: after a click, the button is disabled for 60s (visible countdown in the label). Server: `/api/memory/regenerate` tracks the last-invocation timestamp in-process and returns HTTP 429 + `{ error: "cooldown", retry_after_ms }` when invoked within 60s. Both guards exist; client is nice UX, server is the real gate.

### D-07 — Git timeline: per-file (not global)
Scope is per-file. The timeline drawer opens for one file at a time (the file currently selected in Browse tab or the file of the clicked node in Graph tab). Uses `git log --follow --pretty=format:'%H%x09%ct%x09%an%x09%s' -- <path>`. Diff-between-dates UI = pick two commits from the list → `git diff <sha_a>..<sha_b> -- <path>`. Allowlisted project roots only (reuses `lib/cae-memory-sources.ts::ALLOWED_ROOTS`).

### D-08 — Graph stack: `@xyflow/react@12.10.2` + `@dagrejs/dagre@3.0.0`
Versions locked (verified via `npm view` at research time). `@xyflow/react/dist/style.css` is imported EXACTLY ONCE, inside `app/globals.css` AFTER `@import "tailwindcss"` — never inside a component. This is the Tailwind-v4 + React-Flow-v12 pattern per `reactflow.dev/whats-new/2025-10-28`. `pnpm.overrides.react-is = "19.2.4"` already exists (Phase 7 locked it); do NOT re-add. Components using either lib carry `"use client"`.

### D-09 — Markdown stack: `react-markdown@10.1.0` + `remark-gfm@4.0.1`
Versions locked. `react-markdown` is `"use client"`. GFM (tables, task-lists, strikethrough) enabled via `remark-gfm` plugin. No raw-HTML rendering; no custom sanitizer required because `react-markdown` sanitizes by default. Code blocks get syntax-agnostic `<code>` treatment in v1 (no prism/shiki).

### D-10 — Memory source globs (per project, reused by search + hook + tree)
Every project returned by `listProjects()` contributes these files/globs:
- `AGENTS.md` (project root)
- `KNOWLEDGE/**/*.md`
- `.claude/agents/*.md`
- `agents/cae-*.md`
- `.planning/phases/*/*.md`

A pure function `isMemorySourcePath(absPath: string): boolean` lives in `lib/cae-memory-sources.ts` and is the single source of truth — consumed by `lib/cae-memory-search.ts`, the hook script (mirror logic in bash), and the tree builder. The hook script MUST reject any `file_path` that does not match this set.

### D-11 — Search = ripgrep via `execFile` with arg-array + allowlist + 5s timeout
`execFile("rg", [...args], { timeout: 5_000, maxBuffer: 10 * 1024 * 1024 })`. Never `exec`. Never shell-parse. Allowlist is the set of ALL project roots from `listProjects()`. Query length capped at 200 chars. `--glob=*.md` restricts surface. Exit code 1 = "no match found" and is treated as an empty result set, NOT an error (HTTP 200 + empty array).

### D-12 — Multi-project scan reuses `lib/cae-state.ts::listProjects`
Memory sources are union across projects. `lib/cae-memory-sources.ts` calls `listProjects()` — no parallel-implementation of project discovery. If listProjects() is updated, memory auto-updates.

### D-13 — Test runner: Vitest
Wave 0 installs `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` as devDependencies. Adds `"test": "vitest run"` + `"test:watch": "vitest"` to `dashboard/package.json`. Adds `dashboard/vitest.config.ts` with jsdom environment and path alias `@` → `.` (mirrors tsconfig paths). The Phase 6 `.test.ts` files that exist but have no runner become executable for the first time via this install.

### D-14 — Founder-speak default with dev-mode flip
All new `memory.*` label keys live in BOTH `FOUNDER` and `DEV` objects in `lib/copy/labels.ts` and are typed in the `Labels` interface. `labelFor(dev)` returns the merged shape — no separate namespace. Same convention as Phase 4+7.

### D-15 — ExplainTooltip is now a shared UI primitive
`components/metrics/explain-tooltip.tsx` moves to `components/ui/explain-tooltip.tsx` in Wave 0 Task 0. All Phase 7 importers (`components/metrics/speed-panel.tsx`, `components/metrics/reliability-panel.tsx`, `components/metrics/spending-panel.tsx`) have their imports rewritten from `./explain-tooltip` to `@/components/ui/explain-tooltip` in the same commit. Phase 8 Memory panels import from the new canonical location. The move is mechanical — the component's signature, props, and internals are unchanged.

### D-16 — Page structure: server shell + client tabs + drawer overlays
- `app/memory/page.tsx` = server component (`await auth()` + redirect, same pattern as `/metrics`). Accepts a `?view=browse|graph&path=<rel>&task=<id>` query for deep-linking.
- `MemoryClient` wraps base-ui `<Tabs>` with triggers "Browse" / "Graph".
- Why-drawer + git-timeline-drawer are overlays mounted ONCE at the MemoryClient level — reachable from both tabs (Browse: on selected file; Graph: on selected node).
- No `asChild` on base-ui Tab triggers (AGENTS.md gotcha `p2-plA-t1-e81f6c`).

### D-17 — NO iframe for graph (native react-flow)
Per UI-SPEC §S4.5 line: "no iframe stopgap — ship full integration immediately." React-flow mounts directly in `components/memory/graph-pane.tsx`. No `<iframe>` tag in any Memory file.

### D-18 — Scope fence: zero Phase 9/10/11/12 work
Phase 8 MUST NOT touch:
- Changes tab / `/build/changes` (Phase 9)
- Chat rail (Phase 9)
- Plan mode routes `/plan/*` (Phase 10)
- Live Floor / pixel agents (Phase 11)
- Cron / auto-regen (Phase 12)

All regen is manual button only. All chat integration is Phase 9. All timeline animations are v1-static.

---

## Requirements (maps to ROADMAP Phase 8)

| ID | Description | Implemented By |
|----|-------------|----------------|
| `MEM-01` | `/memory` behind auth; Browse / Graph tabs | Wave 6 page shell |
| `MEM-02` | Browse: file-tree of memory sources across projects | Wave 2 `/api/memory/tree` + Wave 3 `FileTree` |
| `MEM-03` | Browse: markdown render of selected file | Wave 2 `/api/memory/file/[...path]` + Wave 3 `MarkdownView` |
| `MEM-04` | Browse: full-text search (ripgrep) | Wave 2 `/api/memory/search` + Wave 3 `SearchBar`/`SearchResults` |
| `MEM-05` | Graph: render `.cae/graph.json` natively with react-flow | Wave 0 install + Wave 2 `/api/memory/graph` + Wave 4 `GraphPane` |
| `MEM-06` | Graph: filter by node type (4 chips: phases/agents/notes/PRDs) | Wave 4 `GraphFilters` |
| `MEM-07` | Graph: click node → drawer w/ content + back-links | Wave 4 `NodeDrawer` |
| `MEM-08` | Graph: manual Regenerate button w/ 60s debounce | Wave 2 `/api/memory/regenerate` + Wave 4 `RegenerateButton` |
| `MEM-09` | "Why?" panel shows REAL memory consulted per task (hook trace) + heuristic fallback | Wave 1 hook + aggregator + API + Wave 5 `WhyDrawer` |
| `MEM-10` | Memory git-log timeline + diff-between-dates | Wave 2 git routes + Wave 5 `GitTimelineDrawer` |
| `MEM-W0-GRAPHIFY` | `graphifyy` CLI installed, fixture run confirms JSON shape | Wave 0 |
| `MEM-W0-DEPS` | npm deps installed, CSS imported once in globals.css | Wave 0 |
| `MEM-W0-VITEST` | Vitest wired, `pnpm test` green on pre-existing .test.ts files | Wave 0 |
| `MEM-W0-EXPLAIN` | ExplainTooltip relocated to `components/ui/` + Phase 7 imports updated | Wave 0 |
| `MEM-W0-GITIGNORE` | `{CAE_ROOT}/.gitignore` excludes `.cae/` | Wave 0 |

---

## Decision Coverage Matrix

| D-XX | Plan | Task | Full/Partial |
|------|------|------|--------------|
| D-01 (graph.json location) | 08-02 | 2 | Full |
| D-02 (graphify install + mode fast) | 08-01 | 1; 08-02 | Full |
| D-03 (Why? = real via hook) | 08-02 (W1) | 1,2,3,4 | Full |
| D-04 (commits OFF) | 08-02 | 2; 08-05 | Full |
| D-05 (500 cap + banner) | 08-05 | 1 | Full |
| D-06 (60s debounce + 429) | 08-02; 08-05 | 2; 2 | Full |
| D-07 (per-file git timeline) | 08-02; 08-06 | 3; 2 | Full |
| D-08 (react-flow + dagre versions + css-in-globals) | 08-01; 08-05 | 1; 1 | Full |
| D-09 (react-markdown + remark-gfm) | 08-01; 08-04 | 1; 1 | Full |
| D-10 (memory source globs) | 08-02 (W1); 08-03 | 1-3; 1 | Full |
| D-11 (ripgrep safe-spawn) | 08-03 | 2 | Full |
| D-12 (reuse listProjects) | 08-03 | 1 | Full |
| D-13 (Vitest) | 08-01 | 3 | Full |
| D-14 (founder-speak labels) | 08-03 | 4 | Full |
| D-15 (ExplainTooltip relocation) | 08-01 | 2 | Full |
| D-16 (page structure) | 08-07 | 1 | Full |
| D-17 (no iframe) | 08-05 | 1 | Full |
| D-18 (scope fence) | 08-08 | 1 (lint script reuse) | Full |

Every D-XX is covered in full. No partials, no splits required.

---

## Gotchas Carried from 08-RESEARCH.md + project history (planner MUST honor)

1. `@xyflow/react` is the current name of old `react-flow-renderer` (July 2024 rename). Do NOT import `react-flow-renderer`.
2. React-Flow CSS import goes in `app/globals.css` AFTER `@import "tailwindcss"`, never inside a component (Tailwind v4 pattern).
3. `react-flow` + `react-markdown` consumers MUST carry `"use client"`. Page shell stays server component.
4. base-ui Tabs do NOT support `asChild` (AGENTS.md `p2-plA-t1-e81f6c`) — use `className` / `cn(buttonVariants())`.
5. ripgrep exit code 1 = no match — treat as empty result, NOT error.
6. `execFile` (arg array) for rg/git/graphify. NEVER `exec`. Timeouts: 5s rg, 30s git, 120s graphify.
7. Allowlist memory roots + `.md` extension. Never trust raw path query params.
8. `.cae/graph.json` is a build artifact — gitignore at CAE root (Wave 0 adds it).
9. Graphify writes to `./graphify-out/graph.json` relative to cwd — spawn with explicit `cwd: CAE_ROOT`, then `mv` atomically.
10. `graphify install` (writes `~/.claude/skills/graphify/SKILL.md`) is an operator prereq. Document in HANDOFF, do not invoke from the server.
11. Reuse `listProjects()` from `lib/cae-state.ts` — hardcoded candidate list is the shared source of truth. Do NOT parallel-implement project discovery.
12. 500-node cap with "Load more"/warning banner is a hard UI budget.
13. Hook failure must NEVER break the agent. `|| true`, swallow stderr. 2s hook timeout.
14. `flock` JSONL writes to avoid torn lines under parallel Reads.
15. `CAE_TASK_ID` export from the adapter is load-bearing — without it, hook entries land under `"unknown"` or `$CLAUDE_SESSION_ID`. The adapter-export is required for `task_id` grouping to work.
16. SSE tail pattern (`lib/tail-stream.ts`) exists for streaming graphify stdout; v1 uses simple synchronous await since `--mode fast` is quick.
17. Vitest + Next 16 combo not verified in prior phases — Wave 0 smoke-tests this.
18. Every new `memory.*` label key needs BOTH founder and dev variants (enforced by `Labels` interface).
19. Phase 7 ExplainTooltip currently lives at `components/metrics/explain-tooltip.tsx` and is imported by speed/reliability/spending panels — these three imports MUST be updated in the same commit that moves the file (D-15). `grep -rn "from \"./explain-tooltip\"" components/metrics/` after the move returns zero hits.
20. `graphifyy` is pre-1.0 (0.4.x) — pin version in install docs; re-verify before plan execution if date has slipped past 2026-05-22.
21. Graphify's exact JSON schema is MEDIUM confidence — Wave 0 runs graphify once against a fixture dir and captures the real keys before downstream types (`GraphNode`, `GraphEdge`) are frozen in `lib/cae-graph-state.ts`.

---

## Wave Plan

| Wave | Plans | Autonomous | Purpose |
|------|-------|-----------|---------|
| 0 | 08-01 | yes | Prereqs: graphify install, npm deps, Vitest, CSS in globals.css, ExplainTooltip relocation, .gitignore patch, fixture graphify run |
| 1 | 08-02 | yes | Memory-consult event plumbing: hook script + settings.json + adapter CAE_TASK_ID export + aggregator + API route |
| 2 | 08-03 | yes | Server modules + 7 API routes + labels.ts memory.* keys |
| 3 | 08-04 (parallel with 08-05) | yes | Browse tab: FileTree + MarkdownView + SearchBar + SearchResults |
| 3 | 08-05 (parallel with 08-04) | yes | Graph tab: GraphPane + filters + NodeDrawer + RegenerateButton |
| 4 | 08-06 | yes | WhyDrawer (real trace + heuristic fallback) + GitTimelineDrawer |
| 5 | 08-07 | yes | Page shell + MemoryClient + Tab router + deep-link query params + Explain tooltips |
| 6 | 08-08 | no | 08-VERIFICATION.md + human UAT + live hook end-to-end smoke (includes running a real Forge task and confirming memory-consult.jsonl populates + Why drawer renders real entries) |

**Parallelism note:** Wave 3 ships TWO plans (08-04 Browse + 08-05 Graph) with ZERO `files_modified` overlap — they live in disjoint `components/memory/browse/*` vs `components/memory/graph/*` subdirs and import from shared server modules written in Wave 2. Labels keys for both live in a single labels.ts block added by Wave 2.

## Plan files expected

- `08-01-PLAN.md` — Wave 0 prereqs (graphify install, deps, Vitest, CSS, ExplainTooltip move, .gitignore)
- `08-02-PLAN.md` — Wave 1 hook + memory-consult plumbing
- `08-03-PLAN.md` — Wave 2 server modules + 7 API routes + labels
- `08-04-PLAN.md` — Wave 3 Browse tab components (parallel)
- `08-05-PLAN.md` — Wave 3 Graph tab components (parallel)
- `08-06-PLAN.md` — Wave 4 Why + Git-timeline drawers
- `08-07-PLAN.md` — Wave 5 Page shell + MemoryClient integration
- `08-08-PLAN.md` — Wave 6 VERIFICATION + human UAT (non-autonomous)
