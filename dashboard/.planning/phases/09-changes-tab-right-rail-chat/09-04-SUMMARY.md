---
phase: 09-changes-tab-right-rail-chat
plan: 04
subsystem: frontend
tags: [wave-2, ui, changes, parallel-with-09-05]

# Dependency graph
requires:
  - phase: 09-changes-tab-right-rail-chat
    plan: 02
    provides: "ChangeEvent / ProjectGroup types, /api/changes route, changes.* labels"
  - phase: 08-memory-tab-markdown-graph
    provides: "ExplainTooltip primitive at components/ui/explain-tooltip.tsx"
provides:
  - "dashboard/app/build/changes/page.tsx — /build/changes server shell (auth + metadata)"
  - "dashboard/app/build/changes/changes-client.tsx — client island: fetches /api/changes + renders Accordion timeline"
  - "dashboard/components/changes/project-group.tsx — one base-ui Accordion.Item per project"
  - "dashboard/components/changes/day-group.tsx — today/yesterday/weekday/older bucketed sections"
  - "dashboard/components/changes/change-row.tsx — prose line + click-to-expand technical toggle"
  - "dashboard/components/changes/dev-mode-detail.tsx — SHA/branch/agent/tokens/commits/GitHub link panel"
affects: [09-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client/server bundle isolation: type-only import from lib/cae-changes-state (ChangeEvent, ProjectGroup) keeps Turbopack's client bundle from dragging in child_process. Runtime bucket math re-implemented inline in day-group.tsx — matches 09-02's UTC-day contract exactly."
    - "base-ui Accordion composition: Root multiple+defaultValue (uncontrolled expanded-by-default per D-12), Item with value={project.path}, Header wraps Trigger, Panel hosts body. No asChild anywhere (gotcha #5)."
    - "DevMode-driven open sync: ChangeRow seeds useState(dev) and uses a useEffect([dev]) to re-sync when ⌘/Ctrl+Shift+D toggles global DevMode at runtime — individual clicks remain sticky until the next global flip."

key-files:
  created:
    - "dashboard/app/build/changes/changes-client.tsx"
    - "dashboard/components/changes/project-group.tsx"
    - "dashboard/components/changes/day-group.tsx"
    - "dashboard/components/changes/change-row.tsx"
    - "dashboard/components/changes/change-row.test.tsx"
    - "dashboard/components/changes/dev-mode-detail.tsx"
  modified:
    - "dashboard/app/build/changes/page.tsx (stub → server shell)"

key-decisions:
  - "base-ui import path is `@base-ui/react/accordion` — the plan cited `@base-ui-components/react/accordion` but every existing base-ui import in this repo uses `@base-ui/react/*` and the installed package is `@base-ui/react@^1.4.0`. Corrected in both project-group.tsx and changes-client.tsx."
  - "Accordion.Root API is `multiple` boolean + `defaultValue` array of values (uncontrolled expanded). Not a `type='multiple'` string prop like Radix. Verified against node_modules/@base-ui/react/accordion/root/AccordionRoot.d.ts."
  - "day-group.tsx reimplements UTC-day bucketing inline rather than importing `relativeTime` from cae-changes-state. Reason: that lib imports `child_process`, and a value-level import into a client component makes Turbopack try to bundle child_process for the browser (fails). Types-only imports from that module are safe (erased at compile time)."
  - "ChangeRow open state seeds from `useDevMode().dev` and re-syncs on dev changes — so ⌘Shift+D flips all rows simultaneously. User clicks at the row level override until the next global flip."
  - "Lede uses local-calendar `toDateString()` equality to count 'today'. Founder mental model for 'today' is local wall-clock, not UTC — the founder lede copy `changesPageLede(n)` reads more naturally in local time. The bucketing inside Accordion bodies stays UTC to match the 09-02 server contract."

requirements-completed: [CHG-01, CHG-02]

# Metrics
duration: 11min
completed: 2026-04-22
---

# Phase 9 Plan 04: Wave 2a — Changes UI Summary

**Replaced the Phase 8 `/build/changes` stub with a live prose-default timeline: base-ui Accordion expanded by default per project, inner day-grouped ChangeRows whose `[technical]` toggle reveals SHA/branch/agent/tokens/per-commit list/GitHub link. 4/4 CHG-02 component tests green, `pnpm tsc --noEmit` exit 0, `pnpm build` compiles `/build/changes` into the route table, no literal `$` in any new file.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-04-22T15:25:59Z
- **Completed:** 2026-04-22T15:36:28Z
- **Tasks:** 2 / 2
- **Files created:** 6
- **Files modified:** 1

## Accomplishments

- **4 presentational components + 1 test file under `components/changes/`** (Task 1, commit `d509104`):
  - `dev-mode-detail.tsx` — leaf panel: branch/sha/agent/tokens/per-commit list/GitHub link, all null-guarded (gotcha #14: no `#` fallback, omit anchor entirely).
  - `change-row.tsx` — prose line + click-to-expand `[technical]` button + ExplainTooltip anchored per D-15. Open state seeded from `useDevMode().dev` and re-synced on toggle so ⌘Shift+D flips every row.
  - `day-group.tsx` — today/yesterday/weekday/older bucketing. Re-implements UTC-day math inline to avoid pulling `child_process` into the client bundle (see Deviations).
  - `project-group.tsx` — `Accordion.Item` with `value={project.path}`; header shows `changesProjectHeader(name, count)`; body renders `<DayGroup>`.
  - `change-row.test.tsx` — 4 CHG-02 assertions:
    1. prose renders on the default (founder) row;
    2. dev-mode-detail is hidden until the toggle is clicked;
    3. SHA + branch + GitHub link render when technical is open;
    4. GitHub link is omitted when `githubUrl === null`.
- **/build/changes route** (Task 2, commit `b41a619`):
  - `page.tsx` — server shell. `await auth()`; redirects to `/signin?from=/build/changes` if unauthenticated. Mounts `<ChangesClient/>`. `metadata.title = "Changes — CAE"`.
  - `changes-client.tsx` — `"use client"` island. Fetches `/api/changes` in a cancel-safe `useEffect`. Renders:
    - heading + `ExplainTooltip(changesExplainTimeline)` (D-15);
    - lede `changesPageLede(totalToday)` (local-calendar today count);
    - `Accordion.Root` with `multiple` + `defaultValue={allProjectIds}` — every project expanded on first render per D-12;
    - three branching states: `error` (changesFailedToLoad), `!data` (changesEmpty loading), `data.projects.length === 0` (heading + empty copy).
- **Founder default everywhere; no literal `$`**: every label call is `labelFor(useDevMode().dev)...`; `scripts/lint-no-dollar.sh` still PASS (unchanged scope); repo-wide grep for unescaped `$` outside template expressions in my files returns empty.
- **ExplainTooltip anchors** on page heading + tech-toggle button (D-15). Tooltips carry the frozen `changesExplainTimeline` / `changesExplainDevToggle` copy from 09-02.

## Accordion.Root usage (answers plan's output ask)

Uncontrolled, multi-expansion:

```tsx
<Accordion.Root
  multiple                                 // boolean, not `type="multiple"`
  defaultValue={allIds}                    // array of strings; no onValueChange
  className="…"
  data-testid="changes-accordion"
>
  {data.projects.map((g) => (
    <ProjectGroup key={g.project} group={g} />
  ))}
</Accordion.Root>
```

Each `ProjectGroup` is:

```tsx
<Accordion.Item value={group.project} className="…">
  <Accordion.Header className="m-0">        // base-ui renders <h3>
    <Accordion.Trigger className="…">       // base-ui renders <button>
      …project header label + chevron…
    </Accordion.Trigger>
  </Accordion.Header>
  <Accordion.Panel className="…">            // base-ui renders <div>
    <DayGroup events={group.events} />
  </Accordion.Panel>
</Accordion.Item>
```

No `asChild` anywhere (gotcha #5). Chevron rotation uses `group-data-[panel-open]:rotate-180` with a `group` class on Trigger — Trigger carries `data-panel-open` when the item is open (base-ui data attribute contract).

## Base-ui signature adaptations

1. **Import path.** Plan said `@base-ui-components/react/accordion`. Repo already uses `@base-ui/react/*` (confirmed across 14+ existing files: `components/ui/{sheet,tabs,popover,dialog,...}.tsx`). `package.json` dep is `"@base-ui/react": "^1.4.0"`. Corrected in both ProjectGroup and ChangesClient.
2. **Accordion.Root props.** Not `type="multiple"` (Radix shape). base-ui exposes a `multiple?: boolean` prop and accepts an array for `defaultValue`/`value`. See `node_modules/@base-ui/react/accordion/root/AccordionRoot.d.ts`. Used `multiple` (bare) + `defaultValue={allIds}`.
3. **Accordion.Header default element.** Renders an `<h3>`; my DayGroup day labels are also `<h3>`s. Accepts the nested-h3 visual-but-semantically-parallel landscape since base-ui types don't let me override Header's element (no `render`/`asChild` patterns — gotcha #5).

## Day-bucketing rule (answers plan's output ask)

Inlined in `day-group.tsx` (not imported from cae-changes-state — see Deviations):

| Condition (UTC) | Bucket | Section label (founder) |
|-----------------|--------|--------------------------|
| Same UTC calendar day as `now` | `today` | `"Today"` (changesDayToday) |
| UTC calendar day == `now` - 1 | `yesterday` | `"Yesterday"` (changesDayYesterday) |
| 2-6 day UTC delta | `week` keyed by UTC weekday name | `"Tuesday"`, etc. (changesDayWeek(day)) |
| ≥ 7 day UTC delta (or future) | `older` keyed by `"M/D"` UTC | verbatim `"M/D"` (label = key) |
| `Date.parse` NaN | `older` keyed `"—"` | `"—"` (defensive fallback) |

Section order is fixed: today → yesterday → week (insertion order per first-appearance) → older (insertion order). Events are sorted newest-first upstream by the 09-02 aggregator; within each bucket we append in-order so ordering is preserved.

## Task Commits

1. **Task 1: 4 presentational components + CHG-02 test file** — `d509104` (feat)
2. **Task 2: /build/changes page + client (stub → server shell + client island) + day-group.tsx refactor** — `b41a619` (feat)

## Decisions Made

- **Client-safe re-implementation of day-bucket math in day-group.tsx.** Original plan assumed we'd import `relativeTime` from `lib/cae-changes-state`. But that module's first `import` is `child_process`, which Turbopack cannot bundle for a Client Component. Rather than move helpers into a separate pure-TS file (touches 09-02's frozen surface), I re-implemented the bucket math inline — it's 30 lines, matches the documented UTC-day contract exactly, and keeps the client bundle clean. Types still imported `import type` from cae-changes-state (safe — erased at compile time).
- **Lede counts "today" in local calendar, not UTC.** Inside `changes-client.tsx`, `countEventsToday` uses `toDateString()` equality — founder reading the page thinks "today" = wall-clock today, not UTC. The in-Accordion bucketing stays UTC to line up with the server's 09-02 `relativeTime` contract (which is UTC for determinism). A minor divergence between "lede says 5 today" and "Today bucket shows 4" is possible around midnight UTC crossings but acceptable — the lede is a user-facing count, the bucket is a server-contracted heading.
- **ChangeRow sticky-but-global toggle.** Open state seeds from `useDevMode().dev` and re-syncs via `useEffect([dev])` so Ctrl/Cmd+Shift+D flips every row, but individual clicks remain sticky until the next global flip. Keeps "technical is available, just hidden" (Eric's call in must_haves) while respecting the global DevMode signal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `day-group.tsx` imported `relativeTime` (runtime value) from `lib/cae-changes-state`; that module imports `child_process`, breaking Turbopack's client bundle.**
- **Found during:** Task 2 verify (`pnpm build`). TSC was clean; build failed with `Can't resolve 'child_process'` tracing through `lib/cae-changes-state → day-group → project-group → changes-client → page`.
- **Fix:** Replaced the value-level import with a 30-line inline `bucketForTs(isoTs, now: Date)` helper that replicates the UTC-day contract. All remaining imports from `cae-changes-state` across the new files are `import type` only (types are erased at build).
- **Files modified:** `components/changes/day-group.tsx`.
- **Commit:** folded into `b41a619` (Task 2 commit) with a `[Rule 3 - Blocking]` prefix in the commit body.

**2. [Rule 1 - Bug] Plan's `import { Accordion } from "@base-ui-components/react/accordion"` would not resolve.**
- **Found during:** Task 1 authoring (pre-test `tsc`).
- **Issue:** The repo uses `@base-ui/react@^1.4.0`, and every existing base-ui import uses the `@base-ui/react/*` prefix. The plan's `@base-ui-components/react/accordion` path is wrong for this workspace.
- **Fix:** Corrected the import path to `@base-ui/react/accordion` in both `project-group.tsx` and `changes-client.tsx`. Verified correctness against `node_modules/@base-ui/react/accordion/index.d.ts` which exports `{ AccordionRoot as Root, AccordionItem as Item, AccordionHeader as Header, AccordionTrigger as Trigger, AccordionPanel as Panel }`.
- **Files modified:** both files, first-pass (never committed with the wrong path).

**3. [Rule 1 - Bug] Plan's `<Accordion.Root type="multiple" …>` was a Radix shape, not base-ui's.**
- **Found during:** Task 2 authoring.
- **Issue:** base-ui Accordion.Root exposes `multiple?: boolean` (not `type?: "single" | "multiple"`), verified against `node_modules/@base-ui/react/accordion/root/AccordionRoot.d.ts`.
- **Fix:** Used `<Accordion.Root multiple defaultValue={allIds} …>`.
- **Files modified:** `changes-client.tsx`.
- **Commit:** folded into `b41a619`.

### Deferred Items

None from 09-04's scope. Pre-existing dirty tree items untouched: `.planning/ROADMAP.md`, `.planning/STATE.md`, `next.config.ts` — orchestrator territory. Empty-test-suite files (`lib/cae-nl-draft.test.ts`, `lib/cae-queue-state.test.ts`, `lib/cae-workflows.test.ts`, `components/workflows/step-graph.test.tsx`) pre-date this plan and fail the vitest run as "no tests found" — out of scope.

## Issues Encountered

- **Early `pnpm tsc --noEmit` run transiently reported `components/chat/chat-rail.test.tsx` missing `./chat-rail` module.** That file belongs to 09-05 (parallel plan) and resolved itself by the time my Task 2 verify ran — 09-05's `ff537c3` commit added `components/chat/chat-rail.tsx`. No code change on my side.
- **Initial Turbopack build failure on `child_process` import.** Diagnosed and fixed as Rule-3 deviation above.

## Authentication Gates

None encountered. All work local.

## Self-Check: PASSED

**Files (7):**
- FOUND: dashboard/app/build/changes/page.tsx (modified — stub replaced)
- FOUND: dashboard/app/build/changes/changes-client.tsx
- FOUND: dashboard/components/changes/project-group.tsx
- FOUND: dashboard/components/changes/day-group.tsx
- FOUND: dashboard/components/changes/change-row.tsx
- FOUND: dashboard/components/changes/change-row.test.tsx
- FOUND: dashboard/components/changes/dev-mode-detail.tsx

**Commits (2):**
- FOUND: d509104 (Task 1 — 4 components + CHG-02 test)
- FOUND: b41a619 (Task 2 — /build/changes page + client + day-group.tsx rebuild fix)

**Verification sweeps:**
- `pnpm test -- --run components/changes/change-row.test.tsx` → 4/4 CHG-02 assertions passed; 231/231 aggregate tests passed
- `pnpm tsc --noEmit` → exit 0, clean
- `pnpm build` → `/build/changes` registered as dynamic route; all 10 static pages generated
- `./scripts/lint-no-dollar.sh` → PASS (metrics scope unchanged)
- `grep -rnE '(?<!\\)\$(?!\{)' components/changes/ app/build/changes/` → no literal `$` in any new file
- Stub text `"Coming in Phase 9"` no longer present in `page.tsx`

## Next Phase Readiness

**Ready for Wave 3+ consumption:**
- `09-06` ConfirmActionDialog wiring: no dependency on Changes UI.
- `09-07` /chat full-page 50/50 split route: imports `changes-client.tsx` not required — chat-mirror can render its own preview of Changes.

**Blockers:** None.

**Parallel plan 09-05 status:** Independent file-ownership as declared. 09-05 has shipped commits `ff537c3` + `85fbe88` for chat rail + layout mount during my execution window — no overlap with my files.

---
*Phase: 09-changes-tab-right-rail-chat*
*Completed: 2026-04-22*
