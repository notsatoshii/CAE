# Phase 16 — Knowledge Layer + Continuous Labelling Plan

Source spec: `RESEARCH.md` (= the locked KNOWLEDGE-LAYER-DESIGN from Phase 15 cycle 14 split).

## 10 atomic waves (production-quality, no half-asses)

### W16.1 — Memory file format spec + JSON Schema in repo

**Files:**
- `lib/memory/format.ts` — TypeScript types for Memory frontmatter
- `lib/memory/format.schema.json` — JSON Schema for ajv validation
- `lib/memory/format.test.ts` — schema validation tests
- `docs/memory-format.md` — human spec doc

**Frontmatter spec (per RESEARCH §1):**
```yaml
---
name: <required>
description: <required>
type: <required: project|user|feedback|reference|bug|decision>
created_at: <ISO>
updated_at: <ISO>
last_reanalyzed_at: <ISO|null>
analyzer_version: <semver|null>
tags: [array]
aliases: [array]
related: [{path, relationship, confidence}]
mentions_files: [array auto-extracted]
mentions_agents: [array auto-extracted]
mentions_phases: [array auto-extracted]
backlinks: <bool default true>
confidence_floor: <0.0-1.0 default 0.5>
---
```

**Validation:** ajv strict mode + custom rules (created_at <= updated_at; mentions_* must be valid file paths or known agents/phases).

**Tests:** valid frontmatter passes; missing required fails; mentions_* type guards work.

**Commit:** `feat(memory-format): spec + JSON Schema + types + validation`

### W16.2 — memory-analyzer.ts CLI shipped (no UI yet)

**File:** `scripts/memory-analyzer.ts` — Node CLI

**Subcommands per RESEARCH §3:**
- `analyze --file <path>` — analyze one file, output proposed changes JSON
- `analyze --all` — full vault scan
- `analyze --incremental` — only files modified since last run
- `apply <proposed-changes.json>` — apply diffs with backup
- `revert <snapshot-id>` — restore from snapshot
- `extract --file <path>` — entity extraction only (no LLM call)
- `dry-run` — analyze without writing anything

**Pipeline (5 stages):**
1. Parse frontmatter + body
2. Extract entities via regex catalog (file paths, agent names, phase IDs, commit SHAs, URLs, code identifiers)
3. Call opus-4-7 with prompt template + `cache_control` on the catalog block
4. Compute backlinks (who mentions this file)
5. Output edge updates + frontmatter delta + backlinks section delta

**Privacy:** opus-4-7 calls go through Eric's Anthropic API key only. No third-party telemetry.

**Storage:**
- `.cae/knowledge/edges.jsonl` (append-only)
- `.cae/knowledge/snapshot.json` (materialized view)
- `.cae/knowledge/proposed-changes.json` (pending applies)
- `.cae/knowledge/snapshots/<timestamp>/` (revert backups)

**Tests:** entity extraction precision/recall, edge dedup, frontmatter merge safety.

**Commit:** `feat(memory-analyzer): CLI + 5-stage pipeline + storage layer`

### W16.3 — Dry-run on existing memory files

**Action:** run `memory-analyzer analyze --all --dry-run` against `/root/.claude/projects/-root/memory/` (current memory store).

**Output:** `.cae/knowledge/dry-run-2026-04-23.diff.md` — review log of proposed changes per file.

**Human review:** Eric (or me on his behalf) reviews diff. Adjust extraction rules / LLM prompt if quality is low. Iterate until extraction precision/recall acceptable.

**Commit:** `chore(memory-analyzer): dry-run report against current memory store`

### W16.4 — Apply migration to existing memory files

**Action:** run `memory-analyzer apply <proposed.json>` after Eric review. Each memory file gains:
- `created_at` / `updated_at` (best-guess from git log if not present)
- `tags` (default empty)
- `related` (auto-populated from analyzer)
- `mentions_*` (auto-populated)
- `backlinks` section auto-generated between fenced markers

**Backup:** `.cae/knowledge/snapshots/pre-migration/` for revert.

**Commit:** `chore(memory): migrate to enriched frontmatter + auto-backlinks`

### W16.5 — In-app graph rework: react-flow with edge types + side panel + backlinks panel

**Files:**
- `components/memory/graph/graph-pane-v2.tsx` (replaces existing)
- `components/memory/graph/node-card.tsx` (custom react-flow node — 200×80 with icon, title, snippet, tags, timestamp)
- `components/memory/graph/edge-with-color.tsx` (custom react-flow edge with type-color)
- `components/memory/graph/side-panel.tsx` (400px right-rail, content + backlinks + related)
- `components/memory/graph/edge-filters.tsx` (toggle which edge types are visible)
- `components/memory/graph/graph-legend.tsx` (color key)
- `components/memory/graph/graph-search.tsx` (search box, highlight paths between nodes)

