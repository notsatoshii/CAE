# Phase 8 Verification — Memory + Graphify

**Date:** 2026-04-22T13:58:44Z
**Branch:** main
**Plans covered:** 08-01 → 08-07
**Verifier:** Claude executor (automated sweep + live hook smoke) + Eric (human UAT — pending)

## Summary

Six waves shipped across 7 plans (08-01 → 08-07) over roughly one working day; this
document locks Phase 8 by (a) running the full automated regression sweep across
every MEM-* requirement, (b) adding `scripts/verify-memory-hook.sh` as a
permanent end-to-end smoke that drives the real Claude Code adapter → PostToolUse
hook → memory-consult.jsonl → aggregator contract, and (c) drafting the human
UAT checklist for Eric to walk through in-browser.

The live hook smoke surfaced a real latent bug in `adapters/claude-code.sh`
(tmux-server env-inheritance swallowed `CAE_TASK_ID`) that the unit tests could
not have caught. Fixed in-session via a `tmux new-session -e CAE_TASK_ID=...`
explicit injection — WhyDrawer "Live trace" pill correlation would otherwise
have silently defaulted to `task_id="unknown"` whenever a tmux server was
already running (the common case in any long-lived dev box).

All 17 requirement rows automated-PASS; 13 visual/functional UAT gates queued
for Eric (in §Human UAT).

## Requirement coverage

| ID | Covered by | Automated | Manual | Status |
|----|-----------|-----------|--------|--------|
| MEM-01 | 08-07 | memory-client.test.tsx (5/5) + /memory in route manifest + auth redirect grep + tsc + build | UAT 1 (page loads), UAT 11 (deep-links), UAT 13 (ESC) | ✅ automated; PENDING UAT |
| MEM-02 | 08-03 + 08-04 | cae-memory-sources.test.ts (18/18) + file-tree.test.tsx (4/4) + `/api/memory/tree` force-dynamic grep | UAT 2 (file tree renders) | ✅ automated; PENDING UAT |
| MEM-03 | 08-03 + 08-04 | `/api/memory/file/[...path]` route present + markdown-view.tsx typography map | UAT 3 (markdown render w/ GFM) | ✅ automated; PENDING UAT |
| MEM-04 | 08-03 + 08-04 | cae-memory-search.test.ts (6/6) + search-results.test.tsx (4/4) + rg allowlist | UAT 4 (search hits) | ✅ automated; PENDING UAT |
| MEM-05 | 08-01 + 08-03 + 08-05 | cae-graph-state.test.ts (14/14) + no-iframe grep + graph-canvas.tsx "use client" + dagre layout pure fn | UAT 5 (graph renders) | ✅ automated; PENDING UAT |
| MEM-06 | 08-05 | graph-filters.test.tsx (3/3) — asserts exactly 4 chips, no commits chip | UAT 7 (filter chips) | ✅ automated; PENDING UAT |
| MEM-07 | 08-05 | node-drawer rendered by graph-pane; NodeDrawer exports onOpenGitTimeline prop | UAT 6 (NodeDrawer) | ✅ automated; PENDING UAT |
| MEM-08 | 08-03 + 08-05 | regenerate-button.test.tsx (4/4) — asserts 200→cooldown and 429→retry_after_ms | UAT 8 (60s debounce visible) | ✅ automated; PENDING UAT |
| MEM-09 | 08-02 + 08-03 + 08-06 + 08-07 | cae-memory-consult.test.ts (4/4) + why-drawer.test.tsx (5/5) + **verify-memory-hook.sh live PASS** | UAT 9 (Live trace pill), UAT 10 (Heuristic pill) | ✅ automated + live; PENDING UAT |
| MEM-10 | 08-03 + 08-06 | cae-memory-git.test.ts (5/5) + git-timeline-drawer.test.tsx (4/4) | UAT 12 (timeline + diff) | ✅ automated; PENDING UAT |
| MEM-W0-GRAPHIFY | 08-01 | `graphifyy` 0.4.29 installed; fixture graph.sample.json schema captured (144 nodes / 273 links) | — | ✅ automated |
| MEM-W0-DEPS | 08-01 | 4 npm deps pinned; `@xyflow/react/dist/style.css` imported exactly ONCE in globals.css | — | ✅ automated |
| MEM-W0-VITEST | 08-01 | vitest 1.6.1 + jsdom + testing-library installed; 76 tests pass across 12 Phase-8 suites | — | ✅ automated |
| MEM-W0-EXPLAIN | 08-01 | components/ui/explain-tooltip.tsx present; zero `./explain-tooltip` imports in components/metrics/ | — | ✅ automated |
| MEM-W0-GITIGNORE | 08-01 | `.cae/` present on line 10 of /home/cae/ctrl-alt-elite/.gitignore | — | ✅ automated |

