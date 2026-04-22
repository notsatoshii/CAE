# Phase 10: Plan mode — Projects / PRDs / Roadmaps / UAT — Research

**Researched:** 2026-04-22
**Domain:** Next.js 16 server-action front-end over `shift` + `cae` Python CLIs
**Confidence:** HIGH

## Summary

Shift **is real** — `/home/shift/bin/shift` v3.0.0 (Python, verified by `shift version`). Subcommands: `new / resume / next / status / help / learn / version` (no `prd` or `roadmap` subcommand — `shift next` dispatches by `state.phase`). State: `<project>/.shift/state.json` (schema_version 1). PRD/ROADMAP drafting spawns Arch (`claude --append-system-prompt-file agents/cae-arch.md`). Non-interactive mode via `SHIFT_NONINTERACTIVE=1` + `SHIFT_ANSWERS=<json>` + `SHIFT_AUTO_APPROVE=1` env vars. Shift v3.0 does NOT auto-generate `.planning/phases/NN-*/PLAN.md` — gap flagged in `shift:819-834`; we must fill it.

Dashboard already has the exact tmux-detach spawn pattern we need (`app/api/workflows/[slug]/run/route.ts:95-106`), markdown render stack (`react-markdown@10.1.0 + remark-gfm@4.0.1`), Nexus voice router (Phase 9 `lib/voice-router.ts`), and multi-project aggregator (`lib/cae-state.ts::listProjects`). `gh@2.89.0`, `git@2.43.0`, `tmux@3.4` all installed; `gh` is **NOT authed** — ship wizard must gate on `gh auth status`.

**Primary recommendation:** Wrap `/home/shift/bin/shift` via new `lib/cae-shift.ts` (mirror `lib/cae-workflows.ts`). 7 `/plan/*` routes, 5 API routes, 4 lib modules. Mutations = tmux-detached subprocess + state-file patch + client poll at 3s. Fire `gsd-planner` subprocess in a new `lib/cae-plan-gen.ts` the moment ROADMAP approval lands. Reuse Phase 9 `chat-spawn.ts` + nexus voice file for Refine-PRD conversation.

## User Constraints (from the planning brief)

### Hard locks (inherited Phases 3-9, non-negotiable)

- **Dark theme + `@base-ui/react@1.4.0` + Tailwind v4.** No `asChild` on base-ui primitives (AGENTS.md gotcha). Use `<Link>` + `cn(buttonVariants(...))`.
- **Founder-speak default** via `lib/copy/labels.ts`; **Explain-mode ON** via `components/ui/explain-tooltip.tsx`. Dev-mode opt-in (⌘Shift+D).
- **Tokens only, no USD** — never compute dollars anywhere.
- **Nexus persona narrates wizards** — reuse Phase 9 `docs/voices/nexus.md` + `lib/chat-spawn.ts::spawnClaudeChat`.
- **Multi-project aggregator pattern** — follow `lib/cae-home-state.ts` shape.
- **NO iframe — native components.**

### Claude's Discretion

- Route / module structure (recommendations below).
- Wizard state storage (reuse Shift-native `state.json` — recommend).
- Whether Refine-PRD opens chat rail or standalone action.
- Auto-gen PLAN.md vs. fall back to Shift's "waiting_for_plans".

### Deferred (out of scope)

