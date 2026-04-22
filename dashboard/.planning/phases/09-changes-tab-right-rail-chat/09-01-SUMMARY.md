---
phase: 09-changes-tab-right-rail-chat
plan: 01
subsystem: ui
tags: [wave-0, voice, prereqs, chat-primitives, tdd, pure-lib, voice-router, chat-suggestions, cost-estimate, vitest]

# Dependency graph
requires:
  - phase: 04-build-home-rewrite
    provides: "AgentName + AGENT_META (lib/copy/agent-meta.ts)"
  - phase: 08-memory-whytrace
    provides: "vitest config + jsdom env (tests/setup.ts, vitest.config.ts)"
provides:
  - "lib/voice-router.ts — pickPersona() pure function + MODEL_BY_AGENT const + modelForAgent()"
  - "lib/chat-suggestions.ts — SUGGESTIONS map (8 routes) + suggestionsFor() with longest-prefix matching"
  - "lib/chat-cost-estimate.ts — estimateTokens() + shouldGate() with closed ChatGatedActionSpec union"
  - "docs/VOICE.md — 172-line root voice guide (global rules, D-05 routing, D-06 model map, Nexus do/don't, per-agent one-liners)"
  - "docs/voices/{9 agents}.md — --append-system-prompt-file payloads, 24-30 lines each"
affects: [09-02, 09-03, 09-04, 09-05, 09-06, 09-07]

# Tech tracking
tech-stack:
  added: []  # zero new runtime deps — everything uses existing vitest + TS + MD
  patterns:
    - "TDD workflow: write test file first, verify RED via pnpm test <file>, implement to GREEN, commit as single feat"
    - "Persona system-prompt fragments split: one root VOICE.md for humans + per-agent fragments as --append-system-prompt-file inputs"
    - "Closed literal-union action specs for exhaustive switch statements (ChatGatedActionSpec)"

key-files:
  created:
    - "dashboard/lib/voice-router.ts"
    - "dashboard/lib/voice-router.test.ts"
    - "dashboard/lib/chat-suggestions.ts"
    - "dashboard/lib/chat-suggestions.test.ts"
    - "dashboard/lib/chat-cost-estimate.ts"
    - "dashboard/lib/chat-cost-estimate.test.ts"
    - "dashboard/docs/VOICE.md"
    - "dashboard/docs/voices/nexus.md"
    - "dashboard/docs/voices/forge.md"
    - "dashboard/docs/voices/sentinel.md"
    - "dashboard/docs/voices/scout.md"
    - "dashboard/docs/voices/scribe.md"
    - "dashboard/docs/voices/phantom.md"
    - "dashboard/docs/voices/aegis.md"
    - "dashboard/docs/voices/arch.md"
    - "dashboard/docs/voices/herald.md"
  modified: []

key-decisions:
  - "Keyword ordering in voice-router: phantom > aegis > scout > herald > arch > sentinel — a failing system outranks a security review"
  - "Slash-boundary guard in both voice-router route rules and suggestionsFor — /buildfoo never false-matches /build"
  - "chat-cost-estimate ChatGatedActionSpec is a closed literal union so the estimateTokens switch is type-exhaustive — adding a new action type fails the build if the switch is not updated"
  - "delegate_new ignores buildplanLength in v1 — field is accepted (API stability) but flat 8k default returned; v2 may compute length-scaled estimates"
  - "GATE-01 threshold is inclusive (>= 1000) — exact-1000 estimates gate, mirrors human intuition"
  - "VOICE.md splits responsibilities: root file is human do/don't + routing, per-agent fragments are valid --append-system-prompt-file payloads"
  - "Voice fragment template: 'You are <Name>, ...' first line, then Rules, Examples of your tone (3 short quotes), When routed to — keeps fragments <40 lines"

patterns-established:
  - "TDD for pure libs: colocate .test.ts next to .ts, vitest describe+it, run with `pnpm test <path>` for fast iteration"
  - "Route-prefix matching util pattern: `route === prefix || route.startsWith(prefix + '/')` — reused between voice-router and chat-suggestions"
  - "Exhaustiveness via `as const satisfies Readonly<Record<...>>` so the literal object both narrows and fails if a required key is missing"

requirements-completed: [VOI-01, CHT-03, CHT-05, GATE-01, MODEL-01]

# Metrics
duration: 12min
completed: 2026-04-23
---

# Phase 9 Plan 01: Wave 0 — VOICE corpus + three chat primitive libs Summary

**Nine-persona voice corpus (docs/VOICE.md + 9 fragments) + voice-router, chat-suggestions, and chat-cost-estimate libs with 70 vitest assertions — zero new runtime deps, tsc clean, build clean.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-22T14:55:11Z
- **Completed:** 2026-04-22T15:07:02Z
- **Tasks:** 4 / 4
- **Files created:** 16 (3 lib sources, 3 test files, 1 root VOICE.md, 9 persona fragments)
- **Files modified:** 0