## Automated sweep output

All commands run from `/home/cae/ctrl-alt-elite/dashboard` at 2026-04-22T13:48–13:59Z on branch `main`.

### Wave 0 (08-01)

- `pip show graphifyy | grep Version` → `Version: 0.4.29`
- `command -v graphify` → `/usr/local/bin/graphify`
- `grep -c '@xyflow/react/dist/style.css' app/globals.css` → `1`
- `.cae/` in CAE-root gitignore → line 10: `.cae/`
- ExplainTooltip relocation: `components/ui/explain-tooltip.tsx` present; `grep -r "./explain-tooltip" components/metrics/` returns 0 hits.
- Fixture graph.json: `nodes=144 links=273` (schema-compatible with post-D-02 walker output via `edges[]` back-compat alias).

### Wave 1 (08-02)

- `bash -n /home/cae/ctrl-alt-elite/tools/memory-consult-hook.sh` → exit 0.
- Hook script executable: mode 0755, 168 lines, 6209 bytes.
- settings.json: `hooks.PostToolUse[0].matcher == "Read"` + command points at memory-consult-hook.sh (python3 JSON validator PASS).
- adapter `export CAE_TASK_ID` on line 88; `tmux new-session` on line 136 — export precedes spawn (ordering OK).
- **NEW in 08-08:** adapter line 136 now passes `-e "CAE_TASK_ID=$CAE_TASK_ID"` to survive pre-existing tmux server env.
- Vitest `lib/cae-memory-consult.test.ts`: **4/4 pass** (11 ms).

### Wave 2 (08-03)

- 5 server modules present: `cae-memory-sources.ts`, `cae-memory-search.ts`, `cae-memory-git.ts`, `cae-graph-state.ts`, `cae-memory-whytrace.ts`, plus shared helper `cae-memory-api-helpers.ts`.
- 7 API routes present + all carry `export const dynamic = "force-dynamic"`: `tree`, `search`, `file/[...path]`, `graph`, `regenerate`, `git-log/[...path]`, `diff`.
- `memory.*` keys in `lib/copy/labels.ts`: 81 occurrences (interface + FOUNDER + DEV parity enforced by TypeScript).
- Vitest Wave-2 suites: sources (18/18), search (6/6), git (5/5), graph-state (14/14), whytrace covered via sources — total **47/47** pass.

### Wave 3 Browse (08-04)

- Files present: browse-pane.tsx, file-tree.tsx, markdown-view.tsx, search-bar.tsx, search-results.tsx.
- Every client component carries `"use client"` on line 1.
- `grep -rE '\\basChild\\b' components/memory/browse/` → 0 hits (AGENTS.md p2-plA-t1-e81f6c respected).
- Vitest: file-tree (4/4), search-results (4/4) — **8/8** pass.

### Wave 3 Graph (08-05)

