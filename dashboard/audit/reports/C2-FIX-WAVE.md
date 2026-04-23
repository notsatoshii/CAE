# C2 → C3 Fix Wave

**Cycle in:** C2 (2026-04-23, 408 cells × 6 pillars scored)
**Cycle out:** C3 (pending)
**Methodology:** group all C2 findings by root cause; one commit per class;
                 estimate cell-lift; execute top-down by impact; verify via C3 delta.

---

## Pillar score distribution (C2)

| pillar | 1 | 2 | 3 | 4 | 5 | stuck at placeholder |
|--------|---|---|---|---|---|---------------------|
| truth | 408 | 0 | 0 | 0 | 0 | — |
| depth | 214 | 15 | 0 | 0 | 0 | 179 unscored |
| liveness | 291 | 102 | 14 | 0 | 0 | 1 unscored |
| reliability | 0 | 0 | 5 | 0 | 403 | — |
| craft | 0 | 0 | 408 | 0 | 0 | yes (needs vision) |
| ia | 0 | 0 | 408 | 0 | 0 | yes (needs clickwalk) |

---

## Fix classes (ordered by cell-impact)

### Class 1 — Truth pillar: pages captured mid-load ✅ DONE

**Cells affected:** 408/408 (100%)
**Status:** fixed in commits `09e3d00` + `b17209b` (pre-wave).
**Root cause:** runner took screenshot before SSE hydrated `data-truth=".healthy=yes"`. Fixture `readExpectedTruth()` encodes post-fetch values; pre-fetch markup holds `.loading=yes`, so every key drifted.
**Fix:** `waitForTruthSettled()` loops the active fixture's expected `.healthy=yes` keys with bounded timeout (default 6s, env `AUDIT_TRUTH_SETTLE_MS`). Static fixture imports so the waiter actually executes in worker context.
**Expected C3 lift:** truth 1 → 4+ on most cells (408 cells re-scored).
**Top drift keys that should flip:**
- `mission-control.active-count` (408 cells)
- `live-activity.last-24h-count` (408)
- `mission-control.healthy` (406)
- `live-activity.healthy` (406)
- `mission-control.empty` (395)

**Verify via C3:** rollup `truth` pillar mean ≥ 4.0, top-5 drift keys present on <10% of cells.

---

### Class 2 — Reliability: API routes redirect to HTML signin page ✅ DONE (pending commit)

**Cells affected:** 5/408 (reliability score 3 cluster; concentrated on unauthed surfaces — `/signin`, `/403`, and any route hit without a valid session).
**Root cause:** `middleware.ts` treated unauthed API calls same as page calls — emitted `307 redirect → /signin?from=...` with absolute URL. Browser's `fetch()` auto-follows the redirect, hits a cross-origin `/signin` HTML page (when `AUTH_URL` env points at public IP), and CORS blocks the fetch. Console spams CORS errors → reliability floor.
**Fix:**
1. `middleware.ts`: return `401 JSON` for any `/api/*` route on unauth, keep redirect for page routes. Cross-origin redirects can't round-trip `fetch()` credentials anyway.
2. `lib/hooks/use-state-poll.tsx`: short-circuit interval on first `401` so unauthed surfaces (e.g. `/signin`) stop polling every 3s forever.

**Expected C3 lift:** reliability 3 → 5 on the 5 stuck cells; clean console on `/signin` and `/403` captures.

**Files:**
- `dashboard/middleware.ts` — unauth branch splits API vs page
- `dashboard/lib/hooks/use-state-poll.tsx` — clearInterval on 401

---

### Class 3 — Liveness: most components emit zero liveness markers

**Cells affected:** 291/408 (71%) at score 1 (0/5 markers: `none`). Another 102 at score 2.
**Root cause:** the scorer counts `data-liveness=*` attributes rendered on the page (set of `loading`, `empty`, `stale`, `healthy`, `error`). Only a handful of components (rollup-strip, liveness-chip, active-phase-cards) emit them. Surfaces like `/metrics`, `/memory`, `/chat`, `/plan`, `/floor`, `/build/skills`, `/build/workflows` render static markup with no liveness annotation → 0/5.
**Top missing marker combos:**
- 184 cells: `(none)` — 0 markers at all
- 62 cells: only `healthy` — no loading/empty/stale states annotated
- 74 cells: `empty,healthy` — missing loading + stale
- 30 cells: only `loading` — fixture-unhappy or pages loading forever