## Accomplishments

- **Voice router (D-05, D-06):** Pure first-match-wins function over explicit `@agent` override → keyword heuristics (fixed order) → route prefix → Nexus default. Per-persona model map hard-coded per D-06 (opus-4-7 for nexus/arch/phantom, sonnet-4-6 for the other six). 38 unit tests cover every rule path including the `@task:` gotcha and the phantom-beats-aegis ordering.
- **Chat suggestions (D-11):** 8 route keys, 2–3 chips each, founder-speak copy (no literal `$`), with exact + longest-prefix + slash-boundary matching in `suggestionsFor`. 13 unit tests.
- **Chat cost estimate (D-07, GATE-01):** Closed `ChatGatedActionSpec` union (workflow_run / delegate_new / retry_task / chat_send) with deterministic heuristic — averages prior runs when given, falls back to the D-07 defaults otherwise. `shouldGate` inclusive at 1000; chat_send never gates. 19 unit tests.
- **VOICE.md:** 172-line root voice guide (under the 200 cap). Global rules, cross-agent don'ts, D-05 routing table, D-06 model table, Nexus do/don't table (6 situations), per-agent one-liners for all nine personas, rate-limit behavior, Dev-mode copy flip.
- **9 persona fragments:** All under 40 lines (24–30 each). Each is a valid `--append-system-prompt-file` payload: starts with "You are <Name>, ...", lists Rules, shows 3 in-character tone examples, ends with "When routed to" handoff guidance.
- **Zero new dependencies:** Reused vitest + jsdom + existing TypeScript/Next toolchain.

## Task Commits

Each task was committed atomically:

