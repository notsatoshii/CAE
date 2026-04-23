---
phase: 14
plan: 05
subsystem: security
tags: [security, trust-scores, secrets-scan, audit-log, gitleaks, rbac, tdd]
dependency_graph:
  requires: [14-04]
  provides: [security-panel, trust-scores, secrets-scan, audit-log]
  affects: [build-rail, middleware, install-route]
tech_stack:
  added: [gitleaks (shell-out), JSONL audit log, spawnImpl injection pattern]
  patterns: [5-factor trust heuristic, atomic file write (tmp+chmod+rename), injectable spawn for testability]
key_files:
  created:
    - dashboard/lib/cae-skills-trust.ts
    - dashboard/lib/cae-skills-trust.test.ts
    - dashboard/lib/cae-secrets-scan.ts
    - dashboard/lib/cae-secrets-scan.test.ts
    - dashboard/lib/cae-audit-log.ts
    - dashboard/lib/cae-audit-log.test.ts
    - dashboard/lib/cae-trust-overrides.ts
    - dashboard/lib/cae-trust-overrides.test.ts
    - dashboard/lib/gitleaks-allowlist.toml
    - dashboard/app/api/security/trust/route.ts
    - dashboard/app/api/security/trust-override/route.ts
    - dashboard/app/api/security/scan/[name]/route.ts
    - dashboard/app/api/security/scans/route.ts
    - dashboard/app/api/security/audit/route.ts
    - dashboard/scripts/install-audit-hook.sh
    - dashboard/tests/test-audit-hook-matcher.sh
    - dashboard/app/build/security/page.tsx
    - dashboard/app/build/security/security-client.tsx
    - dashboard/app/build/security/skills/page.tsx
    - dashboard/app/build/security/skills/trust-grid-client.tsx
    - dashboard/app/build/security/secrets/page.tsx
    - dashboard/app/build/security/secrets/secrets-report-client.tsx
    - dashboard/app/build/security/audit/page.tsx
    - dashboard/components/security/trust-badge.tsx
    - dashboard/components/security/trust-badge.test.tsx
    - dashboard/components/security/trust-explainer.tsx
    - dashboard/components/security/trust-grid.tsx
    - dashboard/components/security/trust-grid.test.tsx
    - dashboard/components/security/secrets-report.tsx
    - dashboard/components/security/audit-table.tsx
    - dashboard/components/security/audit-table.test.tsx
  modified:
    - dashboard/lib/cae-types.ts (TrustScore.overridden field added)
    - dashboard/app/api/skills/install/route.ts (fire-and-forget scan on install)
    - dashboard/tools/audit-hook.sh (mutation-only case filter)
    - dashboard/middleware.ts (security routes + operator gate)
    - dashboard/components/shell/build-rail.tsx (8 tabs, Security added)
    - dashboard/components/shell/build-rail.test.tsx (count 7→8, href added)
decisions:
  - Injectable spawnImpl pattern for gitleaks test isolation (avoids ESM sealed namespace issue)
  - Real temp dirs for filesystem tests instead of vi.spyOn on node:fs/promises
  - JSONL append-only for both audit log and scan results (no DB dependency)
  - Atomic overrides write: tmp file + chmod 0600 + fs.rename (TOCTOU safe)
  - Mutation-only hook filter in audit-hook.sh (Bash|Write|Edit|MultiEdit|Agent|Task)
  - Trust overrides stored in .cae/trust-overrides.json keyed by lowercase "owner/name"
  - Inner empty-state testid changed to "audit-table-empty" to avoid duplicate testid
metrics:
  duration_minutes: ~90
  completed: "2026-04-23"
  tasks_completed: 3
  tests_added: 40
  files_created: 31
  files_modified: 6
---

# Phase 14 Plan 05: Wave 4 Security Panel Summary

**One-liner:** Full security panel — 5-factor trust score heuristic, gitleaks scan integration, JSONL audit log with PostToolUse hook, 5 RBAC-gated API routes, and `/build/security` with 3 sub-tabs wired end-to-end.

## What Was Built

### Task 1 — Core Libraries (commit 1f3aceb)