Multi-user / teams; cloud deploy beyond `git push`; Telegram deep-links; billing gates.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-10-01 | `/plan` home with project cards + lifecycle badges | Extend `listProjects()` to scan `$SHIFT_PROJECTS_HOME` for `.shift/state.json::phase` |
| REQ-10-02 | New-project wizard, one-question-at-a-time, Nexus-narrated | Shift's `ask(qid, ...)` ids: `idea.what`, `idea.who`, `idea.type_ok`, `idea.type_alt` — mirror in dashboard, serialize to `SHIFT_ANSWERS` tmp file |
| REQ-10-03 | Server action → `shift new <name>` | `spawn("tmux", ["new-session", "-d", "-s", sid, "SHIFT_NONINTERACTIVE=1 SHIFT_ANSWERS=<tmp> /home/shift/bin/shift new <name> --dir /home/cae/<slug>"])` |
| REQ-10-04 | PRD preview + Approve / Refine / Explain | `react-markdown` renders `.shift/PRD.md`; Approve = patch `state.prd.user_approved`; Refine = open chat rail w/ PRD as context; Explain = inline tooltip |
| REQ-10-05 | ROADMAP draft + approve gate | Same pattern as PRD |
| REQ-10-06 | Auto-gen `.planning/phases/01-*/PLAN.md` from approved ROADMAP | Spawn `claude --agent gsd-planner --print` w/ Phase-1 section as buildplan; write to `<proj>/.planning/phases/01-<slug>/PLAN.md` |
| REQ-10-07 | "Ship it" fires `cae execute-phase N`, hands off to Build mode | Reuse tmux pattern (same `cae execute-phase` Shift uses at `shift:858`); redirect `/build/phase/1?project=<path>` |
| REQ-10-08 | UAT checklist from ROADMAP success criteria, per-item pass/fail | Parse `## Phase N` → `Definition of done:` bullets; id = `sha1(phaseN+text).slice(0,8)`; persist `<proj>/.planning/uat/phase<N>.json` |
| REQ-10-09 | Ship wizard: env vars + `gh repo create` + `git push` | Read `.env.example`; gate on `gh auth status`; `gh repo create <name> --source=. --private --push` |
| REQ-10-10 | Per-project scope picker | `?project=<absPath>` (pattern already used by `/build`); validate vs `listProjects()` whitelist |

## Standard Stack

All deps **already installed** (verified `package.json` + `npm view` 2026-04-22):

| Library | Installed | Purpose |
|---------|-----------|---------|
| `next` | `^16.2.4` | App Router + Server Actions + SSE |
| `react` | `^19.2.4` | RSC + client |
| `@base-ui/react` | `^1.4.0` (latest `1.4.1`) | Dialog, DropdownMenu, Tabs primitives |
| `react-markdown` | `10.1.0` | PRD/ROADMAP render |
| `remark-gfm` | `4.0.1` | GFM tables/strikethrough |
| `sonner` | `^2.0.7` | Approve/ship toasts |
| `next-auth` | `5.0.0-beta.31` | `auth()` server-action guard |

**Reuse from prior phases:**

| Module | Purpose |
|--------|---------|
| `app/api/workflows/[slug]/run/route.ts` | tmux-detached spawn template |
| `lib/cae-state.ts::listProjects` | multi-project enumerator (extend for Shift projects) |
| `lib/cae-home-state.ts` | aggregator pattern for `/plan` home |
| `lib/voice-router.ts` + `docs/voices/nexus.md` | Nexus narration (Phase 9) |
| `lib/chat-spawn.ts::spawnClaudeChat` | Refine-PRD conversation transport (Phase 9) |
| `components/ui/explain-tooltip.tsx` | Explain-mode everywhere (Phase 8) |

**New deps:** none.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shell out to `shift new` | Re-implement in TS | Duplicates ~200 LoC; breaks on Shift v3.1 upgrade — **don't.** |
| Fresh PLAN writer | Delegate to `gsd-planner` | Matches GSD workflow semantics |
| Polling state.json every 3s | SSE stream | Polling matches existing `/api/state` cadence; SSE nice-to-have for later |

## Architecture Patterns

### Route structure (7 routes)

```
app/plan/
├── page.tsx                       # grid of project cards (lifecycle badges)
├── new/page.tsx                   # 3-question wizard → POST /api/plan/projects
└── [slug]/
    ├── layout.tsx                 # PlanRail: PRD / ROADMAP / UAT / Ship
    ├── page.tsx                   # lifecycle summary
    ├── prd/page.tsx               # render .shift/PRD.md + Approve/Refine/Explain
    ├── roadmap/page.tsx           # render .shift/ROADMAP.md + Approve (triggers PLAN-gen)
    ├── uat/page.tsx               # per-phase checklists
    └── ship/page.tsx              # env-vars + gh repo create + git push
```

`[slug]` = last path component of `project.path`. Per-project scope via `?project=<absPath>` query (matches `/build`). Default project = most-recent `.shift/state.json::updated`.