1. **Task 1: Voice router + test (TDD)** — `f97173c` (feat)
2. **Task 2: Chat suggestions + cost estimate + tests (TDD)** — `f5a639e` (feat)
3. **Task 3: docs/VOICE.md root voice guide** — `bfe12a8` (docs)
4. **Task 4: 9 persona fragments under docs/voices/** — `e09caa0` (docs)

_Both TDD tasks were committed as single atomic `feat` commits after GREEN — RED phase was verified in-session ("Failed to resolve import" on missing implementation) but intentionally not committed to keep the history linear. The `executor chooses` guidance in Task 1's action block permits this._

## Files Created/Modified

- `dashboard/lib/voice-router.ts` — `pickPersona`, `MODEL_BY_AGENT`, `modelForAgent`, `AGENT_NAMES` (re-exported)
- `dashboard/lib/voice-router.test.ts` — 38 vitest assertions across 5 describe blocks
- `dashboard/lib/chat-suggestions.ts` — `SUGGESTIONS` const (8 routes) + `suggestionsFor(pathname)`
- `dashboard/lib/chat-suggestions.test.ts` — 13 vitest assertions for the map + matcher
- `dashboard/lib/chat-cost-estimate.ts` — `estimateTokens`, `shouldGate`, exported `ChatGatedActionSpec`
- `dashboard/lib/chat-cost-estimate.test.ts` — 19 vitest assertions including boundary (999/1000) cases
- `dashboard/docs/VOICE.md` — 172-line root guide
- `dashboard/docs/voices/{nexus,forge,sentinel,scout,scribe,phantom,aegis,arch,herald}.md` — 9 fragments, 24–30 lines each

## Decisions Made

- **Keyword ordering rule is intentional and documented.** Phantom's rule runs before Aegis's rule in `pickPersona`. Test `"my auth is stuck on sign-in"` → `phantom` asserts this; VOICE.md §Routing explains it (a failing system is checked before a security review).
- **Slash-boundary guards live in two places** (voice-router route rules AND suggestionsFor). Same helper would be over-abstraction for two call sites.
- **TDD commit cadence:** each task is one commit, not RED+GREEN split commits. Plan explicitly permits either; single-commit keeps bisect simpler since the intermediate RED state has no working code.
- **`delegate_new` ignores `buildplanLength` in v1** — field is accepted on the action spec (forward-compatibility) but the estimator returns a flat 8k. Documented in module comment + tested.

## Deviations from Plan

### Auto-fixed issues

None — plan executed exactly as written for all four tasks.

### Deferred issues (out-of-scope, logged per GSD scope rule)

See `.planning/phases/09-changes-tab-right-rail-chat/deferred-items.md`:

1. **`pnpm lint` pre-existing infra bug.** `next lint` mis-parses argv → `/dashboard/lint` not-a-directory error. Direct `eslint` also fails due to missing `@eslint/eslintrc`. Pre-existing — tracked as a dashboard-level chore, NOT a Phase 9 regression. All Plan 09-01 files pass `pnpm tsc --noEmit`, all three vitest suites (70 tests total), and `./scripts/lint-no-dollar.sh`.
2. **`pnpm build` NFT warning.** Turbopack emits one pre-existing warning about `next.config.ts`; build completes successfully with the full route table. Not caused by Plan 09-01 — `next.config.ts` was already on the working tree's modified list before the plan started.

**Total auto-fixes:** 0.
**Impact on plan:** None. Plan scope was exactly what shipped.

## Issues Encountered

- **`pnpm test -- --run <path>` syntax noise.** The plan's verify block uses `pnpm test -- --run lib/foo.test.ts`, but the extra `--` prefix causes vitest to run the full suite with `--run` + `<path>` as positional args. Workaround: `pnpm test <path>` (without `-- --run`) filters to a single file and exits 0. Used throughout execution; final cross-verification used the 3-file form.
- **Pre-existing failing vitest suites in the repo.** 5 test files fail on the main branch at the start of Plan 09-01 (step-graph, cae-nl-draft, cae-queue-state, cae-workflows, and one more). All pre-date this plan and are out of scope per the scope-boundary rule. Verified by running `pnpm test` before writing any Plan 09-01 code — same 5 failures.

## VOICE-SIGNOFF (blocking pre-Wave-1 user surface)

`dashboard/docs/VOICE.md` is written. **Orchestrator: surface the absolute path below to the user and flag it for optional sign-off BEFORE Wave 1 (09-02, 09-03) executes.** User may skip or redirect — sign-off is non-blocking in the technical sense, but user voice preferences matter and catching drift now is cheaper than a post-Wave-3 rewrite.

**Absolute path:** `/home/cae/ctrl-alt-elite/dashboard/docs/VOICE.md`

**Per 09-CONTEXT D-04:** User sign-off is deferred to Phase 13 UI review OR a later gap-closure plan if it does not happen before Wave 1. Wave 1 is NOT blocked on this.

## User Setup Required

None — this plan only adds pure-TS libs + Markdown docs. No environment variables, no external services.

## Next Phase Readiness

**Ready for Wave 1 (09-02 + 09-03, parallel):**

- `09-02` (Changes aggregator) can import nothing from this plan but runs in parallel.
- `09-03` (Chat API routes) imports:
  - `pickPersona` + `modelForAgent` from `lib/voice-router.ts` (picks persona + model per user message).
  - `docs/voices/<agent>.md` path passed as `--append-system-prompt-file` to the spawned `claude` CLI.
- `09-05` (Chat UI, Wave 2) imports `SUGGESTIONS` + `suggestionsFor` from `lib/chat-suggestions.ts` to render route-keyed chips.
- `09-06` (Gate wiring, Wave 3) imports `estimateTokens` + `shouldGate` + `ChatGatedActionSpec` from `lib/chat-cost-estimate.ts`.

**Blockers:** None.

**Suggested-but-optional:** surface VOICE.md to the user before spawning 09-02 and 09-03 executors (orchestrator directive above).

## Self-Check: PASSED

Verified all claimed artifacts exist and all commits are in the log.

**Files (16):**
- FOUND: dashboard/lib/voice-router.ts
- FOUND: dashboard/lib/voice-router.test.ts
- FOUND: dashboard/lib/chat-suggestions.ts
- FOUND: dashboard/lib/chat-suggestions.test.ts
- FOUND: dashboard/lib/chat-cost-estimate.ts
- FOUND: dashboard/lib/chat-cost-estimate.test.ts
- FOUND: dashboard/docs/VOICE.md
- FOUND: dashboard/docs/voices/nexus.md
- FOUND: dashboard/docs/voices/forge.md
- FOUND: dashboard/docs/voices/sentinel.md
- FOUND: dashboard/docs/voices/scout.md
- FOUND: dashboard/docs/voices/scribe.md
- FOUND: dashboard/docs/voices/phantom.md
- FOUND: dashboard/docs/voices/aegis.md
- FOUND: dashboard/docs/voices/arch.md
- FOUND: dashboard/docs/voices/herald.md

**Commits (4):**
- FOUND: f97173c (Task 1 — voice-router)
- FOUND: f5a639e (Task 2 — chat-suggestions + chat-cost-estimate)
- FOUND: bfe12a8 (Task 3 — VOICE.md)
- FOUND: e09caa0 (Task 4 — 9 persona fragments)

**Verification sweeps:**
- `pnpm test lib/voice-router.test.ts lib/chat-suggestions.test.ts lib/chat-cost-estimate.test.ts` → 70/70 passed
- `pnpm tsc --noEmit` → clean
- `pnpm build` → completes (pre-existing NFT warning logged to deferred-items.md)
- `./scripts/lint-no-dollar.sh` → PASS

---
*Phase: 09-changes-tab-right-rail-chat*
*Completed: 2026-04-23*
