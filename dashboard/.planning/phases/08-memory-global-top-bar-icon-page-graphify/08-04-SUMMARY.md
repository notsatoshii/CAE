---
phase: 08-memory-global-top-bar-icon-page-graphify
plan: 04
subsystem: client-browse
tags: [wave-3, browse-tab, file-tree, markdown, ripgrep-ui, parallel-with-08-05]

# Dependency graph
requires:
  - phase: 08-memory-global-top-bar-icon-page-graphify
    plan: 03
    provides: /api/memory/tree, /api/memory/file/[...path], /api/memory/search, MemoryTreeNode + SearchHit types, memory.* label keys
  - phase: 08-memory-global-top-bar-icon-page-graphify
    plan: 01
    provides: Vitest + @testing-library/react runner, react-markdown@10.1.0 + remark-gfm@4.0.1, @/components/ui/explain-tooltip canonical location
provides:
  - dashboard/components/memory/browse/file-tree.tsx — recursive MemoryTreeNode UI with keyboard nav + data-selected styling
  - dashboard/components/memory/browse/markdown-view.tsx — /api/memory/file fetcher + react-markdown render + idle/loading/loaded/404/403/error + raw-toggle + onOpenGitTimeline hook
  - dashboard/components/memory/browse/browse-pane.tsx — tab-level composition with full Wave-5 prop signature (initialPath / selectedPath / onSelect / onOpenGitTimeline) + controlled-vs-uncontrolled mode
  - dashboard/components/memory/browse/search-bar.tsx — 300ms debounced /api/memory/search with 200-char cap + loading pulse + ExplainTooltip
  - dashboard/components/memory/browse/search-results.tsx — grouped-by-file rg hit display with 3-hit truncation + "+N more" + cyan highlight + click-to-select