**Layout:** d3-force or @dagrejs/dagre for force-directed (vs current strict LR dagre).

**Edge color by type:** mentions / related / derived / supersedes / mentioned_by_action / worked_on_by / part_of_phase.

**Node size by inbound link count.** Halo on nodes accessed in last 24h.

**Tests:** render with N-node fixture, click → side panel, search highlights, filter toggles work.

**Commit:** `feat(memory-graph-v2): react-flow + edge types + side panel + backlinks`

### W16.6 — Re-analyze button + diff preview modal

**Files:**
- `components/memory/graph/reanalyze-button.tsx`
- `components/memory/graph/reanalyze-modal.tsx`
- `components/memory/graph/diff-preview.tsx`
- `app/api/memory/analyze/stream/route.ts` (SSE for progress)

**Stages:**
1. Click → modal opens
2. Progress phase: SSE pushes "Reading 87 files...", "Extracting entities...", "Calling LLM (12 of 87)...", "Computing diffs..."
3. Diff preview: side-by-side current vs proposed for each suggested change
4. Per-suggestion accept/reject toggle (default all accepted)
5. Apply: writes changes; toast confirms
6. Revert button (post-apply, if regret): restores from snapshot

**Bulk actions:** accept-all, reject-all, accept-high-confidence-only.

**File-lock:** prevent concurrent runs.

**Tests:** modal stages, SSE progress, diff render, apply, revert.

**Commit:** `feat(memory-reanalyze): button + 3-stage modal + diff preview + apply/revert`

### W16.7 — Continuous labelling pipeline: post-commit hook + agent-invocation logger + cron

**Files:**
- `scripts/post-commit-memory-link.sh` — git hook that calls `memory-analyzer analyze --commit HEAD`
- `tools/agent-invocation-hook.sh` — PostToolUse hook for Agent/Task tools, writes to `.cae/knowledge/agent-invocations.jsonl`
- Update `scripts/cae-scheduler-watcher.sh` to gate `[[ $(date +%M) =~ ^(00|15|30|45)$ ]]` for 15-min analyzer runs

**Action:** install hooks via `scripts/install-knowledge-hooks.sh`.

**Tests:** simulate commit, verify edge appears; simulate Agent invocation, verify edge.

**Commit:** `feat(continuous-labelling): post-commit + agent-invocation + 15-min cron`

### W16.8 — Wikilink rendering in markdown view

**File:** `components/memory/browse/markdown-view.tsx`

**Changes:**
- Detect `*.md` markdown links — wrap in interactive chip with hover preview card
- Optionally support `[[wikilink]]` syntax — normalize on read
- Broken links highlighted (red dashed underline) with tooltip "Target file not found"
- Click chip → navigate within graph (expands graph view to that node)

**Tests:** chip rendering, hover preview, broken link styling, click navigation.

**Commit:** `feat(markdown): wikilink chips + hover preview + broken-link styling`

### W16.9 — Monitor for 1 week, tune

**Action:**
- Daily Eric-check on graph rendering quality
- Tune extraction rules per false-positive / false-negative reports
- Tune LLM prompt per redundant / missing related-suggestion patterns
- Capture metrics: extraction precision/recall, edges added per analyzer run, false-suggestion rate

**Output:** `.cae/knowledge/tuning-log.md`

**Commit:** `chore(memory-tuning): week-1 observations + rule adjustments`

### W16.10 — Continuous labelling pipeline polish + edge index optimizations

**Action:**
- snapshot.json materialized view rebuild incrementally (currently full)
- Edge dedup: hash-based dedup on (from, to, type)
- Tombstones for edges from deleted/superseded files
- Graph render: incremental update on new edges (don't re-layout whole graph)
- Performance: <200ms for 500-node graph render

**Tests:** dedup correctness, tombstone logic, perf benchmark.

**Commit:** `perf(memory-graph): incremental snapshot + edge dedup + tombstones`

## Test plan reference

Per Phase 15 TEST-PLAN.md adapted:
- L1 (capture): hook fires on commit / agent invocation
- L2 (render): graph renders correct nodes/edges per fixture
- L3 (discover): user can find any memory file via search highlight in 4 clicks max

## Sequencing

W16.1 + W16.2 + W16.5 can largely parallelize (3 agents).
W16.3 + W16.4 + W16.6 + W16.7 + W16.8 sequential within their dep chains.
W16.9 + W16.10 last, after W16.6+W16.7 land + 1 week of usage.

## Owner

This is its own phase. Treat as separate ship cadence from Phase 15 FE work.
