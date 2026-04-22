# Phase 10: Plan mode — Projects / PRDs / Roadmaps / UAT — Context (locked decisions)

**Source:** Synthesized from `10-RESEARCH.md` "Claude's Discretion" + recommendations (`--auto` flow, no interactive CONTEXT gathering).
**Locked:** 2026-04-23
**Status:** Ready for planning
**Primary users:** non-dev founders (Explain-mode default ON; Dev-mode ⌘Shift+D opt-in)

## Phase Boundary

Ship **Plan mode** — the `/plan/*` surface that wraps `/home/shift/bin/shift` (v3.0.0) for non-dev founders. Mutations detach into tmux sessions; UI polls `.shift/state.json` every 3s. Claude-owned drafting (PRD, ROADMAP) stays inside Shift's Arch persona; dashboard only patches `user_approved` gates and redraws.

**In scope (Phase 10 — 10 requirements):**

- REQ-10-01 — `/plan` home with project cards + lifecycle badges
- REQ-10-02 — new-project wizard, one-question-at-a-time, Nexus-narrated
- REQ-10-03 — server action → `shift new <name>` backend
- REQ-10-04 — PRD preview + Approve / Refine / Explain
- REQ-10-05 — ROADMAP draft + approve gate
- REQ-10-06 — auto-gen `.planning/phases/01-*/PLAN.md` from approved ROADMAP phase 1
- REQ-10-07 — "Ship it" fires `cae execute-phase N`, hands off to Build mode
- REQ-10-08 — UAT checklist from ROADMAP success criteria, per-item pass/fail
- REQ-10-09 — Ship wizard: env vars + `gh repo create` + `git push`
- REQ-10-10 — per-project scope picker (`?project=<absPath>`)

**Out of scope (explicit fence):**

- Multi-user / teams / permissions
- Cloud deploy beyond `git push` (no Vercel/Fly)
- Telegram deep-links (Phase 13+)
- Billing / usage caps
- LLM-driven wizard narration (v1 = canned Nexus copy; chat rail handles conversational refinement)
- SSE streams for `.shift/state.json` (v1 = 3s poll)
- Multi-account `gh` switching (v1 = single active `gh auth status`)

## Inherited Hard Locks (non-negotiable; cite by D-XX)

### D-00 — Dark theme + `@base-ui/react@1.4.0` + Tailwind v4
No `asChild` on base-ui primitives (see AGENTS.md gotcha, Phase 2). Use `<Link>` + `cn(buttonVariants(...))`. No shadcn. No light mode. All components use existing `components/ui/*`.

### D-00a — Founder-speak default via `lib/copy/labels.ts`
Add `plan.*` namespace (e.g., `plan.home.title`, `plan.wizard.idea.what`). Dev-mode opt-in (⌘Shift+D) reveals file paths, SHAs, Shift phase tags. Never display USD. Token counts only behind Advanced.

### D-00b — Explain-mode ON via `components/ui/explain-tooltip.tsx`
Every Plan-mode surface that introduces a new concept (PRD, ROADMAP, phase, UAT) gets an `<ExplainTooltip text="...">` alongside it. Copy lives in `lib/copy/labels.ts::explanations.plan.*`.

### D-00c — NO iframe, NO USD, NO shadcn
Native components only. Tokens are the only metric surfaced. Subscription-covered; never compute dollars.

## Locked Decisions (derive from RESEARCH "Claude's Discretion" + recommendations)

### D-01 — Wrap `/home/shift/bin/shift` via thin TS wrapper `lib/cae-shift.ts`
Do NOT reimplement Shift's intake in TypeScript. Dashboard is a **wrapper**. Every mutation = (a) build `SHIFT_ANSWERS` JSON file under `/tmp/shift-answers-<uuid>.json`, (b) spawn `tmux new-session -d -s <sid> "cd <proj> && SHIFT_NONINTERACTIVE=1 SHIFT_ANSWERS=<file> /home/shift/bin/shift <verb> [args] 2>&1 | tee <logFile>"`, (c) client polls `GET /api/plan/<slug>/state` every 3s. Breaks on Shift v3.1 = acceptable; migration path is rewrite the wrapper, not the UI.

### D-02 — Shift projects live at `$SHIFT_PROJECTS_HOME` (default `/home/cae`)
Extend `lib/cae-state.ts::listProjects` to scan `$SHIFT_PROJECTS_HOME` (default `/home/cae`) for directories containing `.shift/state.json`. Union with the existing hard-coded candidates list (dedup by absolute path). Add `shiftPhase: string | null` and `shiftUpdated: string | null` fields to the `Project` type. Sort by `shiftUpdated` descending when present; `hasPlanning` alone continues to qualify a project. Ship `SHIFT_PROJECTS_HOME=/home/cae` in `.env.example` with a comment pointing to this decision.