### API routes (6) + lib modules (4)

```
app/api/plan/
├── projects/route.ts            # GET list, POST new
└── [slug]/
    ├── state/route.ts            # GET .shift/state.json
    ├── prd/route.ts              # GET md, POST approve
    ├── roadmap/route.ts          # GET md, POST approve (fires plan-gen)
    ├── uat/route.ts              # GET checklist, PATCH item
    └── ship/route.ts             # POST env+gh+push
lib/
├── cae-shift.ts                  # resolveProject, readShiftState, runShiftNew, runShiftNext, approveGate
├── cae-plan-gen.ts               # ROADMAP phase 1 → PLAN.md via gsd-planner spawn
├── cae-uat.ts                    # parseSuccessCriteria, load/patchUatState
└── cae-ship.ts                   # parseEnvExample, ghAuthStatus, runShipSteps
```

### Pattern: tmux-detached subprocess (use everywhere mutations spawn)

Verbatim from `app/api/workflows/[slug]/run/route.ts:95-106` [VERIFIED]:

```typescript
const sid = `plan-${verb}-${slug}-${Date.now().toString(36)}`
const inner = `cd ${quote(projectDir)} && SHIFT_NONINTERACTIVE=1 /home/shift/bin/shift next 2>&1 | tee ${logFile}`
spawn("tmux", ["new-session", "-d", "-s", sid, inner], { detached: true, stdio: "ignore" }).unref()
return Response.json({ sid }, { status: 202 })
```

### Pattern: Approve-gate = patch state.json directly (don't re-run shift for approval)

Shift's interactive `confirm()` is skippable. Once PRD file exists, dashboard patches state:

```typescript
state.prd.user_approved = true
state.phase = "roadmap"
state.updated = new Date().toISOString().replace(/\.\d+Z$/, "Z")
state.history.push({ ts: state.updated, action: "prd_approved", outcome: "via dashboard" })
await writeFile(stateFile, JSON.stringify(state, null, 2))
// then spawn `shift next` detached to trigger phase_roadmap
```

Matches Shift's own mutations in `shift:182-230`. Subsequent `shift next` picks up and runs the next phase.

### Pattern: Wizard mirrors Shift's `ask(qid, ...)` contract

Shift reads `SHIFT_ANSWERS` JSON keyed by question id. Dashboard wizard collects 3 answers, writes to `/tmp/shift-answers-<uuid>.json`, sets `SHIFT_ANSWERS` env on the spawn. Shift then runs idea → research → PRD sequence auto inside `cmd_new`.

### Anti-patterns to avoid

- Don't re-implement Shift's intake — `SHIFT_ANSWERS` envelope exists for this.
- Don't run `shift next` synchronously — PRD drafting can take 30-600s.
- Don't trust user-supplied project paths — resolve via `listProjects()` whitelist.
- Don't use `asChild` on base-ui components — use className merge instead.
- Don't display USD anywhere.

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| PRD drafting | `shift new` / `shift next` | Shift owns prompt + persona + retry |
| ROADMAP drafting | same | Same Arch persona + output format |
| Project state machine | `.shift/state.json` per project | Schema is versioned; Shift updates it |
| PLAN from ROADMAP | `claude --agent gsd-planner --print` | Matches GSD workflow semantics |
| GitHub repo create | `gh repo create --source=. --private --push` | Handles auth, default branch, remote |
| Markdown render | `react-markdown + remark-gfm` (Phase 8 pattern) | — |
| Wizard question logic | Shift's `ask(qid, ...)` via `SHIFT_ANSWERS` | Source of truth stays in Python |
| `.env.example` parse | regex `/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/mg` | Trivial; no dep |

**Key insight:** Phase 10 is a **wrapper**. Almost every mutation is "write prompt file → spawn subprocess → poll state file." Keep server modules thin; UX polish lives in client components.

## Common Pitfalls

1. **`gh auth login` is interactive** — opens browser or device-flow; neither works with stdin=ignore. **Fix:** gate on `gh auth status` first; if unauthed, surface Dialog with "open terminal, run `gh auth login`, click Retry." Optional: accept `GH_TOKEN` server-side. Current box is NOT authed.

