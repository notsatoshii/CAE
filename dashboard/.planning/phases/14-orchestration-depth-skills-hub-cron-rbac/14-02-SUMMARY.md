---
phase: 14-orchestration-depth-skills-hub-cron-rbac
plan: "02"
subsystem: skills-hub
tags: [skills-hub, catalog, install, sse, scraper, detail, drawer, build-rail]
dependency_graph:
  requires:
    - 14-01 (CatalogSkill type, fixture HTML files, spawn-mock helper, labels.skills.*)
  provides:
    - lib/cae-skills-parse.ts (parseSkillMd + SkillFrontmatter)
    - lib/cae-skills-scrape-shsh.ts (fetchSkillsSh)
    - lib/cae-skills-scrape-clawhub.ts (fetchClawHub)
    - lib/cae-skills-local.ts (readLocalSkillsDir + getSkillsDir)
    - lib/cae-skills-catalog.ts (getCatalog + dedupeMergeByName + 15-min cache)
    - lib/cae-skills-install.ts (installSkill AsyncGenerator)
    - app/api/skills/route.ts (GET /api/skills?q=)
    - app/api/skills/install/route.ts (POST /api/skills/install SSE)
    - app/api/skills/installed/route.ts (GET /api/skills/installed)
    - app/api/skills/[name]/route.ts (GET /api/skills/[name])
    - app/build/skills/page.tsx (/build/skills server page)
    - components/skills/* (SkillCard, CatalogGrid, InstallButton, SkillDetailDrawer)
    - components/shell/build-rail.tsx (6-tab BuildRail with Skills)
  affects:
    - 14-03 (cron page will use BuildRail — picks up 6-tab layout automatically)
    - 14-05 (trust-score engine reads skills from getSkillsDir + parseSkillMd)
tech_stack:
  added: []
  patterns:
    - "HTML scraper: regex-based card extraction with 1MB cap (no new deps)"
    - "Server-side 15-min in-memory cache (Map keyed by q+NODE_ENV)"
    - "AsyncGenerator over spawn stdout+stderr+close for SSE streaming"
    - "SSE ReadableStream pattern for install progress (install-button.tsx)"
    - "CAE_SKILLS_DIR env override for test isolation (getSkillsDir)"
key_files:
  created:
    - dashboard/lib/cae-skills-parse.ts
    - dashboard/lib/cae-skills-parse.test.ts
    - dashboard/lib/cae-skills-scrape-shsh.ts
    - dashboard/lib/cae-skills-scrape-clawhub.ts
    - dashboard/lib/cae-skills-scrape.test.ts
    - dashboard/lib/cae-skills-local.ts
    - dashboard/lib/cae-skills-local.test.ts
    - dashboard/lib/cae-skills-catalog.ts
    - dashboard/lib/cae-skills-catalog.test.ts
    - dashboard/lib/cae-skills-install.ts
    - dashboard/lib/cae-skills-install.test.ts
    - dashboard/app/api/skills/route.ts
    - dashboard/app/api/skills/route.test.ts
    - dashboard/app/api/skills/install/route.ts
    - dashboard/app/api/skills/install/route.test.ts
    - dashboard/app/api/skills/installed/route.ts
    - dashboard/app/api/skills/[name]/route.ts
    - dashboard/app/build/skills/page.tsx
    - dashboard/app/build/skills/skills-client.tsx
    - dashboard/app/build/skills/installed/page.tsx
    - dashboard/app/build/skills/[name]/page.tsx
    - dashboard/components/skills/skill-card.tsx
    - dashboard/components/skills/skill-card.test.tsx
    - dashboard/components/skills/catalog-grid.tsx
    - dashboard/components/skills/catalog-grid.test.tsx
    - dashboard/components/skills/skill-detail-drawer.tsx
    - dashboard/components/skills/install-button.tsx
    - dashboard/components/skills/install-button.test.tsx
    - dashboard/components/shell/build-rail.test.tsx
  modified:
    - dashboard/lib/cae-types.ts (add installs?, stars?, sources? to CatalogSkill)
    - dashboard/components/shell/build-rail.tsx (add Skills tab, Puzzle icon)
    - dashboard/tests/helpers/spawn-mock.ts (fix pre-existing TS overload error)
decisions:
  - "Regex-based HTML scraper (no node-html-parser dep) — fixtures define shape, ReDoS mitigated via non-nested quantifiers + 1MB cap"
  - "AsyncGenerator sequential stdout→stderr→close (not merge-queue) — simpler, matches mock behavior, real installs log both to stdout"
  - "CAE_SKILLS_DIR env var for test isolation instead of DI param — consistent with Node.js 12-factor pattern"
  - "spawn-mock interface simplified to single on() signature (no overloads in object literal) — TypeScript limitation"
  - "installCmd extracted from skill.installCmd (strips 'npx skills add ' prefix) in InstallButton — keeps SSE route simple"
metrics:
  duration_seconds: 884
  completed_date: "2026-04-23"
  tasks_completed: 3
  tasks_total: 3
  files_created: 29
  files_modified: 3
  tests_added: 54
  tests_passing: 54
---

# Phase 14 Plan 02: Skills Hub Summary

Skills Hub shipped as a complete vertical slice: 3-source catalog (skills.sh HTML scrape + ClawHub HTML scrape + local ~/.claude/skills/) with 15-min server cache, dedup-merge by owner/name, SKILL.md YAML parser, npx-skills-add streaming installer, 4 API routes, and /build/skills page with Catalog/Installed tabs + right-slide detail drawer + live install log. BuildRail extended to 6 tabs.

## Tasks Completed

| # | Name | Commit | Key Outputs |
|---|------|--------|-------------|
| 1 | Scrapers + parser + local reader + catalog | a83a015 | 6 lib files, 21 tests green |
| 2 | Install shell-out + 4 API routes | 6d88a48 | 5 route files + install lib, 13 tests green |
| 3 | /build/skills pages + components + BuildRail | 51eccf8 | 13 component/page files, 20 tests green |

## Verification Results

- `pnpm test lib/cae-skills app/api/skills components/skills components/shell/build-rail` — **54/54 pass** (11 test files)
- `pnpm build` — **clean** (7 new /skills routes compiled)
- Routes built: `/api/skills`, `/api/skills/[name]`, `/api/skills/install`, `/api/skills/installed`, `/build/skills`, `/build/skills/[name]`, `/build/skills/installed`

## Security Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-14-02-01: Injection via repo arg | `REPO_RE` + `URL_OK` allowlist regex; spawn argv array (no shell:true) |
| T-14-02-02: Path traversal via [name] segment | `sanitizeName()` strips non-`[A-Za-z0-9_.-]`; path.join constrained to skillsDir |
| T-14-02-03: ReDoS via malicious HTML | Non-backtracking regex (no nested quantifiers); 1MB HTML cap before parse |
| T-14-02-04: Concurrent install spam | Accepted-for-now; Plan 14-04 adds operator role gate |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing TS overload error in spawn-mock.ts blocked build**

- **Found during:** Task 2 build verification
- **Issue:** `tests/helpers/spawn-mock.ts` had method overload signatures inside an object literal — TypeScript doesn't allow overload signatures in object literal bodies (only in class bodies and interfaces). This caused `pnpm build` to fail before any Task 2 code was added.
- **Fix:** Replaced two-overload pattern with a single `on(event: string, cb: (code: number) => void)` signature. The interface was also simplified to match. All callers and tests still pass.
- **Files modified:** `tests/helpers/spawn-mock.ts`
- **Commit:** 6d88a48 (bundled with Task 2)

**2. [Rule 1 - Bug] installSkill async queue pattern deadlocked with spawn-mock**

- **Found during:** Task 2 TDD GREEN phase — test for stdout line events yielded 0 lines
- **Issue:** The original implementation used a shared event queue + Promise resolve pattern to merge stdout/stderr/close. The mock's `queueMicrotask` for close fired before the stdout AsyncIterable was consumed, causing the `close` event to drain the queue and return `done` before any `line` events were emitted.
- **Fix:** Sequential approach: drain stdout first → drain stderr → await close promise. Correct for the mock (which delivers all stdout before close) and for real npx usage (stdout + stderr before process exits).
- **Files modified:** `lib/cae-skills-install.ts`
- **Commit:** 6d88a48

**3. [Rule 2 - Missing Fields] CatalogSkill type missing installs?, stars?, sources? fields**

- **Found during:** Task 1 implementation — catalog code references these fields
- **Issue:** Plan's interface spec showed these fields but the Plan 14-01 scaffold only included the required fields. Fields were absent from `lib/cae-types.ts`.
- **Fix:** Added `installs?: number`, `stars?: number`, `sources?: Array<...>` with JSDoc to `CatalogSkill` interface.
- **Files modified:** `lib/cae-types.ts`
- **Commit:** a83a015

**4. [Rule 1 - Bug] Test ambiguity: two buttons matching /install/i in SkillCard**

- **Found during:** Task 3 TDD GREEN phase — `getByRole("button", { name: /install/i })` matched both the button's aria-label ("Install agent-skills") and its text content ("Install")
- **Fix:** Changed test queries to use `/install agent-skills/i` (the aria-label) which is unique per card.
- **Files modified:** `components/skills/skill-card.test.tsx`
- **Commit:** 51eccf8

## Known Stubs

**1. Trust score slot placeholder in SkillDetailDrawer and /build/skills/[name]/page.tsx**

- **File:** `components/skills/skill-detail-drawer.tsx` line 76 — `<div className="trust-slot-placeholder">`
- **File:** `app/build/skills/[name]/page.tsx` line 46 — same div
- **Text:** "Trust score coming in the Security panel."
- **Reason:** Trust score engine ships in Plan 14-05 per plan spec. This is intentional per REQ-P14-03.

**2. Auth TODO in API routes**

- **Files:** All 4 `app/api/skills/*/route.ts` files contain `// TODO(14-04): Add operator role gate`
- **Reason:** RBAC middleware ships in Plan 14-04. Routes are accessible without auth for now (solo-user v0.1 per T-14-02-04 accepted risk).

## Threat Flags

None — all new network endpoints are within the existing /api/* surface already in scope. The /build/skills/* pages are read-only renders with no new auth paths beyond what Plan 14-04 will gate.

## Self-Check: PASSED