- Files present: layout-dagre.ts, graph-canvas.tsx, node-drawer.tsx, graph-pane.tsx, graph-filters.tsx, regenerate-button.tsx.
- `grep -rE '<iframe' components/memory/graph/` → 0 hits (only a doc comment saying "NO iframe (D-17)" — the plan's lint acceptance).
- `grep -r '@xyflow/react/dist/style.css' components/memory/` → 0 hits (CSS lives in globals.css only).
- `grep -iqE 'commits' components/memory/graph/graph-filters.tsx` → 0 hits (D-04 enforced).
- 4 chips enumerated: phases / agents / notes / PRDs.
- Vitest: graph-filters (3/3), regenerate-button (4/4) — **7/7** pass.

### Wave 4 Drawers (08-06)

- Shared drawers at `components/memory/` ROOT (not browse/ or graph/): why-drawer.tsx, git-timeline-drawer.tsx, diff-view.tsx.
- `grep -rq dangerouslySetInnerHTML components/memory/diff-view.tsx` → 0 hits.
- Vitest: why-drawer (5/5), git-timeline-drawer (4/4) — **9/9** pass.

### Wave 5 Page shell (08-07)

- `/memory/page.tsx` is server component: first line `import { auth } from "@/auth";`, no `"use client"`.
- `/memory/memory-client.tsx` is client component: first line `"use client";`.
- `redirect("/signin?from=/memory")` present (auth gate).
- Drawer + tab mounts in memory-client.tsx: `@base-ui/react/tabs` (1), `<WhyDrawer` (2 — type + usage), `<GitTimelineDrawer` (2), `<BrowsePane` (2), `<GraphPane` (2), `useSearchParams` (2).
- `lib/cae-memory-path-match.ts` client-safe extract present; `grep node:fs` matches only a doc comment explaining WHY the extract exists — no real Node imports.
- Vitest: memory-client.test.tsx — **5/5** pass.

### Live hook smoke (verify-memory-hook.sh)

- **Result:** PASS (exit 0) on 2026-04-22T13:58:44Z after the in-session adapter fix.
- Invocation: fresh `mktemp -d`, seeded `AGENTS.md` with a unique verify marker, wrote a minimal system prompt + user task, ran `adapters/claude-code.sh` with `claude-sonnet-4-6`.
- Claude made 2 turns, 146 output tokens, returned the exact marker token — confirming it invoked the Read tool rather than relying on the prompt cache.
- `memory-consult.jsonl` captured 1 line: `{"ts": "2026-04-22T13:58:44Z", "event": "memory_consult", "source_path": "/tmp/phase8-verify-kDTdiR/AGENTS.md", "task_id": "p8-verify"}` — task_id correctly derives from the task file's basename.
- All four assertions green: jsonl exists, ≥1 line, `task_id=p8-verify`, event=`memory_consult`, `AGENTS.md` referenced.

### Build + runtime

- `pnpm tsc --noEmit`: exit 0, zero output.
- `pnpm build`: exit 0. All Phase-8 routes compiled as dynamic handlers:
  - `ƒ /memory`
  - `ƒ /api/memory/tree`, `ƒ /api/memory/search`, `ƒ /api/memory/file/[...path]`, `ƒ /api/memory/graph`, `ƒ /api/memory/regenerate`, `ƒ /api/memory/git-log/[...path]`, `ƒ /api/memory/diff`, `ƒ /api/memory/consult/[task_id]`.
- `pnpm test`: **76/76** tests pass across **12 Phase-8 suites**. Four pre-existing Phase-6 `node:test` suites (`lib/cae-nl-draft.test.ts`, `lib/cae-queue-state.test.ts`, `lib/cae-workflows.test.ts`, `components/workflows/step-graph.test.tsx`) continue to report `No test suite found` — documented since 08-01-SUMMARY as a Wave-0 follow-up (node:test → Vitest conversion) and explicitly out-of-phase per the 08-01 plan scope. Zero regressions on the 76 Vitest-native cases.
- Live `/api/memory/consult/p8-verify` curl against the running dev server on :3002 returns **HTTP 401 + `{"error":"unauthorized"}`** (correct — route is auth-gated; authenticated access verified as part of UAT gate 9/10).

## Human UAT (checklist)

Record PASS / FAIL under each gate. If any gate FAILs, type `gaps: <description>` to trigger a `--gaps` follow-up plan.

### UAT 1 — `/memory` loads under authenticated session
Sign in at `http://localhost:3002/signin` → Metrics / Memory icon in top bar → visit `/memory` → Browse tab active by default, heading "Memory" visible.

- [ ] Pass / Fail
- Notes:

### UAT 2 — Browse tab renders file tree of all projects
File tree in the left column groups by project (ctrl-alt-elite, cae-dashboard, bridge-test-repo if present). Top-level + first-level groups expanded on first render.

- [ ] Pass / Fail
- Notes:

### UAT 3 — Markdown renders with GFM
Click `AGENTS.md` → right pane shows rendered markdown. Tables, task-lists, strikethrough, code blocks all render (GFM via remark-gfm).

- [ ] Pass / Fail
- Notes:

### UAT 4 — Search matches files across projects
Type `sentinel` (or another common term) in the search bar → within ~300 ms hits render grouped by file with cyan-highlighted matches. Typing a term with no hits shows "No matches for …".

- [ ] Pass / Fail
- Notes:

### UAT 5 — Graph tab renders canvas OR empty state
Switch to Graph tab. If `/home/cae/ctrl-alt-elite/.cae/graph.json` doesn't exist yet, expect empty state with Regenerate CTA. If it exists, expect nodes + edges laid out via dagre LR rankdir.

- [ ] Pass / Fail
- Notes:

### UAT 6 — Clicking a node opens NodeDrawer with back-links
Click any node → right-side drawer opens with kind badge, label, source-file copy button, back-links list (edges where `target === node.id`) and forward-refs (edges where `source === node.id`).

- [ ] Pass / Fail
- Notes:

### UAT 7 — Exactly 4 filter chips (NO commits chip)
Filter row shows `phases / agents / notes / PRDs` — confirm there is NO fifth "commits" chip (D-04). Each chip displays `(count)` suffix. Clicking toggles the chip's active state.

- [ ] Pass / Fail
- Notes:

### UAT 8 — Regenerate 60s debounce visible
Click Regenerate. Button shows "Regenerating…", then success toast. Graph reloads. Click again within 60 s → button shows countdown "Ready in Xs". Wait out the window → enabled again. Force a second rapid click → `POST /api/memory/regenerate` returns 429 with `retry_after_ms`.

- [ ] Pass / Fail
- Notes:

### UAT 9 — "Why?" Live-trace pill on a real Forge task
1. Run a Forge task via the Build queue (or directly via `adapters/claude-code.sh` from a CAE project with `.cae/metrics/`) that reads at least one memory source (e.g. AGENTS.md).
2. After completion, locate that task's id. Open `http://localhost:3002/memory?task=<task_id>`.
3. Expect WhyDrawer to open on mount with the **cyan "Live trace" pill** + per-row entries listing the source paths + timestamps.

**Load-bearing:** depends on the adapter fix shipped in this plan (`tmux new-session -e CAE_TASK_ID=...`). Any Forge task run BEFORE the 08-08 adapter commit will have `task_id="unknown"` in its jsonl rows and won't round-trip through `/api/memory/consult/[task_id]`.

- [ ] Pass / Fail
- Notes:

### UAT 10 — "Why?" Heuristic-fallback pill on a pre-hook task
Open an OLDER task's Why (one that ran before the PostToolUse hook shipped in plan 08-02). Expect the amber **"Heuristic — no trace captured"** pill + the `filesModified ∩ memory-source-globs` fallback list.

Note (carried from 08-06 UAT flag): `filesModified` currently flows in from the MemoryClient caller. In v1 the only live caller path is the `?task=<id>` deep-link, which doesn't know `filesModified`. Pre-hook tasks therefore fall to empty state (Path C) unless a future integration (Phase 9 Changes rail) surfaces `filesModified` from the task's DONE.md. This is documented in 08-07-SUMMARY Flag 5 and remains a known gap for demo day.

- [ ] Pass / Fail
- Notes:

### UAT 11 — Git timeline + diff
From either a Browse file header or a Graph NodeDrawer, click "Git timeline" → drawer opens with `git log --follow` for that file. Pick exactly 2 commits → "Show diff" enables → clicking it renders colored diff (green additions, red deletions) with a 2000-line cap banner if applicable. Clipboard-copy emits the full diff (not the truncated subset).

- [ ] Pass / Fail
- Notes:

### UAT 12 — Deep-link query params
Visit each URL and verify behaviour:
- `/memory?view=graph` → Graph tab active on mount.
- `/memory?path=/home/cae/ctrl-alt-elite/AGENTS.md` → Browse tab, file selected + markdown rendered.
- `/memory?task=<real-task-id>` → WhyDrawer auto-opens.
- `/memory?timeline=/home/cae/ctrl-alt-elite/AGENTS.md` → GitTimelineDrawer auto-opens.

- [ ] Pass / Fail
- Notes:

### UAT 13 — ESC closes all drawers; Dev-mode flip
Open each drawer → ESC closes it, focus returns to the trigger. Press **Ctrl+Shift+D** → labels flip from founder to dev copy (e.g. `"Ready in 45s"` → `"cooldown 45s"`, "Browse" → technical variant). Press again → flip back. Explain-mode tooltips (`?` buttons near headings) open on click, dim on Ctrl+E, flip body copy on dev-mode toggle.

- [ ] Pass / Fail
- Notes:

## Live hook demo (critical)

Run from the dashboard dir:

```
cd /home/cae/ctrl-alt-elite/dashboard
bash scripts/verify-memory-hook.sh
```

Expect a PASS banner. If this fails on your machine:
1. Confirm `claude` and `tmux` are on PATH.
2. Confirm `/home/cae/ctrl-alt-elite/.claude/settings.json` registers memory-consult-hook.sh.
3. Confirm `adapters/claude-code.sh` line 136 carries the `-e "CAE_TASK_ID=$CAE_TASK_ID"` injection.

If the operator ran a real Forge task in the last hour that read any memory source, ALSO visit `/memory?task=<that-task-id>` and verify the WhyDrawer renders the cyan "Live trace" pill + captured entries with timestamps inside the task's runtime window.

## Deviations from plan (surfaced during automated sweep)

**1. [Rule 1 — Bug] `adapters/claude-code.sh` CAE_TASK_ID was not propagating into the claude subprocess**

- **Found during:** Initial `verify-memory-hook.sh` live-smoke run.
- **Symptom:** The hook fired correctly (AGENTS.md was captured, event=memory_consult), but every row had `"task_id": "unknown"` instead of the expected `"p8-verify"` basename.
- **Root cause:** When a tmux server is already running on the host (common — the dev box has sessions from March 2026), `tmux new-session -d -s NAME CMD` asks the existing server to spawn the new pane from its own captive environment, NOT the caller's. The adapter's `export CAE_TASK_ID="$TASK_ID"` on line 88 therefore never reached the claude subprocess or its PostToolUse hook.
- **Fix:** Added `-e "CAE_TASK_ID=$CAE_TASK_ID"` to the `tmux new-session` invocation on adapter line 136. This explicitly injects the var into the new session's env regardless of whether tmux reused an existing server or spawned a fresh one. Added a 10-line comment above the call documenting the server-boundary issue so no one strips the `-e` flag thinking it's redundant with `export`.
- **Files modified:** `/home/cae/ctrl-alt-elite/adapters/claude-code.sh` (1 line changed + 10-line comment added).
- **Impact on feature:** Without this fix, WhyDrawer "Live trace" pill correlation would silently degrade to `task_id="unknown"` on every boxes with a long-running tmux server — i.e. all of production. The UAT gate for MEM-09 (Live trace pill) would have failed even after UAT-person ran a real Forge task.
- **Verification:** Post-fix, `bash dashboard/scripts/verify-memory-hook.sh` → PASS with `task_id=p8-verify` on exactly 1 captured row.
- **Commit:** pending (included in 08-08 final metadata commit).

**2. [Rule 1 — Bug] Plan's smoke-script skeleton used wrong model ID (`claude-sonnet-4.6` vs `claude-sonnet-4-6`)**

- **Found during:** First smoke run — adapter returned exit 1 with `api_error_status:404` and the message "It may not exist or you may not have access to it".
- **Fix:** Corrected model ID to `claude-sonnet-4-6` (hyphenated, matching CONFIG_SCHEMA.md + config/agent-models.yaml).
- **Impact:** Script was unable to run end-to-end as-written from plan skeleton. One-character change.

**3. [Rule 1 — Bug] Smoke script's initial prompt structure didn't force the Read tool to fire**

- **Found during:** Second smoke run — claude returned the AGENTS.md content summary in its response but never invoked the Read tool (hook never fired, jsonl never created).
- **Root cause:** Plan's original skeleton passed the task file as both user-prompt stdin AND system-prompt-file. Claude saw the file contents inline in its system prompt and answered directly without needing to Read anything.
- **Fix:** Separated the two. System prompt is now a terse "file-inspection assistant" persona; user prompt explicitly requires Read of a named file; AGENTS.md contains a unique verify-marker token that's demonstrably NOT in the system prompt, so the model has to open the file to answer correctly.
- **Impact:** Smoke script now reliably forces a Read tool call on every run.

**4. [Rule 3 — Blocking] Test WORK dir had no project-scope `.claude/settings.json`**

- **Found during:** Third smoke run — adapter exited 0, claude returned the correct marker (so Read fired), but memory-consult.jsonl was never created.
- **Root cause:** Claude Code merges user-scope settings (`/root/.claude/settings.json`) with project-scope (`<cwd>/.claude/settings.json`). When the adapter's cwd was `/tmp/phase8-verify-XXXX`, Claude only loaded user-scope — and that file does NOT register memory-consult-hook.sh. Every Read tool call was therefore un-hooked in the smoke environment (but would fire correctly from CAE_ROOT because the project-scope settings.json there DOES register the hook).
- **Fix:** Smoke script now writes a minimal `$WORK/.claude/settings.json` containing only the PostToolUse Read matcher pointing at the hook script. No `defaultMode` (it would force `--dangerously-skip-permissions` which claude refuses as root).
- **Impact:** Smoke script now reproduces the real production hook chain for any cwd. Documented in the script's header comment so the next person reading it understands why the inline settings.json is necessary.

## Known out-of-scope / follow-ups (tracked, NOT Phase-8 blockers)

- **4 Phase-6 legacy test files still fail under Vitest** (`lib/cae-nl-draft.test.ts`, `lib/cae-queue-state.test.ts`, `lib/cae-workflows.test.ts`, `components/workflows/step-graph.test.tsx`). Each is a pre-Vitest `node:test`-format suite. Vitest correctly reports `No test suite found`. Documented since 08-01 (Wave 0); node:test → Vitest conversion is a cross-phase chore that belongs in its own `--gaps` plan.
- **Heuristic WhyDrawer `filesModified` wiring** (carried from 08-06 + 08-07 UAT flags). The callback contract is stable but no caller in Phase 8 passes `filesModified` from a task's DONE.md. Phase 9 (Changes tab / chat rail) is the natural home. For the demo the live-trace path is sufficient; pre-hook tasks fall to empty-state (Path C) instead of heuristic (Path B).
- **Working tree had 2 uncommitted planning files + 1 uncommitted config at plan start** (`.planning/STATE.md`, `.planning/ROADMAP.md`, `next.config.ts`) plus an untracked `dashboard/scripts-temp-copy-flip.ts` and sibling `../.planning/herald/`. Per the execute scope boundary + this plan's explicit "Do NOT update STATE.md or ROADMAP.md" directive, none were touched. Orchestrator reconciles.
- **Dev-server `.next-build-output` side-effect:** first `pnpm build` after the 08-07 plan's pane additions printed a one-off turbopack NFT warning inherited from Phase 7 — non-blocking, non-new, documented in Phase-7 VERIFICATION.

## Gaps / follow-ups

None discovered during automated sweep. The 4 auto-fixed deviations above were all closed in-session. Any failures surfaced during human UAT should be captured below with a follow-up plan number (`08-09+`) or accepted-deviation rationale.

## Sign-off

- **Automated:** PASS — 2026-04-22T13:58:44Z.
  - 76 / 76 Vitest tests across 12 Phase-8 suites.
  - `pnpm tsc --noEmit` exit 0.
  - `pnpm build` exit 0; every Phase-8 route registered.
  - `bash scripts/verify-memory-hook.sh` PASS with `task_id=p8-verify` captured.
  - `curl /api/memory/consult/p8-verify` returns 401 (auth gate wired correctly).
  - 4 in-flight bugs auto-fixed (1 adapter fix pushed into `/home/cae/ctrl-alt-elite/adapters/claude-code.sh`; 3 script-side fixes in the new `scripts/verify-memory-hook.sh`).

- **Manual (Eric):** PENDING — walk the 13 UAT gates above.

- **Merge-ready:** conditional on the 13 UAT gates.

---

*Phase: 08-memory-global-top-bar-icon-page-graphify*
*Plans covered: 08-01 through 08-07*
*Verifier: Claude executor (automated) + Eric (human UAT, deferred)*
