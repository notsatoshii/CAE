# Phase 8: Memory + Graphify — Research

**Researched:** 2026-04-22
**Domain:** Memory browser (markdown tree + ripgrep search) + knowledge graph (graphify → JSON → react-flow)
**Confidence:** HIGH on stack/versions/pitfalls; MEDIUM on graphify runtime cost + exact JSON shape; LOW on "Why? button" trace (no memory-consult log exists today).

## Summary

Graphify (`safishamsi/graphify`) is real on PyPI as `graphifyy` (`0.4.29` latest) [VERIFIED: `pip index versions graphifyy`]. Outputs `graphify-out/graph.json` with `{nodes[{id,label,source_file,…}], edges[{source,target,relation,confidence}]}` [CITED: github.com/safishamsi/graphify README v4]. `--no-viz` flag exists (JSON-only). Default mode uses Claude for semantic edges; `--mode fast` is AST-only, no LLM cost.

`@xyflow/react` 12.10.2, React-19-compatible, 1.19 MB unpacked [VERIFIED: npm view]. `@dagrejs/dagre` 3.0.0 = right auto-layout default for tree-ish memory graph; `elkjs` 0.11.1 only if we later need sub-flows (async + heavier). `react-markdown` 10.1.0 + `remark-gfm` 4.0.1 is the render pair. `ripgrep` 14.1.0 + Python 3.12.3 already installed.