### D-03 — Per-project scope via `?project=<absPath>` query param (whitelist-validated)
Match the `/build?project=<path>` pattern already shipped. Server actions and API routes MUST pass the incoming path through `resolveProject(slugOrPath)` in `lib/cae-shift.ts`, which: (a) lists projects via `listProjects()`, (b) matches by absolute-path equality OR by `slug = path.basename(project.path)`, (c) returns `null` for any path not in the list. Unknown project → 404 JSON `{ error: "unknown project" }` (never shell out). `[slug]` in `/plan/[slug]/*` routes is the last path component; when absolute paths collide on basename, the query param tie-breaks.

### D-04 — Route structure: 7 `/plan/*` routes
Lock from RESEARCH §Architecture:
```
app/plan/
├── page.tsx                   # grid of project cards + "+ new project" tile
├── new/page.tsx               # 3-question wizard
└── [slug]/
    ├── layout.tsx             # PlanRail (PRD / ROADMAP / UAT / Ship)
    ├── page.tsx               # lifecycle summary
    ├── prd/page.tsx           # markdown render + Approve/Refine/Explain
    ├── roadmap/page.tsx       # markdown render + Approve (fires plan-gen)
    ├── uat/page.tsx           # phase-scoped checklists
    └── ship/page.tsx          # env + gh + push wizard
```
Default project = most-recent `.shift/state.json::updated` among `listProjects()` candidates. `/plan` always renders at least the "+ new project" tile even on empty host.

### D-05 — API surface: 6 routes under `app/api/plan/`
Lock from RESEARCH §Architecture:
```
app/api/plan/
├── projects/route.ts          # GET list (Plan-home state), POST new (wizard submit)
└── [slug]/
    ├── state/route.ts         # GET .shift/state.json + derived log-tail hint
    ├── prd/route.ts           # GET PRD.md contents, POST approve
    ├── roadmap/route.ts       # GET ROADMAP.md contents, POST approve (fires plan-gen)
    ├── uat/route.ts           # GET phase-scoped checklist, PATCH item status
    └── ship/route.ts          # POST env-write + gh-create + push
```
All routes: `auth()` guard first statement; `resolveProject(slug)` whitelist second. Unknown → 404 JSON.

### D-06 — Wizard: 3 questions mirroring Shift's `ask(qid, ...)` ids, canned Nexus narration
Shift's `cmd_new` asks: `idea.what`, `idea.who`, `idea.type_ok` / `idea.type_alt`. Dashboard wizard shows one question per step, renders a Nexus attribution line per question from `lib/copy/labels.ts::nexusWizardScript` (canned strings, zero token spend). On submit, write `{ "idea.what": ..., "idea.who": ..., "idea.type_ok": ... }` to `/tmp/shift-answers-<uuid>.json` and pass via `SHIFT_ANSWERS` env. Wizard state is client-only until final submit (no server persistence of partial answers). Canned copy beats live Claude spawn for v1 — saves ~200 tokens/wizard and eliminates the `claude --resume` session prerequisite.

### D-07 — Approve-gate = patch `state.json` directly, then spawn `shift next`
Match Shift's own mutations in `shift:182-230`. Server action reads `.shift/state.json`, flips `state.prd.user_approved = true` (or `state.roadmap.user_approved`), advances `state.phase`, appends a `history` entry with `action: "prd_approved" | "roadmap_approved"` and `outcome: "dashboard"`, writes back with `JSON.stringify(state, null, 2)`. Then spawn detached `shift next` to trigger the next phase. **Do not re-run `shift` synchronously for approvals** — PRD drafting takes 30-600s and must happen in tmux.

### D-08 — Refine-PRD opens the right-rail chat with PRD as context (reuse Phase 9)
Don't build a standalone refinement flow. "Refine" button on PRD/ROADMAP preview posts to a new chat session seeded with: `route: "/plan/[slug]/prd"`, `message: <PRD.md contents as a system-context note>`, persona forced to `arch`. Reuses `lib/chat-spawn.ts::spawnClaudeChat` + `lib/voice-router.ts` + `docs/voices/arch.md`. **Do not ship a dedicated modal.** Chat rail auto-expands (existing Phase 9 behavior on agent-streaming).

