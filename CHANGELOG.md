<!-- generated-by: gsd-doc-writer -->
# Changelog

All notable changes to Ctrl+Alt+Elite documented here. Grouped by phase milestone (no semver yet — project is pre-1.0 alpha). Newest first.

Commit hashes reference the local repo (`/home/cae/ctrl-alt-elite`). No remote push as of 2026-04-23.

---

## [Dashboard — C2 Fix Wave] — 2026-04-23 / 2026-04-24

Structured 18-class fix wave driven by C2 audit results (408 cells × 7 pillars). C3 re-run: 481 improvements, 161 regressions (mobile viewport crashes + reliability on unauthed surfaces). C4 run pending — two additional fixes targeting those open regressions landed 2026-04-24.

### Added

- **Activity stream** (`002ad15`, `e524e4d`) — `dashboard/lib/activity/`: canonical event store + SSE tail. Post-commit git hook ingests commits in real-time; cycle/vision completion events also bridged.
- **Herald post-commit hook** (`f61be81`) — `.githooks/post-commit`: fires Herald background after material commits (900s debounce, skips docs-only, `CAE_SKIP_HERALD=1` opt-out). Class 15B extension also fires activity hook on every commit.
- **CAE brand assets** (`ffe4365`) — PNG logo, icon, and wordmark wired into `TopNav` and the sign-in page.
- **Visual depth system — Class 13** (`088d637`→`2ae3cc5`) — Elevation token set, `Panel`/`Card` primitives with shadow layers, rail + top-bar blurred overlay, focus-dim + vignette pass across remaining surfaces.
- **Rail collapse + labels — Class 7** (`a8fb942`) — Rail collapses to icon-only. `dashboard/lib/sidebar-cookie.ts`: localStorage-backed boolean persistence under `cae.rail.collapsed`, default expanded. Rail and top-bar icons now carry text labels.
- **Build home activity cards — Class 15C** (`50935ef`) — Recent Commits card and activity feed wired to live event stream on `/build` home.
- **Data-truth annotations — Classes 14–17** (`7d73337`→`e37e4ce`) — `data-health` attributes added across 12 routes: `/build` home (30+ keys), `/metrics` (11), `/floor` (11), `/plan` (8), `/memory` (9), all `/build/*` sub-routes, `/chat`. Enables harness truth matching.
- **Audit runs: C1 / C2 / C3** (`e0e7454`, `86d643f`) — C1 baseline established. C2: 408 cells × 7 pillars, craft pillar retro-scored via LLM vision ($12.10, 230 cells). C3 re-run after fix wave: 481 improvements vs C2, 161 regressions (admin-mobile viewport errors open).
- **Vision CLI** (`0819f71`) — `claude -p` CLI transport added to audit scorer; fallback for environments where `claude` binary is absent from `$PATH`.
- **Pikachu loader** (`bc92571`→`5aff247`) — Arrow-key Pikachu pen replaces cursor-trail port; scoped to content area, covers subtabs, dark theme.

### Fixed

- **Truth pillar — Class 1** (`09e3d00`, `b17209b`) — `audit/runner/` `waitForTruthSettled()` loops expected `.healthy=yes` keys (6s default, env `AUDIT_TRUTH_SETTLE_MS`) before screenshot. Fixed 408/408 cells captured mid-load.
- **API 401 on unauth — Class 2** (`29926f4`) — `middleware.ts` returns `401 JSON` for `/api/*` (was `307 redirect → signin`). `use-state-poll.tsx` clears interval on first 401.
- **Chat + adapter user — Class 18** (`601a11f`, `e137243`) — Chat subprocess and tmux adapter now drop to `cae` user via `sudo -u cae` instead of running as root.
- **Truth pillar — Class 14** (`6318f40`) — Three stacked bugs kept truth stuck at 1.00 across all 408 cells even after the Class 1 truth-wait fix: (1) `audit/seed-fixture.ts` wrote to a scratch dir the dev server never read — `audit/run-cycle.sh` now snapshots live metrics, seeds into the live `CAE_ROOT`, and restores on `EXIT`; (2) `lib/cae-state.ts` spoke `forge_start/done/fail` while every other aggregator and fixture speaks `forge_begin/end` — both vocabularies now accepted; (3) `/api/state` used `?? CAE_ROOT` so an empty `?project=` query string bypassed the fallback and resolved to `/.cae/metrics/...` — swapped to `||`. Expected C4 lift: truth pillar 1.00 → 4.5+ on most cells. Files: `dashboard/app/api/state/route.ts`, `dashboard/lib/cae-state.ts`, `dashboard/audit/run-cycle.sh`.
- **Unauthed poll suppression — Class 2b** (`5d76f00`) — Class 2's `401 JSON` response stopped the redirect spiral but left a browser-level "Failed to load resource: 401" console error on `/signin` + `/403`, tanking reliability 5→3 on every unauthed cell. `use-state-poll.tsx` now checks for the session cookie before issuing the initial fetch — no fetch, no 401, no console error. Expected C4 lift: reliability 5.00 on `/signin` + `/403` across all personas (closes the remaining 161-cell C3 regression).