2. **Shift's default projects dir = `~/projects` = `/root/projects`** (which doesn't exist on this user). **Fix:** set `SHIFT_PROJECTS_HOME=/home/cae` in `.env.local` + document; extend `listProjects()` scan.

3. **PLAN.md auto-gen is non-trivial** — `gsd-plan-phase` is normally interactive. **Fix:** (a) extract Phase-1 section from ROADMAP, (b) write `<proj>/.planning/phases/01-<slug>/BUILDPLAN.md`, (c) spawn `claude --print --append-system-prompt-file .claude/skills/cae-arch/persona.md --model claude-opus-4-7` with "Draft PLAN.md from BUILDPLAN.md". Fallback = leave as `waiting_for_plans` (matches Shift v3.0 behavior today, no regression).

4. **UAT item ids must survive ROADMAP edits** — re-parsing after revision can shift bullets. **Fix:** id = `sha1(phaseN + bulletText).slice(0,8)`. Match by hash; new ids appended; missing hashes marked orphaned (keep for audit).

5. **base-ui Tabs + Link — no `asChild`** (AGENTS.md gotcha). PlanRail uses `<Link>` w/ `cn(tabVariants(...))` className.

6. **Path traversal on `?project=<path>`** — always resolve slug → project from `listProjects()` output; reject unknowns before shelling out.

## Code Examples

### `listProjects()` extension (REQ-10-01)

```typescript
// lib/cae-state.ts — extend existing listProjects at line 75
const SHIFT_PROJECTS_HOME = process.env.SHIFT_PROJECTS_HOME ?? "/home/cae"

export async function listProjects(): Promise<Project[]> {
  const out: Project[] = []
  const entries = await readdir(SHIFT_PROJECTS_HOME, { withFileTypes: true }).catch(() => [])
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const projPath = join(SHIFT_PROJECTS_HOME, e.name)
    try {
      const state = JSON.parse(await readFile(join(projPath, ".shift/state.json"), "utf8"))
      out.push({
        name: state.project_name ?? e.name,
        path: projPath,
        hasPlanning: await exists(join(projPath, ".planning")),
        shiftPhase: state.phase,      // NEW field on Project type
        shiftUpdated: state.updated,  // NEW — sort key
      })
    } catch { /* not a shift project */ }
  }
  return out.sort((a, b) => (b.shiftUpdated ?? "").localeCompare(a.shiftUpdated ?? ""))
}
```

### Approve PRD server action (REQ-10-04)

```typescript
// app/plan/[slug]/prd/actions.ts
"use server"
import { spawn } from "child_process"
import { readFile, writeFile } from "fs/promises"
import { auth } from "@/auth"
import { resolveProject } from "@/lib/cae-shift"

export async function approvePrd(slug: string) {
  if (!(await auth())) throw new Error("unauthorized")
  const proj = await resolveProject(slug)               // whitelist-validates
  if (!proj) throw new Error("unknown project")

  const stateFile = join(proj.path, ".shift/state.json")
  const state = JSON.parse(await readFile(stateFile, "utf8"))
  state.prd.user_approved = true
  state.phase = "roadmap"
  state.updated = new Date().toISOString().replace(/\.\d+Z$/, "Z")
  state.history.push({ ts: state.updated, action: "prd_approved", outcome: "dashboard" })
  await writeFile(stateFile, JSON.stringify(state, null, 2))

  const sid = `plan-roadmap-${slug}-${Date.now().toString(36)}`
  const inner = `cd ${quote(proj.path)} && SHIFT_NONINTERACTIVE=1 /home/shift/bin/shift next 2>&1 | tee .shift/roadmap.log`
  spawn("tmux", ["new-session", "-d", "-s", sid, inner], { detached: true, stdio: "ignore" }).unref()
  return { ok: true, sid }
}
```

### UAT parser (REQ-10-08)