**Proposed fix (one commit per surface, grouped under this class):**
Add `<LastUpdated>` + `<LivenessChip>` primitives to every data-backed panel in these surfaces:
- `/metrics` panels (spending / how-well / how-fast)
- `/memory` browse + graph
- `/chat` rail + panel
- `/plan` projects / PRDs / roadmaps / UAT
- `/build/skills` + `/build/workflows` + `/build/security`
- `/build/queue` KANBAN columns
- `/build/changes` timeline rows
- `/floor` + `/floor/popout`

Each panel exposes: `data-liveness="loading"` while awaiting first fetch, `empty` if no rows, `stale` if `lastUpdated > 60s`, `healthy` otherwise, `error` on fetch failure.

**Expected C3 lift:** liveness 1 → 3+ on most affected cells (target ≥3 on 350/408 cells).

**Scope:** ~15-20 components touched. Execute as a sub-wave (3A/3B/3C) to keep commits reviewable.

---

### Class 4 — Depth: 179 cells at unscored-0 (`depth` column missing)

**Cells affected:** 179/408 have no `depth` score at all; 214 at score 1 (`0/12 data-truth keys rendered`); 15 at score 2.
**Root cause (hypothesis):** access-gated pages (admin-only, operator-only) render `/403` redirect for non-admin personas, producing surfaces with zero data-truth keys. Fixture-persona mismatch: e.g. `founder-first-time` persona landing on `/build/admin/roles` just sees 403.
**Classification needed:** route × persona expected-access matrix. If cell was expected to be gated, don't score depth against expected data keys (score as N/A, not 1). If cell was expected to render, data is genuinely missing.
**Proposed fix:**
- Add `audit/fixtures/persona-access.ts` mapping persona × route → `{expected: "gate" | "render" | "redirect"}`.
- `score/pillars.ts` depth scorer: if expected=gate and cell navigated to /403, score as `N/A` (exclude from rollup).
- If expected=render and keys rendered = 0, keep score 1 (genuine bug).
**Expected C3 lift:** depth 1 → N/A on ~80 cells (rollup improves without code change); remaining ~130 cells at score 1 surface real bugs to fix in Class 5.

**Defer:** this is harness work, not app code. Slot after Classes 2 + 3 land.

---

### Class 5 — Craft pillar: placeholder 3, awaiting vision

**Cells affected:** 408/408 at placeholder 3.
**Status:** vision retro-run in background (pid 485503, log `audit/logs/vision-C2-20260423-212908.log`). ~3hr serial, CLI transport via Max plan, no USD bill.
**Fix after completion:** vision findings surface per-cell craft bugs (hierarchy, density, consistency, motion, typography, color). Group those into Class 5A/5B/5C sub-waves in a `C2-VISION-FIX-WAVE.md` supplement.

---

### Class 7 — Left rail + icon-bar labels missing + no collapse toggle (Eric, this session)

**Cells affected:** all routes that mount the left rail (BuildRail on `/build/*`,
PlanRail on `/plan/*`) and the global top-bar icon cluster (Memory, Metrics,
Chat, Floor, Skills, Security, Admin).
**Eric's complaint (verbatim):** "current left side tab and other icons have
no labels so I can't know WTF they are. If I want to go from with labels to
just icons there should be minimizable menu but there currently isn't."
**Root cause:** rail was built icon-only with `title`-attr tooltips (only
visible on hover, invisible on touch). Top-bar icons same. No `aria-label`
audit either → screen reader unhappy.
**Proposed fix:**
1. **Default state: labeled.** Rail renders `icon + label` stacked or side-by-
   side. Top-bar icons show label beneath (like Linear / Raycast).
2. **Collapse toggle.** Small chevron at rail top-left. Click = rail shrinks
   to icon-only (64px wide). Click again = expand to labeled (220px wide).
   Persist in localStorage (`cae.rail.collapsed`).
3. **Icon-only mode keeps hover tooltips** (shadcn Tooltip, not `title`-attr)
   so labels are still reachable.