### D-09 — PLAN.md auto-gen: delegate to `gsd-planner` agent; fallback = Shift's `waiting_for_plans`
On ROADMAP approve: (a) parse ROADMAP.md, extract the `## Phase 1` section, (b) write `<proj>/.planning/phases/01-<slug>/BUILDPLAN.md` with the extracted section verbatim, (c) spawn `claude --print --append-system-prompt-file .claude/skills/cae-arch/persona.md --model claude-opus-4-7` with prompt "Draft PLAN.md from BUILDPLAN.md in the current working directory. Follow GSD plan structure." via tmux, (d) on subprocess failure (exit != 0 within 10 min), write a `PLAN.md` stub with content `# WAITING FOR PLANS\n\nAuto-generation failed. Run \`/gsd-plan-phase 01\` interactively.\n` and leave Shift's `state.phase = "waiting_for_plans"` unchanged. **No regression from Shift v3.0** — user can always fall back to the CLI. Record success/failure in `state.history`.

### D-10 — UAT item ids: `sha1(phaseN + bulletText).slice(0, 8)`
Parse `## Phase N` sections from ROADMAP.md; for each, match `Definition of done:` (case-insensitive) followed by a bulleted list; id = `createHash("sha1").update(`${phaseN}:${text}`).digest("hex").slice(0, 8)`. Persist `<proj>/.planning/uat/phase<N>.json` as `{ items: [{ id, label, status: "pending"|"pass"|"fail", note?: string, ts?: string }] }`. On ROADMAP revision: re-parse → match by id → new ids append → **missing ids stay in file flagged `orphaned: true`** (audit trail). PATCH `/api/plan/[slug]/uat` body `{ phase: number, id: string, status: "pass"|"fail", note?: string }` updates in place.

### D-11 — Ship wizard: `.env.example` parse + `gh auth status` gate + `gh repo create --push`
Parse `.env.example` with `/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/mg`; whitelist the extracted keys for write. User fills values in form; server writes `<proj>/.env.local` (0600) with ONLY whitelisted keys. Then: `execFile("gh", ["auth", "status"])` — exit != 0 → return `{ needsAuth: true }` and surface a Dialog with "Open terminal, run `gh auth login`, click Retry." Once authed, `execFile("gh", ["repo", "create", name, "--source=.", "--private", "--push"], { cwd: proj.path })`. Success → redirect `/build/phase/1?project=<absPath>`. **Do not attempt auto-auth** — browser/device-flow is interactive and won't work with stdio: "ignore".

### D-12 — "Ship it" button fires `cae execute-phase 1`, redirects to Build phase detail
Redirect target = `/build/phase/1?project=<absPath>`. Command = `tmux new-session -d -s "ship-${slug}-${Date.now().toString(36)}" "cd ${quote(proj.path)} && /usr/local/bin/cae execute-phase 1 2>&1 | tee .cae/logs/ship-phase1.log"`. Reuses the same tmux pattern as `app/api/workflows/[slug]/run/route.ts:95-106` (D-01 inheritance). Dashboard does NOT wait for completion — redirect fires immediately (HTTP 202 equivalent). Build-mode phase detail page takes over from there.

### D-13 — Polling cadence = 3s for state.json, match `/api/state` precedent
Client components under `/plan/[slug]/*` use the existing `usePoll(3000)` pattern (see `components/build-home/home-client.tsx` or equivalent). No SSE in Phase 10 — noted nice-to-have, deferred. Polling survives tab-inactive (explicit decision: founders leave tabs open; 3s polling is cheap against local file reads).

### D-14 — Security: path whitelist + shell-arg quoting + env-key whitelist
| Vector | Mitigation |
|--------|------------|
| Command injection via project name | Regex `/^[a-zA-Z0-9_-]{1,64}$/` validation in `app/api/plan/projects/route.ts` POST handler; `quote()` helper (ported from Shift or written inline) before shell interpolation |
| Path traversal via `?project=` | `resolveProject()` whitelist in `lib/cae-shift.ts`; reject any path not in `listProjects()` output |
| Arbitrary env writes via ship | Whitelist keys parsed from `.env.example`; reject any POSTed key not in set |
| `.env.local` file-mode | Write with `{ mode: 0o600 }` |
| Server reads of `.env.local` | Never echo back to client; ship response includes only written-key names, not values |

### D-15 — Validation: Vitest + @testing-library/react (Phase 8 inherited)
| Lib | Unit test | Command |
|-----|-----------|---------|
| `cae-shift` | `resolveProject`, `buildAnswersFile`, `approveGate` state patches | `npm test -- lib/cae-shift` |
| `cae-plan-gen` | `extractPhase1`, `stubPlan` | `npm test -- lib/cae-plan-gen` |
| `cae-uat` | `parseSuccessCriteria`, `patchUatState`, orphan detection | `npm test -- lib/cae-uat` |
| `cae-ship` | `parseEnvExample`, `ghAuthStatus` mock, `validateShipInput` | `npm test -- lib/cae-ship` |
| `cae-state` | `listProjects` extension (Shift detection) | `npm test -- lib/cae-state` |
| API routes | `app/api/plan/projects` POST, `app/api/plan/[slug]/prd` POST | `npm test -- app/api/plan` |

