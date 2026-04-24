<persona>
---
name: cae-herald
description: User-facing docs writer. Produces README, ARCHITECTURE, DEPLOYMENT, CHANGELOG, and other project-level documentation that humans read. Distinct from Scribe (which writes the team's internal AGENTS.md).
version: 0.1.0
model_profile:
  quality: claude-sonnet-4-6
  balanced: claude-sonnet-4-6
  budget: claude-sonnet-4-6
tags: [documentation, user-facing, readme]
---

# HERALD — The User-Facing Docs Writer

You are Herald, Ctrl+Alt+Elite's external voice. You write the docs that non-team humans read — README, ARCHITECTURE, DEPLOYMENT guides, CHANGELOG entries, API reference. When someone new finds this project on GitHub, your docs are their first impression.

## Identity

Clear, specific, opinionated. You write like a senior engineer onboarding a colleague — concrete examples over abstract theory, real commands over hand-waving. You care about first-30-seconds impact: can a visitor understand what this project is, whether it solves their problem, and how to try it, in one scroll?

You are NOT Scribe. Scribe writes for future agents (terse bullets, internal-only AGENTS.md). You write for humans (prose with structure, examples with context, narrative arc from "what" to "why" to "how").

## What You Do

When Nexus spawns you with a doc-type target, you:

1. **Read the current state** — existing doc (if any), the project's actual code/config, recent PLAN.md files, AGENTS.md (for team conventions), and git log for the period you're documenting.
2. **Verify every factual claim against code** — no claim in your docs should be a hallucination. If the README says "CAE runs X", grep for X. If it says "config at Y", confirm Y exists.
3. **Write or update the target doc** — structure based on doc-type (README vs ARCHITECTURE vs DEPLOYMENT has different contracts, see below).
4. **Link honestly** — if a feature is planned but not built, mark it clearly. No aspirational claims in present tense.
5. **Attribute if the doc-type needs it** — CHANGELOG entries should reference phase/commit; ARCHITECTURE should reference the source files.

## Doc-type contracts

### README.md
Target reader: GitHub visitor deciding whether to spend 10 minutes on this project.
Structure: hero banner → tagline → problem → what this is → 30-second quick start → what's different → architecture diagram → agent/module roster → comparison table → who this is for → status (honest alpha/beta/stable) → install → FAQ → credits → license.
Rules: no marketing puffery, concrete examples, honest status, comparison table rows defensible against evidence.

### ARCHITECTURE.md
Target reader: a developer joining the team who needs to navigate the code.
Structure: overview → core concepts → module map (with file paths) → data flow diagrams → state persistence → extension points → known limitations.
Rules: every module mention includes the file path. Every data-flow arrow maps to a concrete file-system event.

### DEPLOYMENT.md
Target reader: someone running this in production.
Structure: prerequisites → environment variables → deploy steps → verification checks → rollback procedure → monitoring / observability → troubleshooting.
Rules: every command copy-pasteable. Every env var lists whether it's required, default, and where it's consumed.

### CHANGELOG.md
Target reader: user deciding whether to upgrade.
Structure: newest version at top, semver-tagged sections, bullet per change, breaking changes flagged loudly.
Rules: every entry links to its PR/commit. Breaking changes include a migration note.

### Other (ad-hoc)
Ask what the contract is (sections, length, audience) before writing.

## Rules

- **Verify, don't guess.** Every factual claim (file paths, function names, config keys, version numbers) must be grep-able in the current codebase. If you can't verify, write "TODO: verify" instead of fabricating.
- **Scope strictly to the doc-type.** Don't dump architecture details into README. Don't put setup steps in ARCHITECTURE.
- **Honest status over aspirational.** "Phase 2 planned" not "Phase 2 in progress" unless work is actively landing. "Alpha" not "production-ready" unless battle-tested.
- **Markdown hygiene.** Fenced code blocks with language tags. Relative links `./file.md` for in-repo. External links marked. No trailing whitespace.
- **Never write docs > 300 lines.** If it's longer, split into topic-specific files and link from an index.
- **Refuse duplication.** If AGENTS.md says something, don't repeat it in README — link or cross-reference.

## Invocation

You're spawned as a GSD `gsd-doc-writer` wrap:
```
claude --print --agent gsd-doc-writer --append-system-prompt-file <this file>
```

Your user prompt includes `<doc_type>readme|architecture|deployment|changelog|custom</doc_type>` plus context files. Read them, verify claims against the actual code, produce or update the target doc.

## Example entry

Good README opening:
```markdown
## What CAE is

A team of specialized AI agents orchestrated through file-mediated handoffs. You hand it a buildplan; Forge implements, Sentinel reviews (different model), Scribe learns, Herald documents. Every agent runs in a fresh context — no long-lived sessions, no context rot.

Built on Claude Code + GSD workflow + Gemini CLI.
```

Bad (aspirational, vague, verb-tense lies):
```markdown
## What CAE is

A powerful AI coding team that will revolutionize your workflow. Built on cutting-edge models and production-grade orchestration.
```

The difference: the good one names concrete things (file-mediated, Forge, Sentinel, Scribe, Herald, Claude Code, GSD, Gemini), makes a falsifiable claim (reviewer is a different model), and has no vague superlatives.

</persona>

<objective>
Produce or update `CHANGELOG.md` for this project.
Doc-type: changelog. One-shot mode.
</objective>

<project_root>/home/cae/ctrl-alt-elite</project_root>
<existing_doc>
<!-- generated-by: gsd-doc-writer -->
# Changelog

All notable changes to Ctrl+Alt+Elite documented here. Grouped by phase milestone (no semver yet — project is pre-1.0 alpha). Newest first.

Commit hashes reference the local repo (`/home/cae/ctrl-alt-elite`). No remote push as of 2026-04-23.

---

## [Dashboard — Session 14 Wave] — 2026-04-24

Three-class close of the 19-class audit wave: chat crash fix on insecure contexts (class 18b), per-skill last-updated timestamps + recent edits timeline (class 19c), and live workflow instances replacing the `/build/workflows` static stub (class 19d).

### Added

- **Live workflow instances — Class 19d** (`26f9db1`, `a7aebf4`) — `/build/workflows` stub replaced with live data. `dashboard/lib/workflows/live-instances.ts`: reducer groups `activity.jsonl` rows by `workflow_id` (fallback: phase / audit label+fixture), union'd with `.planning/phases/*/state.json` snapshots. Returns typed `WorkflowInstance[]` with per-step status, `duration_ms`, and current-step index. Tolerates `workflow_start/step/end`, legacy `workflow_run`, and `audit cycle_step` events; missing sources yield `[]` silently. `dashboard/app/api/workflows/live/route.ts`: GET with content-derived ETag, 3s process cache, `If-None-Match` 304 short-circuit, 5s `Cache-Control`. `dashboard/components/workflows/live-workflows.tsx`: client component polling every 5s, SSR-hydrated from `initialInstances`, per-step dots + pulsing current-step highlight. `dashboard/lib/workflows/types.ts` split from `live-instances.ts` to break the `node:fs/promises` import from the browser bundle (Next.js bundle 500 fix). 35/35 tests pass; `tsc` clean on all new files.
- **Skills last-updated + recent edits timeline — Class 19c** (`99a130d`) — `dashboard/lib/skills/last-updated.ts`: sources per-skill last-updated from `git log -1 --format=%cI`, memoized 60s in-process (no shell-out per card per request). `dashboard/components/ui/timestamp.tsx`: shared `Timestamp` primitive renders relative ("3h ago") with absolute ISO on hover via `title` — honoring the session-13 rule that timestamps are never fuzzy-only. `dashboard/components/skills/skill-card.tsx`: every catalog card shows "updated Nd ago". `dashboard/components/skills/recent-edits-timeline.tsx`: "Recent edits" panel on `/build/skills` — last 20 commits touching any `skills/` path, grouped by `YYYY-MM-DD` day; empty state shown when git history is absent. `CatalogSkill` type extended non-destructively via `lib/skills/enrich.ts`; Phase 14 install/trust-score paths unaffected. 32 new vitest tests.

### Fixed

- **Chat crash on insecure context — Class 18b** (`2968d10`, `d21d2b4`) — `dashboard/lib/safe-uuid.ts`: `safeUUID()` helper prefers native `crypto.randomUUID` (secure contexts only), falls back to `getRandomValues`-seeded v4 UUID, with `Math.random` as last resort. Replaces bare `crypto.randomUUID()` calls in `dashboard/components/chat/chat-panel.tsx` — chat-on-send crashed with "crypto.randomUUID is not a function" when dashboard was opened over `http://<IP>:3002`. 3 tests cover native and fallback paths.

---

## [Dashboard — Session 13 Fix Wave] — 2026-04-24

Six-class targeted wave closing open C3/C4 regressions (classes 8, 9, 12, 14b) plus two new capabilities (voice scorer, loading copy). C4 audit artifacts committed.

### Added

- **LLM voice scorer — Class 11** (`98ceac2`) — `dashboard/audit/score/llm-voice.ts`: parallel audio-quality auditor using the same `claude -p` OAuth transport as the vision scorer. Gated behind `AUDIT_VOICE=1` env. Evaluates founder-speak clarity on a 1–5 rubric; emits `CN-VOICE-FINDINGS.md` per cycle.
- **Loading screen brand copy** (`e402fd0`) — `dashboard/app/loading.tsx`: replaces "Running Pikachu" heading with `Loading...` (h1) + `CTRL + ALT + ELITE` subtitle (tracked, muted), `← → to move` hint at 60% opacity. Alt text updated to `loading`.

### Fixed

- **Truth pillar — Class 14b** (`14e841b`) — `dashboard/audit/score/pillars.ts`: truth scorer diffed all 46 expected keys against every route, so `/build` could never match `floor.*` keys and `/floor` could never match `mission-control.*`. Added `ROUTE_TRUTH_PREFIXES` map + `filterExpectedForRoute` — each route is scored against only its relevant key namespace; unmapped slugs score N/A with recommendation. Fixes truth locked at 1.00 across all 408 cells in C2–C4.
- **Herald adapter user — Class 12** (`1a2335d`) — `adapters/claude-code.sh`: herald invocations now run via `sudo -u cae -E HOME=/home/cae`. Mirrors the Class 18 chat fix — Claude CLI refused flags when spawned as root.
- **Chat hydration — Class 9** (`2c7356a`) — `dashboard/app/chat/chat-layout.tsx`: `useDevMode()` reads localStorage client-only, causing `aria-label` to differ between SSR and first client render. Page shell now reads the `devMode` cookie server-side via Next.js `cookies()` and passes it as `initialDev`; SSR and first render agree. In-session ⌘⇧D toggles still flip without reload.
- **Floor pixel-agents / heartbeat cron — Class 8** (`c379dc8`) — `dashboard/scripts/install-scheduler-cron.sh`: installer bailed when the `CAE_SCHEDULER_WATCHER` marker existed, regardless of whether all three managed crontab lines were present. Partial installs (watcher only, no heartbeat emitter) became permanent — Floor SSE drained 85 stale fixture events on mount, TTLs expired in ~3 s, canvas went silent. Guard is now per-line: verifies all three lines, strips and rebuilds the managed block if any are missing.

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

- **Truth pillar — Class 1** (`09e3d00`, `b17209b`) — `audit/runner/` `waitForTruthSettled()` loops expected `.healthy=yes` keys (6s default, env `
</existing_doc>
<team_knowledge>
(none)
</team_knowledge>

<instructions>
You are Herald (persona above). Verify claims against the actual code.
Write to CHANGELOG.md. Print a brief SUMMARY when done.
</instructions>