affects: [08-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controlled-vs-uncontrolled React pattern: `isControlled = controlledProp !== undefined` — when `selectedPath` prop is passed, local state is mirrored; when absent, local state seeded from `initialPath` owns the value. Wave 5 can swap into controlled mode without refactor."
    - "300ms debounce without lodash: `useEffect` + `setTimeout` + explicit `clearTimeout` in cleanup; late-resolving fetches cancelled via `latestQRef` comparison so stale responses can't overwrite newer ones."
    - "Cross-node text matching in Vitest: when a component splits text via `<mark>` highlights, assert on `container.textContent` (flattened) instead of `screen.getByText(/.../)` which requires single-node match."
    - "Hand-rolled markdown typography: `components` prop on `ReactMarkdown` with h1/h2/h3/p/a/ul/ol/li/blockquote/code/pre/hr/table/th/td overrides using Tailwind utility classes + CSS custom properties — no typography plugin, no prose import, full theme-variable flow."
    - "Path-segment URL encoding for catchall routes: `abs.split('/').map(encodeURIComponent).join('/')` — leading slash becomes an empty first segment, each path part survives spaces/parens/unicode."

key-files:
  created:
    - dashboard/components/memory/browse/browse-pane.tsx
    - dashboard/components/memory/browse/file-tree.tsx
    - dashboard/components/memory/browse/file-tree.test.tsx
    - dashboard/components/memory/browse/markdown-view.tsx
    - dashboard/components/memory/browse/search-bar.tsx
    - dashboard/components/memory/browse/search-results.tsx
    - dashboard/components/memory/browse/search-results.test.tsx
  modified: []

key-decisions:
  - "BrowsePane declares its full Wave-5 prop signature in Task 1 so downstream (08-07) can consume without refactoring Wave-3 output. `selectedPath` runs controlled / `initialPath` runs uncontrolled; `onSelect` fires BEFORE local state mutates so URL-syncing can stay ahead; `onOpenGitTimeline` threads through to MarkdownView — button hides when prop is absent."
  - "SearchBar + SearchResults live as minimal stub modules at the end of Task 1 so BrowsePane typechecks immediately and the module graph resolves without cross-task churn. Task 2 replaces the stub bodies in place — no BrowsePane import changes between tasks."
  - "Markdown typography is hand-rolled via `components` prop on ReactMarkdown (h1-h3 / p / a / ul / ol / li / blockquote / code / pre / hr / table / th / td). Avoids pulling in Tailwind typography plugin for ~300 LOC of output. All colours flow through CSS vars (--text, --text-muted, --accent, --border, --surface)."
  - "Search-debounce cancellation uses a `latestQRef` to drop stale responses — prevents the classic race where a slow fetch for 'fo' resolves AFTER a fast fetch for 'foo' and overwrites the correct hits."
  - "Per Plan 08-03's deviation pattern #3/#4, doc comments avoid the literal substrings `asChild` and `components/memory/graph` so the plan's verify greps (`! grep -qE 'asChild'`, `! grep -rq 'components/memory/graph'`) stay clean without sacrificing documentation intent."

requirements-completed:
  - MEM-02
  - MEM-03
  - MEM-04

# Metrics
duration: ~18min
completed: 2026-04-22
---

# Phase 8 Plan 04: Wave 3 Browse Tab Client Island Summary

**Shipped the Memory Browse tab client island: 5 TSX components + 2 Vitest suites + zero-overlap-with-08-05 physical isolation. FileTree renders the cross-project memory tree with keyboard nav + expand/collapse + selection callback. MarkdownView fetches /api/memory/file and renders via react-markdown + remark-gfm with 5-state machine (idle / loading / loaded / 404 / 403 / error) and hand-rolled typography. SearchBar debounces 300ms against /api/memory/search with stale-response dropping; SearchResults groups rg hits by file with 3-hit truncation + cyan match highlighting. BrowsePane glues it all together with a Wave-5-ready controlled-vs-uncontrolled prop contract so 08-07 can consume without refactor. 8 tests green, tsc + build clean.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-22T22:12:00Z (plan load)
- **Completed:** 2026-04-22T22:30:00Z (Task 2 commit)
- **Tasks:** 2 / 2
- **Commits:** 2 (atomic, one per task)
- **New files:** 7 (5 components + 2 test files)
- **Total LOC:** 1316 across 7 files
- **Test runtime:** 150 ms (4 + 4 tests, both suites)
- **Build time:** 9.9s compile (Next.js 16 turbopack)

## Task Commits

| Task | Scope | Commit | Files |
|------|-------|--------|-------|
| 1 | feat(08-04) FileTree + MarkdownView + BrowsePane composition + SearchBar/SearchResults stubs + FileTree test suite | `16dfbc0` | browse-pane.tsx, file-tree.tsx, file-tree.test.tsx, markdown-view.tsx, search-bar.tsx (stub), search-results.tsx (stub) |
| 2 | feat(08-04) SearchBar + SearchResults full implementation + SearchResults test suite | `91129b5` | search-bar.tsx, search-results.tsx, search-results.test.tsx |

## Component Line Counts

| File | Lines | Purpose |
|------|-------|---------|
| `components/memory/browse/browse-pane.tsx` | 182 | Tab-level composition with Wave-5 prop contract |
| `components/memory/browse/file-tree.tsx` | 273 | Recursive memory-tree UI + keyboard nav |
| `components/memory/browse/file-tree.test.tsx` | 168 | 4 Vitest cases |
| `components/memory/browse/markdown-view.tsx` | 350 | /api/memory/file fetcher + react-markdown render + state machine |
| `components/memory/browse/search-bar.tsx` | 114 | 300ms debounced /api/memory/search with stale-drop |
| `components/memory/browse/search-results.tsx` | 143 | Grouped rg hits + truncation + highlight |
| `components/memory/browse/search-results.test.tsx` | 86 | 4 Vitest cases |
| **Total** | **1316** | |

## Test Count + Pass Rate per Suite

| File | Tests | Passed | Runtime |
|------|-------|--------|---------|
| `components/memory/browse/file-tree.test.tsx` | 4 | 4 / 4 | 88 ms |
| `components/memory/browse/search-results.test.tsx` | 4 | 4 / 4 | 62 ms |
| **Total Plan 08-04 suites** | **8** | **8 / 8** | **~150 ms** |

Full-repo vitest run: **62 / 62 tests pass** across 9 test files (up from 54 before this plan). The 4 pre-existing "failed suites" (lib/cae-nl-draft.test.ts, lib/cae-queue-state.test.ts, lib/cae-workflows.test.ts, components/workflows/step-graph.test.tsx) remain incompatible with Vitest — they use the `node:test` runner from Phase 6 and predate Vitest's introduction in Plan 08-01. Documented in 08-01-SUMMARY (Pre-existing Known Follow-ups) and out of scope per this plan's task boundary.

## Accomplishments

### Task 1 — FileTree + MarkdownView + BrowsePane composition + FileTree test suite

**FileTree (`components/memory/browse/file-tree.tsx`, 273 LOC):**
- Props: `{ nodes: MemoryTreeNode[]; selectedPath: string | null; onSelect: (absPath: string) => void; }`.
- Recursive `<ul>/<li>` render with Lucide `ChevronRight` / `ChevronDown` on branch nodes.
- Default expansion state: top-level projects + their first-level groups are expanded on first render (via `collectDefaultExpanded(nodes, depth=0, acc)` — depth ≤ 1 → `acc.add`).
- Selected leaf carries `data-selected="true"` + accent-colour border + surface-bg styling.
- Keyboard nav: ArrowDown/ArrowUp walks the flat focusable leaf list (via `collectLeafIds()` → `containerRef.current.querySelector('[data-leaf-id=...]').focus()`), Enter/Space selects, ArrowRight expands, ArrowLeft collapses.
- Empty state: `labels.memoryEmptyBrowse` in muted text.
- Dense typography: 12px mono for leaves, 13px medium-weight for branches, 8+depth\*12 pixel left-padding per depth level.

**MarkdownView (`components/memory/browse/markdown-view.tsx`, 350 LOC):**
- Props: `{ absPath: string | null; onOpenGitTimeline?: (absPath: string) => void; }`.
- 5-state machine: idle / loading / loaded / not_found / forbidden / error (mutually exclusive via tagged union).
- Fetches `/api/memory/file/<encoded-abs-path>`. URL encoding: `abs.split("/").map(encodeURIComponent).join("/")` to survive the Next 16 catchall segment pattern.
- Error copy: 404 → `labels.memoryFileNotFound`, 403 → "Not a memory source" (+ "allowlist reject" in dev mode), other → `labels.memoryLoadFailed` (+ detail in dev mode).
- Renders via `<ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>` — hand-rolled typography map covers h1/h2/h3/p/a/ul/ol/li/blockquote/code/pre/hr/table/th/td with CSS-var colours and dense→detail sizing.
- Header row shows file path (mono, muted), Git-timeline button (hidden when `onOpenGitTimeline` absent), and raw-view toggle (`<pre>` for raw source).
- Cancellation via `cancelled` boolean captured in effect closure — late-resolving fetches from a stale `absPath` are dropped.

**BrowsePane (`components/memory/browse/browse-pane.tsx`, 182 LOC):**
- Full Wave-5 prop signature declared in Task 1 per plan watch-item: `{ initialPath?, selectedPath?, onSelect?, onOpenGitTimeline? }`.
- `isControlled = controlledSelectedPath !== undefined`; when true, local state mirrors the prop; when false, seed from `initialPath` and own the state.
- `handleSelect` fires `onSelect(absPath)` **before** `setLocalSelectedPath` — so Wave-5 URL sync can intercept / cancel the transition.
- Fetches `/api/memory/tree` once on mount with cancellation guard; tree state is a tagged union (loading / loaded / error).
- Two-column layout: `<aside>` 300px fixed (SearchBar → SearchResults → FileTree), `<section>` flex-1 (MarkdownView).
- SearchBar / SearchResults imported from companion files — these are stubs in Task 1, bodies filled in Task 2 with no BrowsePane changes.

**FileTree test suite (`file-tree.test.tsx`, 4 cases, 88 ms):**
1. Empty nodes → renders empty-state copy via `data-testid="file-tree-empty"`.
2. Two-level tree → both branch levels render, clicking a leaf fires `onSelect(absPath)` with correct arg.
3. Chevron click collapses/expands a group — leaf removed from DOM when collapsed, reappears on re-expand.
4. ArrowDown from a focused leaf moves focus to the next leaf in DOM order.

All four pass under Vitest + @testing-library/react + jsdom. `useDevMode` mocked at the module level via `vi.mock("@/lib/providers/dev-mode", ...)` to avoid the real provider's throw-when-outside-context guard.

### Task 2 — SearchBar + SearchResults + SearchResults test suite

**SearchBar (`components/memory/browse/search-bar.tsx`, 114 LOC):**
- Props: `{ onResults: (hits: SearchHit[], q: string) => void; onQueryChange?: (q: string) => void; }`.
- Controlled `<input>` with `maxLength={200}` matching server-side cap.
- 300ms debounce via `useEffect` + `setTimeout` + cleanup `clearTimeout` (12-line impl in the effect body).
- Fetch URL: `/api/memory/search?q=${encodeURIComponent(trimmed)}`.
- Stale-response drop: `latestQRef.current` holds the most-recent trimmed query; before applying results, check `latestQRef.current === trimmed` — if the user has typed more chars since, the fetch result is discarded.
- Empty / whitespace query → immediate `onResults([], "")` (no fetch).
- Loading indicator: 2px pulsing accent-colored dot inside the input (right-aligned, absolute positioned). Clears on resolve.
- Explain tooltip: `<ExplainTooltip text={labels.memoryExplainSearch} ariaLabel="Explain memory search" />` — pulled from the canonical `@/components/ui/explain-tooltip` location (D-15 relocation).
- No autofocus — user decides when to type.

**SearchResults (`components/memory/browse/search-results.tsx`, 143 LOC):**
- Props: `{ hits: SearchHit[]; q: string; onSelectFile: (absPath: string) => void; }`.
- Render-state decision tree:
  - `q === ""` → return null (panel hidden).
  - `q.length > 0 && hits.length === 0` → "No matches for \"<q>\"" in muted text.
  - Otherwise → grouped display.
- Grouping via `groupByFile(hits) → Map<string, SearchHit[]>`, iteration preserves insertion order so the first file encountered in the rg output is rendered first.
- Per-file: clickable header (basename of absolute path, full path in `title` attr) → `onSelectFile(absPath)`; then up to 3 hit rows showing `<line>  <highlighted preview>`; if extra > 0, "+N more" in smaller muted text.
- Preview highlighter: case-insensitive substring split, wrapped in `<mark className="bg-transparent text-[color:var(--accent)]">`. Safe for arbitrary user input because `q` is never treated as a regex.
- Dense typography: 12px mono for content, 8-10px row padding, 11px for hit lines, 10px for "+N more" text.

**BrowsePane wiring (from Task 1, unchanged in Task 2):**
- `handleSearchResults = useCallback((nextHits, nextQ) => { setHits(nextHits); setQ(nextQ); }, [])`.
- `<SearchBar onResults={handleSearchResults} />` at the top of the left column, bordered.
- `<SearchResults hits={hits} q={q} onSelectFile={handleSelect} />` below SearchBar, above FileTree — shares the same `handleSelect` callback so clicking a search-result file selects it in the FileTree too.
- No TODO markers remain in browse-pane.tsx per the plan's verify assertion.

**SearchResults test suite (`search-results.test.tsx`, 4 cases, 62 ms):**
1. `q === ""` → `container.firstChild === null` (renders nothing).
2. `q === "foo"`, `hits = []` → `search-no-matches` testid present with "foo" in text.
3. 3 hits across 2 files → both `search-file-header-*` testids present; clicking first fires `onSelectFile("/proj/a.md")` exactly once.
4. 5 hits in one file → first 3 previews visible in `container.textContent` (cross-node match-aware), `search-more-/proj/big.md` contains "+2 more", hits 4-5 absent.

All four pass. Test 4 uses `container.textContent` flattened-text comparison instead of `screen.getByText(/.../)` because the `<mark>` highlighter splits the preview across multiple DOM nodes.

## Performance Notes

- **Tree fetch (client):** `/api/memory/tree` is hit exactly once per BrowsePane mount. The aggregator on the server side (per 08-03 perf notes) runs in <100 ms; client parse + state update is negligible.
- **Markdown render:** react-markdown 10.1 + remark-gfm 4.0 → known-fast. Typical memory file is 5-50 KB; no syntax highlighter in v1 (per D-09). Hand-rolled components map is evaluated once per render and reused across all subsequent renders of the same file.
- **Search debounce:** user's 300ms window means worst-case one fetch per ~3 keystrokes. Server-side rg spawn ~10-40 ms per 08-03 estimates + stale-response drop on the client → typing "memory consult" should fire at most 4-5 fetches.
- **FileTree keyboard nav:** `collectLeafIds(nodes)` recomputes on every nodes change via `useMemo`. For a 500-leaf tree (plan's hard cap) this is O(500) — runs in <1 ms. The flat list enables O(1) arrow-key navigation via index lookup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Plan verify grep `grep -qE 'asChild'` false-matched on documentation comments**
- **Found during:** Task 1 final verify step
- **Issue:** The plan's verify asserts `! grep -qE 'asChild' components/memory/browse/ -r` to enforce the AGENTS.md `p2-plA-t1-e81f6c` base-ui constraint. Task 1's docstrings in all three components listed "No `asChild` — base-ui isn't used here but the convention carries" as an explicit constraint-honoured bullet. The plain word `asChild` appeared in those comments, causing the verify grep to report a false positive.
- **Fix:** Rewrote the three docstrings to convey the same intent without using the literal substring: "base-ui polymorphic render is not used (see AGENTS.md p2-plA-t1-e81f6c)". No code behaviour change.
- **Files modified:** `components/memory/browse/file-tree.tsx` (comment only), `components/memory/browse/markdown-view.tsx` (comment only), `components/memory/browse/browse-pane.tsx` (comment only).
- **Committed in:** `16dfbc0` (absorbed into Task 1 commit — fix happened before commit).
- **Impact:** Identical pattern to Plan 08-03's deviations #3/#4 (graphify / commits in comments). Future plans should treat "doc-comment substrings can false-match verify greps" as a known gotcha — favour prose that describes the constraint rather than citing it.

**2. [Rule 3 — Blocking] Plan verify grep `grep -rq 'components/memory/graph'` false-matched on documentation comments**
- **Found during:** Task 1 final verify step
- **Issue:** Same class of false positive as deviation 1. Docstrings in all three Task 1 files said "No import from `components/memory/graph/*` — physical isolation with plan 08-05" to document the parallel-execution boundary. The literal path substring matched the plan's `! grep -rq 'components/memory/graph' components/memory/browse/` check.
- **Fix:** Rephrased to "Physical isolation from plan 08-05's graph tab — no cross-subdir imports" (file-tree) / "Physical isolation from the sibling graph tab plan (08-05) — no cross-subdir imports in either direction" (markdown-view, browse-pane).
- **Files modified:** Same three files as deviation 1.
- **Committed in:** `16dfbc0`.

**3. [Rule 1 — Bug] Vitest cross-node text matching broke `getByText(/.../)` assertions**
- **Found during:** Task 2 initial test run
- **Issue:** `screen.getByText(/match foo 1/)` failed on Task 2's test 4. Reason: the SearchResults highlighter splits the preview text around matches using `<mark>`, producing DOM like `"match "<mark>foo</mark>" 1"` — multiple text nodes. `@testing-library/react`'s `getByText` with a regex requires a single matching text node by default.
- **Fix:** Replaced the assertions with `container.textContent` comparison, which concatenates across text nodes and gives the flattened string. The spec is still asserting the same behaviour (first 3 hit previews present, 4th/5th absent), just via a matcher that handles split text.
- **Files modified:** `components/memory/browse/search-results.test.tsx`
- **Committed in:** `91129b5` (Task 2 commit — fix happened before commit)
- **Impact:** Documented in `tech-stack.patterns[2]` so future browse UI tests default to `container.textContent` checks when highlighted spans / badges / pills split user-visible text.

**Total:** 3 auto-fixed (2× Rule 3 verify-grep false-match, 1× Rule 1 test matcher bug). Zero Rule 2 missing-functionality, zero Rule 4 architectural changes. No CLAUDE.md violations (no project-level CLAUDE.md).

## Known Stubs

Zero. All five components are fully wired. SearchBar / SearchResults appeared as import stubs at the end of Task 1 (so BrowsePane could typecheck without being in a broken state between tasks), but Task 2 replaced the stub bodies with full implementations before commit. No placeholder text, no hardcoded empty arrays flowing to UI, no TODO markers remain in any file.

## Threat Flags

None. Plan 08-04 is purely client-side glue over endpoints that were threat-modelled in 08-03 (the server plan). No new network endpoints, no new auth paths, no new filesystem surface, no new schema touches.

## Known Visual Polish Items Deferred to Wave 7 UAT

Per plan output section, these are cosmetic items that the browse tab works fine without but could be improved in Phase 8 Wave 7 (human UAT):

- **FileTree animations:** Chevron rotate on expand/collapse is instant — could add a 150ms rotate transition for smoother feel. No impact on function.
- **Match highlight tuning:** Current cyan-on-transparent `<mark>` is subtle; may want a background tint instead of colour-only for higher contrast on mixed themes. Needs UAT to decide.
- **Mobile layout:** `w-[300px]` left column is a fixed pixel width — mobile stacking is out of scope (D-18 scope fence defers mobile to Phase 12+).
- **MarkdownView scroll-restore:** Scroll position is not preserved when switching between files via the FileTree. Minor UX issue; rg-search path likely wants different scroll behaviour than click-through-tree path anyway.
- **SearchResults file-header hover affordance:** The clickable header has a surface-bg hover but no cursor-pointer tweak beyond the default `<button>` pointer — could add an icon or underline to make the "click to select" intent more obvious.
- **Empty-state copy variety:** `memoryEmptyBrowse` is a single-string fallback; could split into "no projects" vs "project has no memory sources" once UAT surfaces which state users actually hit.

None are blockers for 08-07 (Wave 5 page shell) or 08-06 (Wave 4 drawers) to consume the Browse tab.

## Self-Check

Created files:
- FOUND: dashboard/components/memory/browse/browse-pane.tsx
- FOUND: dashboard/components/memory/browse/file-tree.tsx
- FOUND: dashboard/components/memory/browse/file-tree.test.tsx
- FOUND: dashboard/components/memory/browse/markdown-view.tsx
- FOUND: dashboard/components/memory/browse/search-bar.tsx
- FOUND: dashboard/components/memory/browse/search-results.tsx
- FOUND: dashboard/components/memory/browse/search-results.test.tsx

Commits:
- FOUND: 16dfbc0 (Task 1)
- FOUND: 91129b5 (Task 2)

Gates:
- PASS: pnpm test (8/8 Plan 08-04 tests, 62/62 total passing)
- PASS: pnpm tsc --noEmit (exit 0, zero output)
- PASS: pnpm build (exit 0, compiled successfully in 9.9s, /memory route registered)
- PASS: no asChild literal in components/memory/browse/
- PASS: no components/memory/graph path literal in components/memory/browse/
- PASS: physical isolation — zero imports from components/memory/graph/

## Self-Check: PASSED

## Next Phase Readiness

Plan 08-04 unblocks:

- **08-07 (Wave 5 page shell):** BrowsePane's full prop signature is declared — `<BrowsePane initialPath={qs.path} selectedPath={selectedPathState} onSelect={handleUrlSync} onOpenGitTimeline={openDrawer} />` will wire without refactor.
- **08-06 (Wave 4 drawers):** MarkdownView's `onOpenGitTimeline` hook is the integration point for the Git-timeline drawer. The button is already rendered when the prop is passed.

Parallel plan 08-05 (Graph tab) shares zero files with this plan — both live in disjoint `components/memory/{browse,graph}/` subdirs and consume the same Wave-2 server modules without overlap. Wave 3 is complete when both 08-04 and 08-05 land.

---
*Phase: 08-memory-global-top-bar-icon-page-graphify*
*Plan: 04 — Wave 3 Browse tab client island*
*Completed: 2026-04-22*