---

## [Dashboard — Phases 11–15] — 2026-04-23

### Added

- **Phase 11 — Live Floor** (`6e9ca15`) — 9/9 must-haves verified, 189/189 tests. Memory graph canvas render, hook+SSE data layer, toolbar, popout route. Live Floor pinned on `/build`.
- **Phase 12 — Polish + empty states** (`23ac8dc`) — 6/6 must-haves verified, 563/563 tests. `EmptyState` primitive, dark palette aligned to UI-SPEC, status pills + progress bar + active-phase card density pass.
- **Phase 13 — Data quality + liveness + MC-IA** (`8821735`) — D-08 gate PASS (22/22 P0 resolved, 43/43 resolved or partial). 12 plans: data correctness, liveness markers, logs v2 SSE multiplex + filter/detector, mission-control IA, visual pass.
- **Phase 14 — Skills Hub + NL cron + RBAC + Security** (`562054f`) — Plans 14-01..14-06. NL-to-cron parser, RBAC, secrets vault UI, audit log, gitleaks scanner. Sentinel flagged 4 P0 security findings post-review; background fixer dispatched.
- **Phase 15 — Capture harness** (`80dcad6`) — Cap.1–Cap.8 shipped: auth cookie minter, fixture seeders (empty/healthy/degraded/broken), Playwright per-cell runner (screenshot + truth + console), pillar scoring + rubric, LLM vision scorer (dry-run default), clickwalk + data-truth scraper, cycle orchestrator, gate + CLI. 1348 vitest tests green, tsc clean.

### Planned (not built)

- **Phase 16** — 10-wave breakdown drafted. Mobile viewport crash fixes (build-queue, build-schedule, build-security* on admin persona) are top priority.

---

## [Dashboard — Phases 1–10 Integrated] — 2026-04-20

`dashboard/` merged as git subtree (`eda31f6`). Standalone Next.js 15 app; subtree preserves full history.

### Added

- **App shell + auth** — Next.js 15, App Router, TypeScript, Tailwind v4, shadcn/ui, NextAuth.js v5 (GitHub OAuth). Top-bar with Plan/Build mode toggle.
- **Build mode core** — `/build` home: active CAE phase list, wave progress, task cards, SSE live tail, circuit-breaker panel, cost ticker. Delegation queue: manual form → `BUILDPLAN.md` → `cae execute-buildplan`.
- **Design system — Phase 3** (`3112aee`) — Dark theme tokens (`#0a0a0a` bg, `#00d4ff` accent), Geist Sans/Mono, shadcn component library. `ExplainMode` (default on) + `DevMode` (⌘⇧D) providers. Route reorg: `/ops/*` → `/build/*`.
- **Build home V2 — Phase 4** (`63ab14e`) — Mission-control hero, phase cards with sort-stuck-first, settings route.
- **Agents tab — Phase 5** (`8f0b47d`) — Per-agent cards (status, model, cost, last-run). `EmptyState` primitive on sparse panels.
- **Linear-style collapsible sidebar** (`799bded`) — Hover tooltips on collapsed icon mode (pre-Class-7 variant; Class 7 replaced with labeled rail).
- **Branded loader** (`0e9b2c6`) — App-shell loading screen with rotating voice; route-level skeletons for chat/floor/memory/metrics (`c956ee6`).
- **Phases 6–10 complete** (`8e91639`) — Ops SSE tail, circuit-breaker stat cards, Changes tab, right-rail chat, drag-drop kanban, memory graph canvas, sibling planner outputs verified.

---

## [Phase 3 — Timmy Bridge Complete] — 2026-04-18

### Added

- **Timmy bridge** (`4239fef`, `658fab8`) — `cae execute-buildplan` subcommand: reads `BUILDPLAN.md` from `/home/cae/inbox/<task-id>/`, runs a full CAE phase, writes result to `/home/cae/outbox/<task-id>/DONE.md`. Integration-tested end-to-end. Fixes: outbox permissions, unique branch names per task.

---

## [Phase 2 — Complete] — 2026-04-17 / 2026-04-18

Phase 2 deliverables: Herald (H1 ✅), Timmy bridge (H3 → shipped as Phase 3 ✅), Shift (deferred).

### Added

