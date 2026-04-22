# Phase 13 — CONTEXT

**Source:** no `/gsd-discuss-phase` session ran. Context synthesized from:
- `13-RESEARCH.md` (2026-04-22 — original 6-pillar visual audit spec)
- `13-ERIC-CRITIQUE.md` (2026-04-23 — Eric's live-use critique)
- `13-MISSION-CONTROL-NOTES.md` (2026-04-23 — reference repo comparison)
- `reference/overview.png` + `reference/agents.png` (MC screenshots)
- `docs/UI-SPEC.md` (project design law)
- `HANDOFF.md` session 5 (ship state)

Mode: constructive override — the original research was accurate but too narrow. Eric's critique shifts the scope from cosmetic audit to **correctness-first audit**. Mission Control notes add IA comparison as a sixth axis. Visual 6-pillar (the original spec) becomes the LAST step, not the first.

## Phase goal (outcome, not task)

A measurably correct, live, complete, debuggable, and visually-polished CAE Dashboard. Validated by a before/after Opus 4.7 delta pass showing:

1. **Zero P0 data-correctness mismatches** between displayed values and source-of-truth files.
2. **Every live display** polling-validated (interval ≤ its own staleness claim) or SSE-validated.
3. **Every interactive control** wired to a verified handler; no silent no-ops.
4. **Logging surfaced** in both browser + server with severity + structure sufficient to debug any of the bugs this phase itself uncovers.
5. **Mission Control IA wins adopted** where clear-win (Golden Signals, Incident Stream panel, card+action-verb agent grid, ambient clock/latency chip).
6. **6-pillar visual rubric** scoring ≥ 3/4 on hierarchy, typography, spacing, color, affordance, consistency across all shipped surfaces.

## Decisions (LOCKED — non-negotiable)

### D-01 — Scope expansion beyond visual audit
Phase 13 now covers six audit axes, in this order:

1. DATA CORRECTNESS (P0 — every number displayed verified against its source file)
2. LIVENESS (polling intervals, SSE streams, cache TTLs measured against claims)
3. FUNCTIONALITY COMPLETENESS (click-through every interactive)
4. LOGGING / DEBUG (browser console + server stdout noise/gap analysis)
5. MISSION CONTROL IA COMPARISON (route-by-route against MC)
6. 6-PILLAR VISUAL (hierarchy, density, consistency, motion, typography, color)

Deliverable per axis: `UI-AUDIT-{axis}.md` with ranked findings.

### D-02 — Fix order = correctness first, polish last
Correctness/liveness/functionality/logging findings are P0. IA + visual are P1-P2. Wave 5 execution pulls from the merged backlog but Sonnet executes P0 before P1 before P2.

### D-03 — Screenshot + vision tooling
Use global CLIs `screenshot-url` (Playwright Chromium, already installed at `/usr/local/bin/screenshot-url`) and `scrape-url` where page HTML is needed. Claude reads PNGs directly via Read tool (multimodal). **Do not install Playwright as a project dep unless a full test harness is required** — the global CLI suffices for ~200 screenshots.

### D-04 — Opus 4.7 for all judgment passes
Data-correctness verification, vision audits, self-critique, delta re-audit, and fix-planning all use Opus 4.7. Sonnet 4.6 is permitted only for Wave 5 fix execution and for Wave 0 harness setup. Already encoded in `.planning/config.json` model_overrides — no new entries needed for this phase, but Wave 2+ planning/auditing steps that spawn agents must pass the Opus model explicitly.

### D-05 — Coverage: every shipped surface
Viewports: 375 (mobile), 1280 (laptop), 1920 (wide).
Modes: founder-default (`explainMode=true, devMode=false`) × all viewports + dev-mode (`explainMode=false, devMode=true`) × laptop only.
Routes: all 13 shipped `page.tsx` + all drawer/sheet query-param states from `13-RESEARCH.md` §3. **Skip** Phase 10 Plan-mode sub-routes and Phase 11 Live Floor (unshipped).

### D-06 — No new features during Phase 13
Cosmetic, copy, a11y, logging instrumentation, data-aggregator bug fixes, polling-interval tweaks only. Any new-feature idea the audit surfaces goes to `deferred-ideas.md` with a one-line reason. This includes MC-inspired features like ⌘K (already Phase 12 work) and Incident Stream panel — **if implementing the full panel is a new feature, defer; if the fix is "surface existing log stream as a visible panel," permitted**.

### D-07 — Mission Control IA wins to adopt (scoped sub-list)
From `13-MISSION-CONTROL-NOTES.md`, these are in-scope for Wave 5 if audit confirms clear-win:

- **Ambient clock + latency chip** top-right (Live 09:23 · 28ms)
- **Status counter chip** (Sessions 2/87 analog = active agents + active phases)
- **KPI strip** prominent (rollup-strip already exists — evaluate whether to steal MC's card treatment)
- **Golden Signals framing** for Metrics page (reframe three existing panels; no new data)
- **Agent card action verbs** — audit whether "Wake / Spawn / Hide" or "Start / Stop / Archive" reads better for non-dev founders (copy change only, no new handlers)
- **Incident Stream panel** — only if existing `/api/state` or `circuit-breakers.jsonl` data already has what's needed (reuse, don't rebuild)

Out-of-scope for Phase 13 (defer to Phase 14 or later): ⌘K global search (already Phase 12), Skills Hub, natural-lang cron, trust scoring/secret detection, role-based access, SOUL personalities rebrand.

### D-08 — Delta gate
Phase 13 only ships if Wave 7 delta re-audit yields:
- ≥ 95% of P0 data-correctness findings verdict = `resolved`
- ≥ 80% of ALL findings verdict = `resolved | partial`
- Zero findings verdict = `regressed`
- All WCAG 2.2 AA violations from Wave 3 resolved

Below threshold = create gap plans, loop Wave 5→7 until green.

### D-09 — Run audit against production build
Dev server (`next dev --turbopack`) has the `networkidle` hang bug. All screenshots + liveness measurements run against `pnpm build && pnpm start` on port 3002 (current live dev instance). Rebuild fresh before Wave 1; kill any stale turbopack processes.

### D-10 — Auth for protected routes
Manual `storageState.json` capture one-time via Playwright CLI, reused across all screenshot runs. Zero production-code contamination. Cookie name is `authjs.session-token` (NextAuth v5, not v4). Expected validity ~30 days. Fallback: signed-JWT injection via `context.addCookies()` if manual sign-in blocked.

### D-11 — Deterministic screenshot hygiene
Before each `screenshot-url` call:
- Inject CSS `* { animation: none !important; transition: none !important; caret-color: transparent !important; }` via `--wait-selector` settle + a wrapper script that evaluates CSS after load
- Set localStorage for `explainMode`/`devMode` (camelCase keys, boolean strings)
- Use `--wait-selector` for async-heavy routes (`.monaco-editor`, react-flow `<g>` descendant)
- Run audit against stubbed data fixtures for main pass (deterministic), one live pass at end (real-data sanity check)

### D-12 — Structured logging as a deliverable, not a side effect
If Wave 4 finds the server stdout/browser console are noisy or gap-ridden, Wave 5 includes instrumentation work: wrap `console.log` sites with a tagged logger (`log('scope', 'msg', ctx)`), add SSE event diagnostic logs, add `/api/*` route entry/exit traces at debug level, and ensure errors include stack + request context. This is not a new feature — it's fixing debuggability that shipped broken.

## Claude's Discretion

- Screenshot output directory naming — recommend `.planning/phases/13-ui-ux-review-polish-loop/shots/before/{viewport}-{mode}/{route-slug}.png` and `shots/after/...`. Gitignore entire `shots/` subtree.
- Batch size for vision calls — 6-8 images/call per research §5
- Ordering of per-axis audit sub-steps within Wave 2/3/4 — auditor picks based on context
- Whether Wave 3 correctness check uses a fixture or live data or both — auditor decides per panel
- Exact WCAG threshold report format — markdown table recommended
- Whether Incident Stream panel counts as "surfacing existing data" (permitted) or "new feature" (deferred) — auditor judges per D-06 + D-07 tension

## Deferred Ideas (OUT OF SCOPE, record in deferred-ideas.md)

- Visual regression CI (Chromatic, Percy, Playwright snapshot mode)
- Storybook / component-level visual tests
- Lighthouse runtime perf
- Cross-browser (Firefox/WebKit) — Chromium only
- Mobile-native (iOS Safari, Android Chrome) — 375 Chromium is enough
- New features surfaced by audit: ⌘K (Phase 12), Skills Hub, natural-lang cron, SOUL rebrand, RBAC, Plan-mode sub-routes (Phase 10), Live Floor (Phase 11)
- Proper Playwright test harness at `tests/visual/` with storageState + fixtures — **if** the CLI-based `screenshot-url` approach proves sufficient, defer harness. If not, Wave 0 upgrades to install Playwright as a real dep.

## Must-have truths for Phase 13 (used by Wave 7 gate)

1. Every number rendered in every shipped route has been verified against a source-of-truth file and any mismatch is documented with a fix committed
2. Every live indicator (cost ticker, heartbeat, queue pulse, SSE tail) has a measured polling/SSE interval that is ≤ its semantic claim
3. Every button, drawer trigger, form submit, and keyboard shortcut across shipped routes fires the expected handler with no silent failures
4. Browser console and server stdout emit structured, severity-tagged, scoped messages for every user-visible operation
5. Mission Control IA wins from D-07 that audit-confirmed as clear wins are implemented
6. 6-pillar visual rubric scores ≥ 3/4 on every axis across all shipped surfaces
7. WCAG 2.2 AA violations from Wave 3 axe scan = 0
8. Before/after Opus 4.7 delta re-audit shows D-08 thresholds cleared
