# Test Plan (Cycle 13)

Eric: "consider what the best tests are for this and how you would test features, functionality, make improvements."

This document defines the **test methodology** that proves Phase 15 work is production-quality. Three layers, each layer mandatory before any wave is "done."

## Test layers

### Layer 1 — Capture tests (does instrumentation record what should be recorded)

**What:** prove that when a user-visible action happens, the underlying state file gets the right write.

**Method:** integration test that runs an end-to-end flow (e.g., fire a Bash → check `.cae/metrics/tool-calls.jsonl` grew by 1 row with the right fields).

**Per-source coverage:**
- `tool-calls.jsonl` — fire Bash, Edit, Write, MultiEdit, Agent, Task. Verify entry per. Verify Read does NOT log (mutation-only filter).
- `circuit-breakers.jsonl` — fire a phase execution, verify forge_begin + forge_end with input_tokens, output_tokens, model.
- `memory-consult.jsonl` — fire a tool call that reads a memory file, verify entry.
- `scheduler.jsonl` — schedule a task, wait for cron tick, verify entry.
- `heartbeat.jsonl` — verify entry every 30s (post-Wave-1.5).
- `skill-scans.jsonl` — verify entry per scheduled scan.
- `sentinel.jsonl` — verify entry on sentinel approval/reject.

**Implementation:** Vitest integration test in `tests/instrumentation/` running each pipeline against a temp `CAE_HOME` dir. Bash with `CLAUDE_TOOL_NAME=Bash` env, fire script, sleep, read file, assert.

### Layer 2 — Render tests (does FE render captured data correctly)

**What:** prove that for given source data, the UI renders the right values + the right visual states.

**Method:**
- Unit: vitest + @testing-library/react with mocked aggregator responses.
- Integration: seeded source files + real aggregator + render check.
- Visual: Playwright screenshot match (per VISUAL-RESEARCH §11) against baselines.
- A11y: axe-core sweep per route.

**Per-pillar coverage:**
- **Truth:** seed source with N events, verify rendered numbers match seed.
- **Depth:** for each detail-expand surface, count rendered fields, assert >= source-field-count × 0.8 (must show 80% of available data).
- **Liveness:** seed 5 fixture states (empty / loading / fresh / stale / dead / error), verify visual differs per state.
- **Voice:** snapshot empty/error copy strings; require non-empty + non-generic regex (no /no data|loading\.\.\.|error/i alone).
- **Craft:** screenshot diff vs baseline; LLM-vision audit against pillar rubric (per VISUAL-RESEARCH).
- **Reliability:** axe-core 0 violations; React strict-mode 0 warnings; SSR-mismatch check.
- **IA:** Playwright clickwalk asserts every nav target reachable from landing.

**Implementation:** Already partly built — Phase 13 produced verify.py + capture.sh. Phase 15 extends with `data-truth` annotations + truth.py harness (Wave 1 of original P15 spec).

### Layer 3 — Discover tests (can a user FIND the info)

**What:** prove a non-dev founder can navigate to and use any feature without instruction.

**Method:** Playwright user journey scripts per persona (defined in OVERHAUL-PLAN §personas).

**Per-persona coverage:**
- **P1 first-time founder:** lands on /signin → signs in → sees mission control hero → click "what's happening now" tile → drills to active phase → reads 3 useful fields. Pass criteria: 0 dead ends, < 4 clicks to any data.
- **P2 returning founder:** same as P1 but seeded with prior session activity → expects "since you were gone" card visible above-fold.
- **P3 operator:** lands → opens command palette ⌘K → types "run workflow" → 1 click to fire. < 3 clicks total.
- **P4 senior dev:** lands → opens Dev Mode toggle → all panels show raw IDs / paths / SHAs alongside founder copy.
- **P5 admin:** lands → /build/security/audit → sees recent audit entries → clicks one → sees full payload.
- **P6 live spectator:** lands → sees live activity panel pulse → sees Floor pinned widget showing named pixel agents → click agent → opens drawer.

**Implementation:** Playwright `tests/journeys/{P1..P6}.spec.ts`. Each script: login + sequence of actions + assertions. Run on `npm run test:journeys`.

## Test coverage gates per wave

Every wave-acceptance check requires:
- Layer 1: instrumentation test passes if pipeline touched
- Layer 2: render tests + screenshot diff for changed components
- Layer 3: journey re-run for any persona whose path was touched

## Visual regression testing

Per VISUAL-RESEARCH §11 / Phase 13 spec:
1. Baseline PNG captured for each route × viewport × auth × theme matrix
2. Post-change PNG captured + perceptual diff (pixelmatch threshold 2%)
3. Diff exceeding threshold → either accept baseline (if change intended) or fail (if regression)

**LLM-vision pillar audit:** opus-4-7 vision call per PNG, scored on 7 pillars 1-5 with rubric anchors. Score < 4 → finding logged.

## Performance budgets

Per Wave acceptance:
- Lighthouse desktop: Performance ≥ 90, Accessibility = 100, Best Practices ≥ 95
- LCP < 2.5s on /build home (currently TBD; baseline this cycle)
- TBT < 200ms on hover/click interactions
- Bundle delta per wave: ≤ +30KB gzipped (cumulative budget tracked)

## Accessibility coverage

- axe-core run per route: 0 critical, 0 serious violations
- Keyboard navigation: every interactive element reachable + actionable via keyboard
- Screen reader: skim with NVDA / JAWS once per major surface
- prefers-reduced-motion: every animation respects (existing globals.css overrides cover most; spot check per wave)
- Color contrast: WCAG AA 4.5:1 body text, 3:1 UI elements (verified by axe)

## Test infrastructure additions needed

1. **Playwright** — already a dep? If not, add. Install browsers in CI.
2. **pixelmatch** + image utilities — for screenshot diff
3. **axe-core** — already used in Phase 13 audit; integrate as test
4. **Test fixtures** — `tests/fixtures/seed/` with 4 fixture-state JSONL generators (empty/healthy/degraded/broken)
5. **Auth harness** — `tests/auth/mint-session.ts` to issue signed JWT for headless capture (per OVERHAUL-PLAN §Cycle 5)

## CI gating policy

- PR block: any layer-1/2/3 test failure
- PR warn: bundle budget exceeded, perf score < target
- No auto-merge if visual diff > 2% on any baseline image

## When tests get added

Each fix wave includes its tests in the same commit. No "ship now, test later" — that's exactly the half-assed pattern Eric banned.

## Tracking

Wave acceptance tracker:
| Wave | Layer 1 ✓ | Layer 2 ✓ | Layer 3 ✓ | Visual diff ✓ | A11y ✓ | Perf ✓ |
|------|-----------|-----------|-----------|---------------|--------|--------|
| W1   | TBD | TBD | TBD | TBD | TBD | TBD |
| W2   | TBD | TBD | TBD | TBD | TBD | TBD |
| ...  | ...  | ...  | ...  | ...  | ...  | ...  |