**cae-skills-trust.ts** — `computeTrustScore(input)` with 5 weighted factors:
- Trusted owner (30%): anthropic, anthropic-labs, anthropics, vercel-labs, diiant
- Allowed-tools declared (20%)
- No risky tools (20%): Bash(rm/**/curl/wget/sudo/*)
- No secrets in env (20%)
- Recently updated (10%): within 90 days
- Short-circuits to total=100 if `overridden=true`

**cae-secrets-scan.ts** — `scanSkill(dir, spawnImpl?)` shells out to gitleaks with `--no-git --redact --report-format json`. DOC_EXAMPLES patterns filter false positives (placeholder values, REDACTED, xxxx). `appendScan()` appends to `.cae/metrics/skill-scans.jsonl`.

**cae-audit-log.ts** — `readAuditLog(filter)` aggregates across all project `.cae/logs/tool-calls.jsonl` files. Filters by from/to/tool/task, sorts descending, paginates.

**cae-trust-overrides.ts** — Reads/writes `.cae/trust-overrides.json`. Atomic write: tmp file → chmod 0600 → fs.rename. Keys lowercased "owner/name".

### Task 2 — API Routes + Hook Registration (commit ccb3eb4)

5 security API routes, all auth+role gated:
- `GET /api/security/trust` — viewer+, returns TrustEntry[]
- `POST /api/security/trust-override` — admin-only, validated owner/name pattern
- `POST /api/security/scan/[name]` — operator+, fire-and-forget scan (Next.js 15 async params)
- `GET /api/security/scans` — operator+, latest entry per skill from JSONL
- `GET /api/security/audit` — operator+, delegates to readAuditLog with limit cap 1000

`tools/audit-hook.sh` updated: mutation-only case filter at top — `Read/Glob/Grep` calls skipped, only `Bash|Write|Edit|MultiEdit|Agent|Task` logged.

`scripts/install-audit-hook.sh` — idempotent jq-based hook registration in `~/.claude/settings.json`.

### Task 3 — UI Components + Pages (commit d8ac399)

Components:
- **TrustBadge** — color-tiered (emerald 80+, amber 50-79, red <50) with `data-score` attr
- **TrustExplainer** — per-factor list with weight pill, ✓/✗, admin override button (RoleGate admin-only)
- **TrustGrid** — sorted ascending by score (worst first), click row expands explainer
- **SecretsReport** — grouped accordion, doc-example badge, Rescan button (operator+)
- **AuditTable** — filters (tool select, from/to dates, task text), pagination (50/page), expandable JSON row detail

Pages under `/build/security`:
- `page.tsx` — redirects to /skills
- `security-client.tsx` — 3-tab sub-nav (Skill Trust / Secrets / Tool Audit)
- `skills/page.tsx` — server-side fetch, TrustGridClient (client wrapper with override mutation)
- `secrets/page.tsx` — server-side fetch, SecretsReportClient (client wrapper with rescan)
- `audit/page.tsx` — server-side + operator gate, last 7 days, AuditTable

BuildRail updated 7→8 tabs: Security (ShieldCheck) between Schedules and Changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Next.js 15 params must be awaited**
- Found during: Task 2
- Issue: `app/api/security/scan/[name]/route.ts` used `params: { name: string }` — Next.js 15 changed route params to `Promise<{name}>`
- Fix: Changed to `params: Promise<{ name: string }>` + `const { name } = await params`
- Files modified: app/api/security/scan/[name]/route.ts
- Commit: ccb3eb4

**2. [Rule 2 - Missing field] TrustScore missing overridden field**
- Found during: Task 2
- Issue: `computeTrustScore` returns `overridden: true` but TrustScore interface lacked the field
- Fix: Added `overridden?: boolean` to TrustScore in lib/cae-types.ts
- Files modified: lib/cae-types.ts
- Commit: ccb3eb4

**3. [Rule 1 - Bug] vitest ESM mock hoisting — "Cannot access before initialization"**
- Found during: Task 1 TDD RED phase
- Issue: `const mockReadFile = vi.fn()` declared outside factory, hoisted by vitest above declaration
- Fix: Move vi.fn() calls inside mock factory; use spawnImpl injection pattern instead of mocking fs
- Files modified: lib/cae-secrets-scan.test.ts, lib/cae-trust-overrides.test.ts
- Commit: 1f3aceb

**4. [Rule 1 - Bug] React Fragment missing key prop in audit-table rows**
- Found during: Task 3 test run (stderr warning)
- Issue: `<>` used as fragment wrapper in `.map()` — React requires key on fragment
- Fix: Changed to `<Fragment key={rowKey}>` with Fragment import
- Files modified: components/security/audit-table.tsx
- Commit: d8ac399

**5. [Rule 1 - Bug] Test 5 "getByText(Bash)" ambiguous — matches dropdown option AND table row**
- Found during: Task 3 test run
- Issue: Tool name "Bash" appears in both the filter `<select>` options and the table rows
- Fix: Changed to `getAllByText("Bash").length >= 1` assertions
- Files modified: components/security/audit-table.test.tsx
- Commit: d8ac399

**6. [Rule 2 - Duplicate testid] audit-table had two data-testid="audit-empty"**
- Found during: Task 3 test debugging
- Issue: Early-return empty state + inner table empty state both had same testid
- Fix: Inner state renamed to `audit-table-empty` (shown when filters applied, no results)
- Files modified: components/security/audit-table.tsx
- Commit: d8ac399

## Known Stubs

None — all data is fetched from real API routes backed by real JSONL files. The `findings: []` in secrets page is intentional: full finding details not stored in JSONL (count only), documented in page comment.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input-validation | app/api/security/trust-override/route.ts | owner/name validated with `/^[A-Za-z0-9_.-]+$/` — path traversal prevented |
| threat_flag: file-permissions | lib/cae-trust-overrides.ts | trust-overrides.json written with chmod 0600 before rename — prevents world-read of override state |

## Self-Check: PASSED

All created files verified present. All 3 commits confirmed in git log.
- 1f3aceb: Task 1 libraries (40 tests → 20 pass at task 1 boundary)
- ccb3eb4: Task 2 API routes + hook
- d8ac399: Task 3 UI components + pages
- Final test run: 40/40 green, build clean