No `memory_consult` event exists in `.cae/metrics/*.jsonl` [VERIFIED: grepped `bin/circuit_breakers.py`]. "Why?" button v1 = heuristic (task's `files_modified` ∩ memory sources). Accurate event-based trace deferred to a later phase.

**Primary recommendation:** install graphify as a system tool (not vendored), spawn via API route, write to `{CAE_ROOT}/.cae/graph.json`, render natively with `@xyflow/react` + dagre.

## User Constraints (UI-SPEC §9 + §S4.5 + §Audience reframe)

### Locked decisions
- **Graphify = `safishamsi/graphify`** Python CLI, `pip install graphifyy`. Not roll-your-own; not a different tool.
- **Output at `.cae/graph.json`**, consumed by dashboard.
- **Native `react-flow` render** — no iframe stopgap; ship full integration immediately.
- **Manual "Regenerate graph" button**; cron optional.
- **Filter by node type:** phases / agents / notes / PRDs / commits.
- **Click node → drawer** with content + back-links.
- **Browse mode:** file tree + markdown render + **ripgrep-backed** full-text search.
- **"Why?" button** on Build events traces memory consulted.
- **Memory git-log timeline** with diff-between-dates.
- **Read-only** — edits via agents only.

### Claude's discretion
- Layout library (dagre recommended).
- Markdown renderer (`react-markdown` + `remark-gfm` recommended).
- graph.json scope (global vs per-project — recommend **global** at `{CAE_ROOT}/.cae/graph.json`).
- "Why?" mechanism (heuristic vs event — recommend heuristic v1 with "probably referenced" copy).
- Cron (recommend manual-only v1; defer cron to polish phase).

### Deferred / out of scope
- Graph edit/mutation UI (read-only rule).
- Per-project sharding of graph.json.
- Advanced drill-downs.

## Project Constraints (CAE CLAUDE.md + dashboard/AGENTS.md)

- **base-ui does NOT support `asChild`** — use `className` / `cn(buttonVariants())`. [AGENTS.md `p2-plA-t1-e81f6c`]
- **react-is pin** at `19.2.4` in `pnpm.overrides` must remain — applies to any react-flow/dagre sub-dep that drags in a mismatch.
- **Founder-speak default**; Dev-mode = ⌘Shift+D. Every new label needs both variants in `lib/copy/labels.ts`.
- **Server/client boundary:** components using `@xyflow/react` / `react-markdown` must be `"use client"`; page shell stays server-component (auth redirect).
- **SSE tail pattern** exists (`lib/tail-stream.ts`) — reuse for streaming graphify stdout during regen.

## Phase Requirements

| ID | Description |
|----|-------------|
| MEM-01 | `/memory` behind auth; Browse / Graph tabs |
| MEM-02 | Browse: file-tree of memory sources across projects |
| MEM-03 | Browse: markdown render of selected file |
| MEM-04 | Browse: full-text search (ripgrep-backed server action) |
| MEM-05 | Graph: render `.cae/graph.json` natively with react-flow |
| MEM-06 | Graph: filter by node type (5 chips) |
| MEM-07 | Graph: click node → drawer with content + back-links |
| MEM-08 | Graph: manual "Regenerate" button |
| MEM-09 | "Why?" button on Build events → memory entries consulted |
| MEM-10 | Memory git-log timeline with diff-between-dates |

---

## Standard Stack

### New npm deps
| Package | Version | Purpose |
|---------|---------|---------|
| `@xyflow/react` | 12.10.2 | Graph renderer |
| `@dagrejs/dagre` | 3.0.0 | Auto-layout |
| `react-markdown` | 10.1.0 | Markdown render |
| `remark-gfm` | 4.0.1 | GFM tables / task-lists |

### System deps
| Tool | Version | Status |
|------|---------|--------|
| `rg` (ripgrep) | 14.1.0 | ✓ `/usr/bin/rg` |
| `graphifyy` | 0.4.29 | ✗ not installed; Wave 0 install task |
| `git` | repo already | ✓ |
| Python | 3.12.3 | ✓ (≥3.10 required) |

### Install
```bash
# In dashboard/
pnpm add @xyflow/react @dagrejs/dagre react-markdown remark-gfm
# System — once
pip install graphifyy
graphify install   # writes ~/.claude/skills/graphify/SKILL.md; operator prereq
```

### Alternatives considered
| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| `@dagrejs/dagre` | `elkjs` 0.11.1 | More configurable, async, heavier. Keep in reserve for sub-flows or >500 nodes. |
| `@dagrejs/dagre` | `d3-hierarchy` | Pure trees only; fails on cross-refs (memory has many). |
| `react-markdown` | `marked` + `dompurify` | `react-markdown` ergonomic + sanitized by default. |
| Graphify (LLM) | `--mode fast` AST-only | Free, structural-only, no semantic edges. Wave 0 fallback. |
| Graphify | Roll-own Node script | Last-resort fallback; see §Roll-own fallback. |

---

## Architecture Recommendation

### Routes
- `GET  /api/memory/tree` — file-tree across projects.
- `GET  /api/memory/file?path=<allowlisted>` — markdown content.
- `GET  /api/memory/search?q=<term>&roots=<csv>` — rg JSON hits.
- `GET  /api/memory/graph` — returns `.cae/graph.json` (60s cache).
- `POST /api/memory/graph/regenerate` — spawns `graphify`, SSE progress.
- `GET  /api/memory/why?task_id=<id>` — heuristic-matched memory.
- `GET  /api/memory/git?paths=<csv>&since=&until=` — log + diff.

### Pages / components
- `app/memory/page.tsx` — server (auth + Tabs shell + initial tree).
- `app/memory/[...path]/page.tsx` — deep-link to a file (Browse-mode addressable).
- `components/memory/memory-tabs.tsx` — base-ui Tabs (`?view=browse|graph`).
- `components/memory/browse-pane.tsx`, `file-tree.tsx`, `markdown-view.tsx`, `search-bar.tsx`, `search-results.tsx`.
- `components/memory/graph-pane.tsx`, `graph-filters.tsx`, `node-drawer.tsx`, `git-timeline.tsx`.

### Server modules
- `lib/memory-sources.ts` — `listMemorySources(project)`, path allowlist.
- `lib/memory-search.ts` — `rgSearch()` via `execFile`.
- `lib/memory-graph.ts` — `loadGraph()`, `regenerateGraph()`.
- `lib/memory-classify.ts` — pure fn path → node-type.
- `lib/memory-git.ts` — `gitLog()`, `gitDiff()`.
- `lib/memory-whytrace.ts` — heuristic intersection.

### graph.json location (recommendation)
**`{CAE_ROOT}/.cae/graph.json`** — single global file. Matches existing `.cae/metrics/*.jsonl` convention. Gitignored.

### Graphify invocation
```bash
cd /home/cae/ctrl-alt-elite
graphify . --no-viz --update
mv graphify-out/graph.json .cae/graph.json
```
Timeout 120 s, stderr → `.cae/graph-regenerate.log`. Stream stdout to SSE.

---

## Memory Source Inventory

For every project under `/home/cae/*/` (use existing `listProjects()` in `lib/cae-state.ts`):

| Glob | Node type |
|------|-----------|
| `CLAUDE.md`, `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `HANDOFF.md` (root) | notes |
| `KNOWLEDGE/**/*.md` | notes |
| `.planning/phases/*/[0-9][0-9]-RESEARCH.md` | notes |
| `.planning/phases/*/[0-9][0-9]-CONTEXT.md` | notes |
| `.planning/phases/*/[0-9][0-9]-*-PLAN.md` | phases |
| `.planning/phases/*/[0-9][0-9]-*-SUMMARY.md` | phases |
| `.planning/phases/*/[0-9][0-9]-VERIFICATION.md` | phases |
| `.planning/ROADMAP.md`, `docs/PRD.md`, `docs/UI-SPEC.md` | PRDs |
| `agents/cae-*.md` (CAE_ROOT only — global personas) | agents |

Discovered at research time: `ctrl-alt-elite` (has `AGENTS.md`, `agents/`, `.planning/`), `ctrl-alt-elite/dashboard` (AGENTS.md, KNOWLEDGE/, .planning/phases/), `multica` (AGENTS.md only, no .planning). No `/home/cae/KNOWLEDGE/` at top level.

**Commits** are a virtual node type (from `git log`, not a file path). Default OFF in v1 to keep graph small; add `include_commits` flag.

---

## ripgrep integration (safe)

**Pattern** — mirrors `app/api/workflows/[slug]/run/route.ts`:
```ts
import { execFile } from "node:child_process"
import { promisify } from "node:util"
const execFileP = promisify(execFile)

const ALLOWED_ROOTS = [
  "/home/cae/ctrl-alt-elite",
  "/home/cae/ctrl-alt-elite/dashboard",
  "/home/cae/multica",
] as const

export async function rgSearch(q: string, roots: string[]) {
  if (q.length > 200) throw new Error("query too long")
  const safe = roots.filter((r) => ALLOWED_ROOTS.includes(r as never))
  const args = ["--json","--max-count=20","--max-columns=200","--glob=*.md","--smart-case","--", q, ...safe]
  try {
    const { stdout } = await execFileP("rg", args, { timeout: 5_000, maxBuffer: 10 * 1024 * 1024 })
    return stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l))
  } catch (err: any) {
    if (err.code === 1) return []      // rg exit 1 = no match; NOT an error
    throw err
  }
}
```

**Security rules:** `execFile` not `exec` (no shell parsing). Allowlist roots — never accept arbitrary paths. Query length cap. Timeout strict. `--glob=*.md` limits surface.

---

## Node classification (graph filters)

```ts
function classify(node: { source_file?: string; id: string }): NodeKind {
  const p = (node.source_file ?? node.id).toLowerCase()
  if (/\/\.planning\/phases\/\d{2}-.+\/.+-(plan|summary|verification)\.md$/.test(p)) return "phases"
  if (/\/agents\/cae-[\w-]+\.md$/.test(p)) return "agents"
  if (/\/(roadmap|prd|ui-spec)\.md$/.test(p)) return "PRDs"
  if (node.id.startsWith("commit:") || /^[0-9a-f]{7,40}$/.test(node.id)) return "commits"
  return "notes"
}
```
Filter chips hide nodes AND incident edges when unticked.

---

## Back-links

Cheap double-source:
1. **From graph edges** — `target === nodeId` over `graph.json`. Free.
2. **From markdown links** — regex `[text](./rel.md)` and `[[wiki]]` at file-load time, caches by mtime. Catches `.md`-internal refs graphify's tree-sitter pass may miss.

---

## "Why?" trace — Wave 0 decision

No `memory_consult` event exists today [VERIFIED: grep zero hits]. Three options:

| Option | Effort | Accuracy | Pick? |
|--------|--------|----------|-------|
| A. Heuristic (task's `files_modified` ∩ memory sources) | Low | Medium (misses read-only consults, over-reports writes) | **Ship v1 with this, label "probably referenced"** |
| B. Extend `bin/circuit_breakers.py` with `memory_consult` event | Medium (cross-subtree, like Phase 7 D-01) | High (ground truth) | Defer to a future phase; document Phase 8 open-question |
| C. Parse Forge tmux stdout for file reads | Medium-High | Medium | Reject — fragile |

**Recommendation:** Option A for v1. Document Option B as the follow-up.

---

## Git-log timeline

```bash
git -C /home/cae/ctrl-alt-elite log --pretty=format:'%H%x09%ct%x09%an%x09%s' \
  --since="2026-04-01" --until="2026-04-22" -- AGENTS.md KNOWLEDGE/ agents/cae-*.md

git -C /home/cae/ctrl-alt-elite diff <shaA>..<shaB> -- AGENTS.md
```
`execFile('git', args, { cwd: projectRoot })`. Allowlist paths. Response cap (e.g., 500 commits max).

---

## Auto-layout (dagre) + cron

```ts
import dagre from "@dagrejs/dagre"
function layout(nodes, edges) {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: "LR", ranksep: 80, nodesep: 40 })
  nodes.forEach((n) => g.setNode(n.id, { width: 180, height: 50 }))
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return { nodes: nodes.map((n) => ({ ...n, position: { x: g.node(n.id).x - 90, y: g.node(n.id).y - 25 } })), edges }
}
```
Memoize on graph.json mtime. Re-run on filter change.

**Cron:** no systemd user units currently exist [VERIFIED: `systemctl --user list-unit-files` empty for hermes]. Ship manual button only; defer cron to Phase 12 polish.

---

## Roll-own fallback (contingency)

If graphify LLM cost is rejected at discuss, ship structural-only fallback:
```ts
// Walks memory sources; extracts markdown links ([text](./rel.md))
// Emits same { nodes, edges } schema so downstream is unchanged.
```
Misses semantic edges; keep `confidence: "EXTRACTED"` on every edge. Swap back to graphify later without touching consumers.

---

## Graphify tradeoff

| Dimension | Graphify default (LLM) | `--mode fast` AST-only | Roll-own |
|-----------|-------------------------|-------------------------|---------|
| Token cost / regen | Non-zero, scales w/ repo | 0 | 0 |
| Semantic edges | Yes | No | No |
| Multimodal (PDFs, images) | Yes | Limited | No |
| Install | `pip install graphifyy` | same | none |
| Needs Claude key | Yes | No | No |
| Incremental | `--update` | `--update` | rebuild (cheap) |
| Recommendation | Phase 8 MVP default | Wave 0 fallback | Last resort |

---

## GOTCHAS to Honor (PLANNER MUST READ)

1. **react-flow CSS import** goes in `app/globals.css` AFTER `@import "tailwindcss"`, NOT inside a component — Tailwind v4 + React-Flow pattern. [CITED: reactflow.dev/whats-new/2025-10-28]
2. **react-markdown + react-flow MUST be `"use client"`.** Page shell stays server-component.
3. **base-ui Tabs don't support `asChild`** — className on trigger Link. [AGENTS.md `p2-plA-t1-e81f6c`]
4. **ripgrep exit code 1 = no match**, not error. Catch.
5. **`execFile` never `exec`** for rg/git/graphify. Arg arrays. Timeouts: 5 s rg, 30 s git, 120 s graphify.
6. **Allowlist memory roots + .md extension.** Never trust a `path` query param raw.
7. **Graphify default mode needs Claude access.** Detect missing `ANTHROPIC_API_KEY` and downgrade to `--mode fast` with a banner.
8. **`.cae/graph.json` is a build artifact — gitignore it.** Same rule as `.cae/metrics/*.jsonl`.
9. **Graphify writes to `./graphify-out/graph.json` relative to CWD.** Spawn with explicit `cwd`, then `mv`.
10. **`graphify install` is an operator prereq** (writes `~/.claude/skills/graphify/SKILL.md`). Don't invoke from server; document in HANDOFF.md.
11. **Reuse `listProjects()`** in `lib/cae-state.ts` (hardcoded candidate list). Extend it — don't parallel-implement.
12. **Node-count cap 300 default** + "Load more" — graphify on full repo yields hundreds.
13. **No `memory_consult` event** — v1 "Why?" must say "probably referenced".
14. **Founder/dev label pairs** in `lib/copy/labels.ts`: `memory.tab.{browse,graph}`, `memory.btn.{regenerate,why}`, `memory.label.{backLinks,timeline}`, plus Explain-mode tooltips for EXTRACTED/INFERRED/AMBIGUOUS.
15. **SSE for regenerate progress** — 120 s is long; stream graphify stdout via `lib/tail-stream.ts` pattern.
16. **Graphify is pre-1.0** (0.4.x) — pin a version in install docs; re-verify before plan execution.
17. **Graphify's JSON schema not fully documented** — Wave 0 runs graphify once against a fixture dir to confirm exact keys before `memory-classify.ts` and `memory-graph.ts` freeze their types.

---

## Validation Architecture

No test runner wired (`package.json` has no `test` script). Phase 6 shipped `.test.ts` files but no runner.

**Wave 0:** install Vitest.
```bash
pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
# add "test": "vitest" + vitest.config.ts
```

### Requirement → test map
| Req | Type | Target |
|-----|------|--------|
| MEM-02 | unit | `lib/memory-sources.test.ts` (glob hits) |
| MEM-04 | unit (spawn-mocked) | `lib/memory-search.test.ts` |
| MEM-05 | unit | `lib/memory-graph.test.ts` (fixture graph.json) |
| MEM-06 | unit (pure fn) | `lib/memory-classify.test.ts` |
| MEM-08 | integration (spawn-mocked) | `app/api/memory/graph/regenerate` |
| MEM-09 | unit | `lib/memory-whytrace.test.ts` |
| MEM-10 | integration (tmp git repo) | `lib/memory-git.test.ts` |

### Wave 0 gaps
- [ ] Install Vitest + RTL + jsdom; add `test` script + `vitest.config.ts`.
- [ ] Fixture `graph.json` for render/classify tests.
- [ ] `tests/helpers/mock-spawn.ts`.

### Sampling
- Per task commit: `pnpm test -- <path>`.
- Per wave merge: `pnpm test`.
- Phase gate: full green before `/gsd-verify-work`.

---

## Environment Availability

| Dependency | Available | Version | Fallback |
|------------|-----------|---------|----------|
| `rg` | ✓ | 14.1.0 | — |
| `git` | ✓ | repo-level | — |
| Python ≥3.10 | ✓ | 3.12.3 | — |
| `graphifyy` | ✗ | — | Wave 0 install; or roll-own fallback |
| `ANTHROPIC_API_KEY` | ? | — | `--mode fast` AST-only |
| systemd user infra | ✗ | — | Manual-only v1 (recommended) |
| Test runner | ✗ | — | Install Vitest in Wave 0 |

**Blocking:** graphifyy install (Wave 0).
**Fallback OK:** cron (manual fine), test runner (Wave 0), Claude key (`--mode fast`).

---

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| `react-flow-renderer` | `@xyflow/react` (July 2024 rename) | Any `react-flow-renderer` guide is stale; import path changed. |
| Tailwind v3 RF css import in component | Tailwind v4: import CSS in `globals.css` after `@import "tailwindcss"` | Phase 3 locked Tailwind v4 — must use new pattern. [CITED: reactflow.dev/whats-new/2025-10-28] |
| `react-markdown` v6–8 | v9.0.2+ / v10 | React 19 types supported; pair with `remark-gfm` 4.x. |

---

## Assumptions Log

| # | Claim | Risk if wrong |
|---|-------|--------------|
| A1 | Global `graph.json` at `{CAE_ROOT}/.cae/` acceptable | Per-project shard = route contract change; trivial |
| A2 | "Why?" heuristic v1 acceptable with "probably referenced" copy | If user demands ground truth → blocks on event emit work |
| A3 | Graphify LLM default-mode token cost OK for manual regen | Fallback to `--mode fast` already speced |
| A4 | Commits OFF in v1 graph | Trivial flag to flip |
| A5 | Node cap 300 matches spec #12 intent | UX polish cost only |
| A6 | Vitest is the right runner | Low — any runner fine |
| A7 | Exact graphify JSON field names match the schema reported in README | Wave 0 runs graphify against fixture to confirm before freezing types |

---

## Open Questions (for discuss-phase)

1. **Global vs per-project `graph.json`?** Recommend global v1.
2. **Graphify default (LLM) or `--mode fast` AST-only?** Token-budget call.
3. **"Why?" heuristic acceptable for v1**, or block Phase 8 on `memory_consult` event?
4. **Include commit nodes in graph?** Default OFF recommended.
5. **Node-count cap** — 300? 500?
6. **Regenerate button — rate-limit / admin-only?** (Graphify spawn is heavy.)
7. **Git-timeline scope** — all memory files per project or per-file?

---

## Sources

### Primary (HIGH)
- `/home/cae/ctrl-alt-elite/dashboard/docs/UI-SPEC.md` §9 + §S4.5 + §Audience reframe
- `/home/cae/ctrl-alt-elite/dashboard/.planning/ROADMAP.md` Phase 8
- `/home/cae/ctrl-alt-elite/dashboard/AGENTS.md`
- `/home/cae/ctrl-alt-elite/dashboard/package.json`
- `/home/cae/ctrl-alt-elite/dashboard/lib/cae-state.ts` L75 `listProjects`, L161 `tailJsonl`
- `/home/cae/ctrl-alt-elite/dashboard/lib/cae-agents-state.ts`
- `/home/cae/ctrl-alt-elite/dashboard/app/api/workflows/[slug]/run/route.ts` (spawn reference)
- `/home/cae/ctrl-alt-elite/dashboard/.planning/phases/07-metrics-global-top-bar-icon-page/07-RESEARCH.md`
- `npm view @xyflow/react` → 12.10.2 · `react-markdown` → 10.1.0 · `@dagrejs/dagre` → 3.0.0 · `elkjs` → 0.11.1 · `remark-gfm` → 4.0.1
- `pip index versions graphifyy` → 0.4.29
- `rg --version` → 14.1.0 · `python3 --version` → 3.12.3

### Secondary (MEDIUM)
- [safishamsi/graphify README](https://github.com/safishamsi/graphify) — CLI flags, schema, install
- [graphify v4 README](https://github.com/safishamsi/graphify/blob/v4/README.md) — `--no-viz`, `--update`, AST-only pass
- [React Flow whats-new 2025-10-28](https://reactflow.dev/whats-new/2025-10-28) — React 19 + Tailwind v4 CSS pattern
- [React Flow layouting](https://reactflow.dev/learn/layouting/layouting) — dagre/elk tradeoffs
- [graphifyy PyPI](https://pypi.org/project/graphifyy/)

### Tertiary (LOW)
- Medium flavor posts on graphify.

---

## Metadata

**Confidence:**
- Stack + versions: HIGH (npm view + pip verified).
- graphify CLI/flags: HIGH; exact JSON keys: MEDIUM (Wave 0 fixture run confirms).
- "Why?" trace: LOW — no event, heuristic only.
- spawn/rg/git patterns: HIGH — mirrors existing route.
- Validation: MEDIUM — Vitest not verified against Next 16 specifically.

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 d; graphify is 0.4.x pre-1.0 — re-verify if plan slips past May).