- **Herald v0.2** (`2f4ebf8`) — Plan + review + revise loop with user-approval gates. Dogfooded: CHANGELOG, README, ARCHITECTURE all generated via Herald (`d782a39`, `e529316`, `c63150b`, `ef8c1c4`).
- **Herald agent** (`5c5ee4e`) — `cae herald <doc-type>` subcommand. Wraps `gsd-doc-writer` with `agents/cae-herald.md` persona. Maps `readme / architecture / deployment / changelog` to target filenames. Reads existing doc + AGENTS.md before spawning. Audit trail written to `.planning/herald/<session>/herald-prompt.md`.
  - `agents/cae-herald.md` — persona doc with doc-type contracts and verify-don't-guess rules
  - `skills/cae-herald/SKILL.md` — skill injection variant
  - `config/agent-models.yaml` — `herald:` role wraps `gsd-doc-writer` on `claude-sonnet-4-6` with `effort=max`
- **Phase 2 plan** (`0bb6946`) — `PHASE_2_PLAN.md`: H1, H3, Shift scope with three open scope questions.
- **README overhaul** (`5c8e4fd`→`ba335e1`) — SVG banner (retro mechanical keyboard), Herald narrative, harness + context-saving docs, expanded credits. Final: trapezoidal keycaps, no SMIL animation (browsers render gradient fills black mid-press).

### Planned (not built)

- **Shift** — `/shift-start` Claude Code skill for non-technical founders. Chat flow → GitHub repo + `.planning/` artifacts + `.env.example`. Deferred to Phase 4+.

---

## [Phase 1 — Complete] — 2026-04-16 / 2026-04-17

Goal: build CAE correctly on Claude-only infrastructure. Acceptance gate: 23/27 checks pass; 4 reserved for Gemini-dependent paths that unlock when Gemini CLI OAuth (T1) is configured.

### Added

- **`bin/cae` orchestrator** (`3e1cc12`) — Python executable. `execute-phase` subcommand: `ThreadPoolExecutor` bounded by circuit-breaker semaphore, per-task forge branch creation, compactor cascade, adapter spawn, `SUMMARY-attemptN.md` capture, Sentinel review, merge on approve, retry with issues in context, Phantom escalation after 3 Forge failures, halt after 2 Phantom failures. Post-phase Scribe call wired in.
- **Claude Code adapter** (`2935027`) — `adapters/claude-code.sh`: tmux-spawned `claude --print` invoker. `--agent` (wrap) and `--system-prompt-file` (direct-prompt) modes. Captures stdout/stderr/meta to files. Exit codes: 0=ok, 1=err, 2=timeout, 3=bad args. Validated: 3 parallel invocations, timeout kill, cwd inheritance.
- **Gemini CLI adapter** (`3e1cc12`) — `adapters/gemini-cli.sh`: mirrors `claude-code.sh` interface. tmux-spawned. `--format json` with fence extraction and validation. **Untested until T1 (Gemini OAuth) is installed** — code path exists, activation blocked on credentials.
- **Sentinel** (`3e1cc12`, `34e3c71`) — `bin/sentinel.py`: goal-backward review methodology ported from `gsd-verifier`. Gemini Flash primary (when installed), Claude `gsd-verifier` wrap as fallback. Strict JSON output schema. Parser tolerates preamble and code-fence wrapping. Enforces reviewer ≠ builder model. Auto-approve stub removed (`34e3c71`) — Sentinel is always real; Gemini path activates when `which gemini` succeeds. Separate persona doc: `agents/cae-sentinel-gemini.md`.
- **Circuit breakers** (`2935027`) — `bin/circuit_breakers.py` + `config/circuit-breakers.yaml`: 6 limits (max turns, max input/output tokens, max retries before Phantom, Phantom-to-halt, Sentinel JSON fallback, parallelism semaphore). Thread-safe. Logs to `.cae/metrics/circuit-breakers.jsonl`.
- **Phantom integration** (`2935027`) — `bin/phantom.py`: `gsd-debugger` wrap. `should_escalate()` delegates to circuit breakers. Rolling `context.md` with numbered investigations. Parses `ROOT CAUSE FOUND / CHECKPOINT REACHED / DEBUG COMPLETE` markers. Persistent debug state at `.planning/debug/<task_id>/`.
- **Telegram gate** (`3e1cc12`) — `bin/telegram_gate.py` + `config/dangerous-actions.yaml`: 8 dangerous-action patterns. Real mode via `CAE_TELEGRAM_BOT_TOKEN` + `CAE_TELEGRAM_CHAT_ID`; stub mode auto-approves/denies per `CAE_GATE_STUB_AUTO`. All decisions logged to `metrics/approvals.jsonl`. **Real bot token (T11) not yet configured** — stub mode active.
- **Scribe** (`3e1cc12`) — `bin/scribe.py` + `agents/cae-scribe-gemini.md`: Gemini Flash primary, Claude Haiku fallback. Reads SUMMARY.md files, Sentinel reviews, git log, current AGENTS.md. Merge logic: substring + Jaccard dedup, stale entry removal. JSON output schema.
- **Compactor** (`3e1cc12`) — `bin/compactor.py`: 5-layer cascade for context compression before Forge spawns.
- **Git branch isolation** (`2935027`) — `scripts/install-branch-guard.sh` + `scripts/forge-branch.sh`: pre-push hook blocks `main`/`master` without `CAE_MERGE_TOKEN`. Full cycle tested: blocked-push, token-bypass, no-ff merge, unmerged-branch retention on failure.
- **Phase 1 acceptance gate** (`4167f20`) — `scripts/t14-acceptance.sh`: 23 checks pass across all Phase 1 components. 4 checks skip pending Gemini CLI + Telegram token.
- **Pivot documentation** (`b6ef815`) — `CURRENT_STATE.md`, `PIVOT_PLAN.md` (9 architectural decisions), `PHASE_1_TASKS.md` (14 tasks), `CONFIG_SCHEMA.md` (public API v1 for Shift), `TIMELINE.md`, `docs/WRAPPED_AGENT_CONTRACTS.md`, `OMC_OMX_REFERENCE.md`.
- **Session handoff** (`cd8832f`) — `HANDOFF.md` for context continuity across Claude sessions.

