---
phase: 17
plan: W2-audit-coverage
wave: 2
name: Extend audit fixture + pillar truth coverage to 100% of routes
---

# W2 — Audit coverage gap

## Context

From FINDINGS.md scorer analysis: 12 routes have no prefix mapping in `ROUTE_TRUTH_PREFIXES`, so truth scorer compares all 46 fixture keys → scores 1 regardless of UI state. Covers: `build-agents, build-changes, build-security, build-security-audit, build-security-secrets, build-security-skills, build-workflows, build-workflows-new, floor-popout, root, signin, 403`.

This is why C5 truth rollup shows 291 cells at 1 — some are real bugs, some are scorer gaps. Session 15 merge gate depends on being able to tell them apart.

## Task

<task>
<name>Add route prefix mappings + fixture entries for uncovered routes</name>

<files>
audit/score/pillars.ts
audit/fixtures/healthy.ts
audit/fixtures/empty.ts
audit/fixtures/degraded.ts
audit/fixtures/broken.ts
audit/fixtures/fixtures.test.ts
audit/score/pillars.test.ts
</files>

<action>
1. For each uncovered route, identify the data-truth prefix the page already emits. Grep: `rg 'data-truth="(build-agents|build-changes|build-security|build-workflows|root)\\.'`.
2. Add to `ROUTE_TRUTH_PREFIXES`:
   ```ts
   "build-agents": ["build-agents."],
   "build-changes": ["build-changes."],
   "build-security": ["build-security."],
   "build-security-audit": ["build-security-audit.", "build-security."],
   "build-security-secrets": ["build-security-secrets.", "build-security."],
   "build-security-skills": ["build-security-skills.", "build-security."],
   "build-workflows": ["build-workflows."],
   "build-workflows-new": ["build-workflows-new.", "build-workflows."],
   "floor-popout": ["floor."],
   "root": ["root.", "landing."],
   "signin": [],          // unauthenticated page — N/A
   "403": [],             // error page — N/A
   ```
3. An empty prefix array means "no expected keys for this route" → pillar returns N/A (see existing `na: true` branch in pillars.ts).
4. Add to `audit/fixtures/healthy.ts` (and mirror in empty/degraded/broken with appropriate values):
   - `build-agents.healthy=yes`, `build-agents.active-count=<n>`, `build-agents.empty=<bool>`
   - `build-changes.healthy=yes`, `build-changes.count=<n>`
   - `build-security.healthy=yes` (covered by W2-build-security-page plan; coordinate)
   - `build-workflows.healthy=yes`, `build-workflows.count=<n>`, `build-workflows.empty=<bool>`
   - `build-workflows-new.healthy=yes`, `build-workflows-new.stage=<form|review>`
   - `root.healthy=yes`, `landing.cta-count=<n>` (or similar — match whatever the page renders)
5. Update fixture tests. Snapshot test the full expected dict so future additions are caught.
6. Update pillars.test.ts to assert each new route's truth scoring returns expected values against the fixture.
</action>

<verify>
1. `pnpm vitest run audit/` — all green.
2. Re-run C6 score run: `npx tsx audit/score-run.ts C6-session15 --prior C5-session15`.
3. Truth scorer now marks signin/403 as `na:true` (not score 1). Covered routes that are truly broken still score 1.
4. C6 SUMMARY.json: zero routes where `truth=1` AND no N/A marker.
</verify>
</task>