Wave 0 creates the test scaffolds + fixtures BEFORE any implementation lands.

### D-16 — Reuse Phase 9 artifacts verbatim
| Phase 9 artifact | Used in Phase 10 for | How |
|------------------|---------------------|-----|
| `lib/chat-spawn.ts` | D-08 Refine-PRD | Post-to-chat-rail with `route: "/plan/[slug]/prd"` + seeded context |
| `lib/voice-router.ts` | D-08 | `arch` persona forced via explicit `@arch` override in seeded message |
| `docs/voices/nexus.md` | D-06 wizard narration | Canned copy in `lib/copy/labels.ts::nexusWizardScript` echoes voice tone, zero spawn |
| `components/ui/explain-tooltip.tsx` | D-00b | Every Plan concept intro |
| `ConfirmActionDialog` + `useGatedAction` | "Ship it" button, PRD Approve, ROADMAP Approve | Token-spending gate reused for "about to spawn Arch for 30-600s" warning |

## Claude's Discretion

- Wizard component internal state shape (local `useReducer` vs. small `useState` array) — implementer's call.
- Whether "Refine" button opens chat rail via route change or programmatic `useChatRail()` hook — prefer hook if it exists; fall back to `router.push("/plan/[slug]/prd?chat=1")` + rail auto-open.
- Exact CSS grid breakpoints for project cards (bias toward `sm:grid-cols-2 lg:grid-cols-3`).
- Log-file naming inside `.shift/` (e.g., `.shift/roadmap.log`, `.shift/prd.log`) — follow existing `.shift/` conventions if present.

## Deferred (do not appear in any Phase 10 plan)

- Multi-account `gh` switching
- Telegram deep-link embeds on PRD/ROADMAP
- Live SSE stream of `.shift/state.json` changes
- LLM-driven wizard narration (canned-only in v1)
- PRD diff-between-revisions view
- UAT "walkthrough video" capture
- Multi-project UAT rollup
- Shift v3.1 migration hooks (wait for v3.1 to land)

## Phase Requirements → Plan Coverage Map

| REQ | Short name | Covered by |
|-----|-----------|------------|
| REQ-10-01 | /plan home + cards | 10-04 (state), 10-05 (API), 10-06 (UI) |
| REQ-10-02 | New-project wizard | 10-02 (lib), 10-05 (API), 10-06 (UI) |
| REQ-10-03 | `shift new` server action | 10-02 (lib), 10-05 (API) |
| REQ-10-04 | PRD Approve/Refine/Explain | 10-02 (approve-gate), 10-05 (API), 10-07 (UI) |
| REQ-10-05 | ROADMAP draft + approve | 10-02 (approve-gate), 10-05 (API), 10-07 (UI) |
| REQ-10-06 | Auto-gen PLAN.md | 10-03 (cae-plan-gen lib) |
| REQ-10-07 | "Ship it" → `cae execute-phase 1` | 10-04 (cae-ship lib), 10-05 (API), 10-07 (UI) |
| REQ-10-08 | UAT checklist | 10-03 (cae-uat lib), 10-05 (API), 10-07 (UI) |
| REQ-10-09 | Ship wizard: env + gh + push | 10-04 (cae-ship lib), 10-05 (API), 10-07 (UI) |
| REQ-10-10 | `?project=<path>` scope picker | 10-02 (resolveProject), 10-04 (listProjects), all UI plans |

## Assumptions carried forward (from RESEARCH Assumptions Log)

| # | Claim | Risk mitigation |
|---|-------|-----------------|
| A1 | Phase 9 shipped (verified — see STATE.md) | ✓ Confirmed — chat-spawn, voice-router, nexus.md all exist |
| A2 | `claude --print --append-system-prompt-file` works headless against any cwd | D-09 fallback = `waiting_for_plans` stub, no regression |
| A3 | `gh repo create --source=. --private --push` works once authed | D-11 gates on `gh auth status`, surfaces Dialog on failure |
| A4 | SHA1 id hashing survives minor ROADMAP edits | D-10 orphan-flag preserves lost ids for audit |
| A5 | `SHIFT_PROJECTS_HOME=/home/cae` is the right default | Documented in `.env.example`; overridable per-host |