### Changed

- **Sentinel always real** (`34e3c71`) — **Breaking internal behavior**: previously `bin/cae` had a stub branch that auto-approved every task when Gemini CLI was absent. Now always calls `bin/sentinel.py` which falls back to Claude `gsd-verifier`. Auto-approve path removed entirely.
- **`config/agent-models.yaml`** (`b6ef815`) — Extracted from per-file model IDs into a central role table with `provider`, `invocation_mode`, `mode`, and `gsd_bridge` sections.

### Known gaps at Phase 1 close

- Gemini CLI not installed (T1 — user-dependent, OAuth setup required). Gemini adapter, Sentinel Gemini path, Scribe Gemini path are code-complete but untested. See `docs/WHEN_T1_LANDS.md` for activation steps.
- Telegram bot token not configured (T11 — user-dependent). Gate runs in stub mode.
- `config/model-profiles.json` exists but is not read by any running code — orphaned reference doc. `cae-init.sh` writes model overrides directly.

---

## [Phase 0 — Foundation] — 2026-04-14

Initial project creation and GSD integration.

### Added

- **10 agent persona docs** (`4620292`) — `agents/cae-nexus.md`, `cae-scout.md`, `cae-arch.md`, `cae-forge.md`, `cae-sentinel.md`, `cae-scribe.md`, `cae-aegis.md`, `cae-phantom.md`, `cae-prism.md`, `cae-flux.md`. Roles, model assignments, behavior rules. Documentation + skill-injection source, not runtime processes.
- **GSD skill injection pack** (`4f907eb`) — 7 `skills/cae-*/SKILL.md` files. Injected into GSD agents via `agent_skills` config mechanism: Forge→`gsd-executor`, Arch→`gsd-planner`/`gsd-plan-checker`, Sentinel→`gsd-verifier`, Scout→`gsd-phase-researcher`/`gsd-project-researcher`, Scribe→`gsd-doc-writer`, Aegis→`gsd-verifier` (smart contract trigger), Init→`cae-init`.
- **Project initializer** (`4f907eb`) — `scripts/cae-init.sh`: copies skill files, writes `.planning/config.json`, detects `.sol`/`foundry.toml` for smart contract mode, creates `AGENTS.md` template.
- **Multica status bridge** (`4f907eb`) — `scripts/multica-bridge.sh` + `hooks/cae-multica-hook.js`: REST API push to local Multica issue tracker. `create-phase`, `start`, `complete`, `fail`, `comment` subcommands. PostToolUse hook tested end-to-end.
- **Scribe reminder hook** (`4f907eb`) — `hooks/cae-scribe-hook.js`: PostToolUse hook. Detects phase-completion signals and prints "Run /cae-scribe to update AGENTS.md."
- **Install scripts** (`4f907eb`) — `scripts/install.sh` (prerequisites, Caveman/Karpathy plugins, skill copy), `scripts/install-hooks.sh` (registers hooks in `~/.claude/settings.json`).
- **Model profiles** (`4620292`) — `config/model-profiles.json`: quality/balanced/budget tier definitions. **Not read by any running code — use `config/agent-models.yaml` for authoritative routing.**
- **MIT License** (`4620292`)

---

*CAE is alpha. Harness (Phases 0–3) functional on Claude-only infrastructure. Dashboard v0.1 at 92% (14/14 phases complete, Phase 15 capture harness shipped, Phase 16 in planning). C2 fix wave complete — C4 audit run pending. Gemini paths code-complete, untested pending T1.*