```typescript
// lib/cae-uat.ts
import { createHash } from "crypto"
export function parseSuccessCriteria(md: string): Map<number, UatItem[]> {
  const out = new Map<number, UatItem[]>()
  const re = /^##\s+Phase\s+(\d+).*?\n([\s\S]*?)(?=^##\s+Phase|\Z)/gm
  for (const m of md.matchAll(re)) {
    const phaseNum = parseInt(m[1], 10)
    const dod = m[2].match(/Definition of done:\s*\n([\s\S]*?)(?:\n\s*\n|$)/)
    const bullets = dod ? [...dod[1].matchAll(/^\s*-\s+(.+)$/gm)].map(b => b[1].trim()) : []
    out.set(phaseNum, bullets.map(text => ({
      id: createHash("sha1").update(`${phaseNum}:${text}`).digest("hex").slice(0, 8),
      label: text,
      status: "pending" as const,
    })))
  }
  return out
}
```

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `/home/shift/bin/shift` | PRD/ROADMAP | ✓ | 3.0.0 | — (hard dep) |
| `/usr/local/bin/cae` | execute-phase | ✓ | 0.2.0-T7 | — |
| `tmux` | detached spawn | ✓ | 3.4 | `spawn({detached:true})` w/o tmux |
| `gh` binary | repo create + push | ✓ | 2.89.0 | — |
| `gh auth status` | repo create | ✗ **not authed** | — | ship wizard gates + surfaces Dialog |
| `git` | push | ✓ | 2.43.0 | — |
| `claude` CLI | Arch spawn / plan-gen | assumed ✓ (Shift depends on it) | — | manual PLAN write |
| Python 3 + PyYAML | shift | ✓ (probe succeeded) | — | — |

**Blocking:** `gh` unauthed → ship wizard MUST handle; no hidden auto-auth.
**Env:** `SHIFT_PROJECTS_HOME=/home/cae` must ship in `.env.example`.

## Validation Architecture

### Framework: Vitest 1.6.1 + @testing-library/react 16.3.2 + jsdom 24.1.3 (inherited Phase 8).

| Property | Value |
|----------|-------|
| Quick run | `npm test -- lib/cae-shift lib/cae-uat lib/cae-plan-gen lib/cae-ship` |
| Full suite | `npm test` |

### Requirements → Tests

| Req | Type | Command | Exists? |
|-----|------|---------|---------|
| REQ-10-01 | unit | `npm test -- lib/cae-state.test.ts -t listProjects` | ❌ Wave 0 |
| REQ-10-02 | unit | `npm test -- lib/cae-shift.test.ts -t buildAnswers` | ❌ Wave 0 |
| REQ-10-03 | integration | `npm test -- app/api/plan/projects/route.test.ts` | ❌ Wave 0 |
| REQ-10-04 | unit | `npm test -- lib/cae-shift.test.ts -t approvePrd` | ❌ Wave 0 |
| REQ-10-05 | integration | `npm test -- app/api/plan/[slug]/roadmap/route.test.ts` | ❌ Wave 0 |
| REQ-10-06 | unit | `npm test -- lib/cae-plan-gen.test.ts` | ❌ Wave 0 |
| REQ-10-07 | e2e | human UAT | manual |
| REQ-10-08 | unit | `npm test -- lib/cae-uat.test.ts` | ❌ Wave 0 |
| REQ-10-09 | unit | `npm test -- lib/cae-ship.test.ts` | ❌ Wave 0 |
| REQ-10-10 | component | `npm test -- app/plan/page.test.tsx` | ❌ Wave 0 |

**Sampling:** quick per-task commit (<10s), full per-wave merge, full + manual UAT at phase gate.

### Wave 0 gaps

- [ ] `lib/cae-shift.test.ts`, `lib/cae-plan-gen.test.ts`, `lib/cae-uat.test.ts`, `lib/cae-ship.test.ts`
- [ ] `__fixtures__/plan/` — sample `state.json`, `PRD.md`, `ROADMAP.md`
- [ ] `__mocks__/child_process.ts` (if not already from Phase 9)

## Security Domain

### Applicable ASVS

| Category | Applies | Control |
|----------|---------|---------|
| V2 Authentication | yes | `auth()` on every server action + API route |
| V4 Access Control | yes | `slug` → `listProjects()` whitelist; reject unknowns |
| V5 Input Validation | yes | project name `/^[a-zA-Z0-9_-]{1,64}$/`; shell-arg quoting |
| V12 File/Path | yes | writes confined to resolved `project.path` + `.shift/` + `.planning/uat/`; reject `..` |