4. **Keyboard:** `⌘\` toggles collapse (VSCode convention). Add to
   KeyboardShortcuts overlay.
5. **Top-bar icons:** always show label below icon (12px Geist Mono, muted).
   Non-collapsible — the top-bar is already dense.

**Files to touch:**
- `components/shell/build-rail.tsx` (+ `plan-rail.tsx` if separate)
- `components/shell/top-nav.tsx` / top-bar icon cluster
- `lib/hooks/use-rail-collapsed.ts` (new)
- `app/layout.tsx` to mount provider
- `components/ui/command-palette.tsx` to register `⌘\` shortcut
- `lib/copy/labels.ts` → `rail.*` keys for each tab label

**Expected C3 lift:** IA pillar once clickwalk runs — labeled nav = higher
reachability confidence. Also improves `craft` via vision (hierarchy + copy).

**Severity:** P0 — Eric can't navigate without guessing. Ship before next
persona demo.
**Estimated scope:** one focused commit. ~2hr.

---

### Class 6 — IA pillar: placeholder 3, awaiting clickwalk

**Cells affected:** 408/408 at placeholder 3.
**Status:** clickwalk run not yet executed (`AUDIT_CLICKWALK=1 audit/run-cycle.sh C3 healthy --prior C2 --vision`).
**Fix after completion:** reachability map per route × persona. Broken nav paths + orphan pages surface here.

---

### Class 8 — Pixel-agents broken on /floor + Build-home FloorPin

**Cells affected:** every `/floor` + `/floor/popout` cell + `/build` home
FloorPin (~50 cells potentially). Flagged P0 in session-10 backlog.
**Root cause (hypothesis, needs repro):**
- Event-adapter may not be consuming `circuit-breakers.jsonl` correctly
- Canvas may not mount (`<canvas>` absent or zero dims)
- Heartbeat-emitter may not fire synthetic beats when breakers idle
- cbPath could be null → idle scene
**Proposed fix approach:**
1. Open browser DevTools on `/floor` + compare vs `/build` FloorPin — grab
   console errors + Network tab SSE state
2. Confirm canvas element present with non-zero dims
3. Trace `useFloorEvents` → `/api/tail/circuit-breakers` → JSONL parse
4. Fix root cause (single point in chain, not a shotgun)
**Expected C3 lift:** reliability + depth + liveness on /floor cells.
**Severity:** P0 (session-10 blocker).
**Slot:** after Classes 3+7 land. Needs browser repro.

---

### Class 9 — Chat hydration mismatch (admin · mobile + wide)

**Cells affected:** 2 cells (admin · mobile · /chat, admin · wide · /chat).
Laptop OK. Non-fatal — React patches but logs warning.
**Root cause:** `useDevMode()` in `app/chat/chat-layout.tsx` reads
localStorage/cookie client-only state that flips aria-label between
server + client render.
**Proposed fix:** (choose one)
- (a) Gate `labelFor(dev)` behind a `useEffect`-mount flag so server render
  uses default labels, client promotes to dev-mode labels on mount.
- (b) Read dev-mode cookie on the server (via `cookies()` in Server
  Component) and pass as prop — zero hydration mismatch.
  Preferred: (b). Cleaner, no post-mount flash.
**Expected C3 lift:** reliability on 2 cells + clean console log.
**Severity:** narrow, cosmetic. Ship with next chat-adjacent commit.

---

### Class 10 — SSE unread-count regression (WR-01)

**Cells affected:** chat rail cells across all personas.
**Status:** fix claimed shipped in `13-04-PLAN.md` (Wave 4 Phase 13),
but session-10 C1 baseline still showed unread count stuck at 0. Needs
re-verify — may have regressed or original fix didn't cover this path.
**Proposed fix:** re-run the isolation test: open /build, send message from
admin, confirm rail unread-dot + count both advance. If broken: trace
SSE `id` stability + client `assistantMsgId` promotion.
**Severity:** single regression, surfaces every chat-rail cell.
**Slot:** after Class 3 (touches chat surface anyway).

---

### Class 11 — Voice pillar scorer not wired

**Cells affected:** 0 today (pillar not in cycle). BUT: absence means every
cycle ships without grading copy/tone/founder-speak. Known hole.
**Proposed fix:**
1. Add `audit/score/llm-voice.ts` — grades `data-label-*` extracts + prose
   via LLM against the founder-speak rubric.
2. Wire into `audit/score-run.ts` cycle.
3. Produce `CN-VOICE-FINDINGS.md` per cycle.
4. Voice pillar target: mean ≥ 4.0 on founder personas.
**Severity:** systemic hole. Not a regression — never scored.
**Slot:** C4+. Spec in follow-up wave doc.

---

### Class 12 — Herald runs blocked under root user

**Cells affected:** 0 (infrastructure, not audit-visible). But Herald
post-commit hook writes logs every commit; under root the `claude`
CLI refuses `--dangerously-skip-permissions` → hook fails silently.
**Proposed fix options:**
- (a) Run dashboard as non-root user (cleaner, requires box reconfig)
- (b) Patch adapter to skip `--dangerously-skip-permissions` under root
- (c) Document as "Herald offline under root" + accept doc staleness
  until the box is reconfigured
**Severity:** low (docs go stale, not a user-visible bug).
**Slot:** ops task, deprioritise below code classes.

---

### Class 13 — UI lacks visual depth (Eric session 12, 22:40 KST)

**Cells affected:** all 408 cells indirectly (hurts craft rollup broadly —
vision flagged "flat cards", "no separation", "massive empty canvas" on
many routes; these are depth symptoms).
**Eric's complaint verbatim:** "the entire UI lacks depth."

**Root cause:** no elevation system. Hairline-border cards + no shadows
+ zero backdrop blur + flat color palette with uniform bg → everything
reads as a single flat paint layer. Linear/Vercel/Raycast establish
depth via shadow tokens (close+far layered), backdrop blur on overlays,
and hover-scale + elevation bump on interactive surfaces.

**Proposed fix:**
1. **Elevation tokens** — add `--elevation-{0,1,2,3,4}` to
   `app/globals.css`, each a layered shadow (close tight shadow + longer
   soft shadow). Use 4 levels: baseline, card, raised-panel, modal,
   toast/palette.
2. **Replace hairline borders with elevation-1** on primary cards
   (build-home rollup, agent cards, metrics panels). Borders stay for
   inputs + separators only.
3. **Backdrop blur** on modal/sheet/dialog scrim:
   `backdrop-filter: blur(12px)`. Glass layering over dimmed underlay.
4. **Hover states** — cards get `hover:scale-[1.01] + elevation bump
   1→2`, 150ms ease. Click = `active:scale-[0.99] + elevation drop`.
5. **Focus-dim** — when sheet/modal opens, underlying page dims to
   `brightness(0.7) + blur(2px)`. Perceived receding background.
6. **Gradient vignettes** on long surfaces (rail top/bottom, changes
   timeline edges) — fade to bg implies content continues in z.
7. **Layer hierarchy enforced:**
   - top-bar + rail: `elevation-1`
   - page content: `elevation-0`
   - drawers/sheets: `elevation-3`
   - command palette: `elevation-4`
   - modals: `elevation-3`
   - toasts: `elevation-4`

**Expected C4 craft lift:** +0.5 to +1.0 (currently 2.93, target ≥3.8).
Vision should stop flagging "flat", "no separation", "no hierarchy".

**Scope:** ~15-25 components touched. Split into sub-waves:
- 13A — elevation tokens + Panel primitive + Card primitive bump
- 13B — Rail + top-bar elevation + overlay blur + command palette
- 13C — Build surfaces (home rollup, agent cards, kanban, task sheet)
- 13D — Remaining (metrics panels, memory cards, chat rail, modals)

**Severity:** P0 aesthetic — Eric flagged explicitly. Ships before C4.

---

## Execution order

1. **Class 2 commit** (this turn — pending) — API 401 + hook short-circuit.
2. **Class 3A** — liveness primitives (`<LastUpdated>`, `<LivenessChip>`) audit: confirm what's mounted. Split into 3A (/metrics + /memory + /chat), 3B (/plan + /floor), 3C (/build/skills + /workflows + /security + /queue + /changes).
3. **Class 4 harness patch** — persona-access matrix + depth N/A rule.
4. **C3 cycle** — `audit/run-cycle.sh C3 healthy --prior C2 --vision` (waits for Class 5 vision). Must have 8G swap on OR `AUDIT_WORKERS=2`.
5. **C3 delta** — verify each class closed its claimed cell-lift. Reclassify any residual.
6. **Class 5 + 6 waves** from vision + clickwalk findings.

---

## Invariants / traps

- **Do not** chase per-cell bugs until vision completes. Vision surfaces craft issues that will restructure components — fixing a cell-specific hierarchy thing pre-vision risks re-fix after vision recs land.
- **Do not** re-run C2 after committing class fixes. Next cycle is C3 (new label = new baseline to diff against).
- **Do add swap** before C3 (see `project_cae_dashboard_session11` OOM gotcha). 8G added this session.
- **Commits must be class-tagged.** Format: `audit(C2-wave/CLASSN): <what>`. Makes C3 delta attribution clean.