### Threats → mitigations

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Command injection via project name | Tampering | sanitize + quote before shell-out |
| Path traversal via `?project=` | Tampering | validate against `listProjects()` allow-list |
| Arbitrary env writes via ship | Tampering | whitelist keys from `.env.example` |
| `gh repo create` on wrong account | — | surface `gh auth status` + confirm gate |
| `.env.local` leak | Info disclosure | server reads only; never returned to client |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|--------------|
| A1 | Phase 9 ships before Phase 10 so `chat-spawn.ts` + `voice-router.ts` + `docs/voices/nexus.md` exist | Standard Stack | Phase 10 ships canned narrator copy; Refine-PRD waits on Phase 9 |
| A2 | `claude --agent gsd-planner` runs headless against any project dir | REQ-10-06 | Auto-gen falls back to Shift's `waiting_for_plans` state (no regression) |
| A3 | `gh repo create --source=. --private --push` works once authed | REQ-10-09 | User runs CLI manually; wizard surfaces error |
| A4 | Hashing success-criteria bullets gives stable ids across minor edits | REQ-10-08 | Wording change breaks; orphan-detection covers it |
| A5 | `SHIFT_PROJECTS_HOME=/home/cae` is acceptable | Env | `~/projects` scanned too if present; multiple candidates supported |

## Open Questions

1. **Auto-plan-gen failure mode** — (a) fail roadmap-approve, (b) approve + stub PLAN.md, (c) approve + let Shift's `waiting_for_plans` handle it? **Recommend (c)** — no regression from v3.0.
2. **Nexus narrator in wizard** — real Claude spawn per question vs canned copy? **Recommend canned** for v1; chat rail available if user wants conversation. Saves ~200 tokens/wizard.
3. **UAT state location** — `<proj>/.planning/uat/phaseN.json` vs centralized? **Recommend per-project**.
4. **Ship-it redirect target** — `/build?project=<path>` vs `/build/phase/1?project=<path>`? **Recommend deep link** into phase 1 detail.

## Sources

### HIGH (file read / shell probe this session)

- `/home/shift/bin/shift` v3.0.0 (1174 LoC — read cmd_new + phase_idea/research/prd/roadmap/execute + main dispatch)
- `/home/cae/ctrl-alt-elite/bin/cae` (help output)
- `/home/cae/ctrl-alt-elite/dashboard/package.json`
- `/home/cae/ctrl-alt-elite/dashboard/app/api/workflows/[slug]/run/route.ts` (tmux pattern)
- `/home/cae/ctrl-alt-elite/dashboard/lib/cae-state.ts::listProjects` (line 75)
- `/home/cae/ctrl-alt-elite/dashboard/lib/voice-router.ts` (Phase 9)
- `/home/cae/ctrl-alt-elite/dashboard/.planning/ROADMAP.md` (Phase 10 spec)
- `/home/cae/ctrl-alt-elite/dashboard/docs/UI-SPEC.md` §Plan mode + §Audience + §S4
- `/home/cae/ctrl-alt-elite/agents/cae-nexus.md`
- `/home/cae/ctrl-alt-elite/dashboard/AGENTS.md` (base-ui `asChild` gotcha)
- `/home/cae/ctrl-alt-elite/dashboard/.planning/phases/09-changes-tab-right-rail-chat/09-CONTEXT.md` + 09-03-PLAN.md
- Probes: `gh --version` / `gh auth status` / `tmux -V` / `git --version` / `shift version` / `npm view`

## Metadata

**Confidence breakdown:**
- Shift CLI shape: HIGH — read source, probed status
- Standard stack: HIGH — read installed package.json, verified via npm view
- Tmux spawn pattern: HIGH — copied verbatim from shipped Phase 6 code
- gh flow: MEDIUM — binary present, command verified by docs, end-to-end not exercised (unauthed)
- PLAN auto-gen: LOW — no precedent; based on gsd-planner contract reasoning (A2)

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (Shift v3.0 stable; Phase 9 ships within days)
