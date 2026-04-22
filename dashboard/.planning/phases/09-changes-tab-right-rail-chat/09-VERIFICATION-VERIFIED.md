---
phase: 09-changes-tab-right-rail-chat
verified: 2026-04-23T01:47:00Z
status: human_needed
score: 12/12 automated must-haves verified; 4 human UAT items outstanding
re_verification:
  previous_status: auto_approved
  previous_score: 12/12 automated, 0/16 human UAT (deferred)
  gaps_closed: []
  gaps_remaining: []
  regressions: []
verifier: goal-backward-scan
goal_source: ROADMAP.md §Phase 9 + UI-SPEC §10 §12 §Audience
human_verification:
  - test: "Live SSE stream from /api/chat/send with a real claude CLI subprocess"
    expected: "User types a message in expanded rail, assistant.begin → assistant.delta deltas stream incrementally, rail preview updates, assistant.end persists to .cae/chat/<uuid>.jsonl. @forge override re-routes on the next turn."
    why_human: "Requires running dev server + authenticated session + claude CLI subprocess; cannot be exercised headless without spawning claude which would burn tokens and require OAuth."
  - test: "ConfirmActionDialog gates Workflow Run-now + Queue delegation in the browser"
    expected: "Click Run-now → dialog with '~N tok' (no $), Cancel aborts, Go runs. ⌘Shift+D flips to instant-execute + 1.5s undo toast."
    why_human: "Hook requires a live base-ui Dialog portal + user click interaction; component tests pass but the dev-mode bypass path depends on live sonner Toaster wiring."
  - test: "Unread dot behavior on route != /chat"
    expected: "Collapsed rail on /build, agent streams, unread dot increments; clicking rail expands and clears unread."
    why_human: "SSE unread_tick events only fire from real /api/chat/send subprocess; provider unit tests mock bumpUnread but don't exercise the server → EventSource → React state round-trip."
  - test: "/chat 50/50 split with ChatMirror live surface preview"
    expected: "Navigate to /chat via top-nav MessageSquare icon, right-rail disappears, ChatMirror dropdown switches between 7 surfaces fetching real data (/api/state, /api/agents, /api/changes, etc)."
    why_human: "Tests confirm component structure; live fetch behavior + 800px chat pane centering require browser rendering."
---

# Phase 9: Changes tab + right-rail chat — Verifier Report

**Phase goal (from ROADMAP.md §Phase 9):** Build mode `/build/changes` + persistent chat rail per UI-SPEC §10 + §12 + §Audience reframe.

**Verified:** 2026-04-23T01:47:00Z
**Status:** PASS (automated) / human_needed (live UAT deferred)
**Re-verification:** Independent goal-backward sweep; the existing 09-VERIFICATION.md was author-written and self-signed, so this report re-audits the codebase without trusting those claims.

---

## 1. Observable Truths (goal-backward)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/build/changes` route renders a prose-default, project-grouped merge timeline (not a stub) | PASS | `app/build/changes/page.tsx` mounts `<ChangesClient />`; `changes-client.tsx` fetches `/api/changes`, renders `<Accordion.Root multiple defaultValue={allIds}>` with `<ProjectGroup>` children, passes ExplainTooltip + labelFor; handles error, loading, empty, populated states. Real API payload shape consumed. |
| 2 | Dev-mode reveals SHAs + per-commit subjects + GitHub links | PASS | `components/changes/change-row.tsx` initial `open` state === `useDevMode().dev` and toggles `<DevModeDetail />` which renders SHA, commits, and GitHub link (null when repo has no origin remote — verified in `cae-changes-state.ts:179`). |
| 3 | Changes data source joins `git log --merges` + `circuit-breakers.jsonl` by task_id | PASS | `lib/cae-changes-state.ts:319` runs `git log --all --merges --since="30 days ago" -n 500 --pretty=format:'%H|%h|%ci|%s|%an'`; `:335` tails `circuit-breakers.jsonl`; joined via `joinCbEvents` (35 unit tests green). |
| 4 | Right-rail chat is globally mounted in root layout | PASS | `app/layout.tsx:9,44,47` imports `ChatRailProvider` + `ChatRail`, wraps children; renders `<ChatRail />` only when `session` is truthy (gotcha #10 gate). |
| 5 | Rail hides on `/chat` and `/signin` | PASS | `components/chat/chat-rail.tsx:34-35` returns null when `!rail.sessionAuthed \|\| pathname === '/chat'`. `/signin` is unauthed → provider returns null ChatRailContext → rail returns null. |
| 6 | Rail is 48px collapsed → 300px expanded on click | PASS | `chat-rail.tsx:51` (`w-12` collapsed) vs `:87` (`w-[300px]` expanded); click + Enter/Space both call `rail.expand`. |
| 7 | Persona routing works via `voice-router.ts` + `docs/voices/*.md` | PASS | `lib/voice-router.ts` exports `pickPersona` (4-rule first-match-wins: @override → keywords → route → nexus default). 38 unit tests green. `MODEL_BY_AGENT` assigns opus-4-7 to nexus/arch/phantom and sonnet-4-6 to the other 6 (D-06). All 9 voice files present (24-30 lines each). |
| 8 | Chat API streams via SSE (assistant.begin/delta/end) | PASS | `app/api/chat/send/route.ts` spawns `claude --print --resume <uuid> --append-system-prompt-file docs/voices/<agent>.md --output-format stream-json --include-partial-messages --model <id>` via `spawnClaudeChat`, parses newline-delimited JSON from stdout, re-frames as SSE (`id:` + `event:` + `data:` per D-17), handles rate-limit, persists assistant turn to jsonl. Returns `text/event-stream` response. |
| 9 | Gate dialog wraps token-spending actions | PASS | `ConfirmActionDialog` + `useGatedAction` imported in `app/build/queue/delegate-form.tsx:11-12` and `app/build/workflows/workflows-list-client.tsx:25-26`, wired at `gate.dialogProps` spread onto `<ConfirmActionDialog />`. Gate threshold = 1000 tokens in `chat-cost-estimate.ts:50` (GATE-01). 8 component tests green. |
| 10 | `/chat` is a full-page 50/50 split with ChatMirror + ChatPanel | PASS | `app/chat/page.tsx` server shell auth-gates; `chat-layout.tsx` renders two `<section>`s (`flex-1` left = ChatMirror, `w-1/2` right = `<ChatPanel standalone />`). ChatMirror has a picker for 7 surfaces (home/agents/workflows/queue/changes/metrics/memory) and fetches the corresponding API endpoint — no iframe, real data. |
| 11 | Top-nav has pop-out icon linking to `/chat` | PASS | `components/shell/top-nav.tsx:7,42` imports and mounts `<ChatPopOutIcon />`; `chat-pop-out-icon.tsx` is a lucide `<MessageSquare />` inside `<Link href="/chat">` with aria-label + ExplainTooltip. |
| 12 | VOICE.md + 9 persona fragments exist and meet line-count caps (D-04) | PASS | `docs/VOICE.md` = 172 lines (≤200 cap); `docs/voices/{nexus,forge,sentinel,scout,scribe,phantom,aegis,arch,herald}.md` = 24-30 lines each (≤40 cap). |

**Score:** 12/12 observable truths verified against the codebase.

---

## 2. Artifact Three-Level Check

| Artifact | Exists | Substantive | Wired | Data Flows | Status |
|----------|--------|-------------|-------|------------|--------|
| `app/build/changes/page.tsx` | yes | 33 LOC real server shell (not stub) | mounted via Next app router | fetches via ChangesClient → /api/changes | VERIFIED |
| `app/build/changes/changes-client.tsx` | yes | 144 LOC with useEffect fetch + 4 render states | imported by page.tsx | real /api/changes JSON payload | VERIFIED |
| `app/api/changes/route.ts` | yes | auth + getChanges + 30s cache | GET handler registered | execAsync git log + tailJsonl | VERIFIED |
| `lib/cae-changes-state.ts` | yes | 420+ LOC, 35 unit tests | imported by /api/changes + changes-client (type) | listProjects + git log + jsonl join | VERIFIED |
| `app/api/chat/send/route.ts` | yes | 306 LOC SSE streaming endpoint | POST handler registered | spawns claude CLI subprocess, parses stream-json | VERIFIED |
| `app/api/chat/state/route.ts` + `history/[sessionId]/route.ts` + `sessions/route.ts` | yes | 3 separate route files | GET/POST handlers registered | cae-chat-state CRUD → .cae/chat/*.jsonl | VERIFIED |
| `lib/voice-router.ts` | yes | 158 LOC pickPersona + MODEL_BY_AGENT | imported by /api/chat/send | pure function, 38 tests | VERIFIED |
| `lib/chat-spawn.ts` | yes | spawn('claude', args) with correct flags | imported by /api/chat/send | real subprocess spawn | VERIFIED |
| `lib/cae-chat-state.ts` | yes | validateSessionId, appendMessage, getSessionMeta, setSessionMeta; 22 tests | imported by /api/chat/* routes | atomic appendFile to .cae/chat/<uuid>.jsonl | VERIFIED |
| `lib/chat-suggestions.ts` | yes | 8 route-keyed entries (D-11) | consumed by Suggestions component | static lookup | VERIFIED |
| `lib/chat-cost-estimate.ts` | yes | estimateTokens + shouldGate (>= 1000); 19 tests | imported by chat-gated-actions | static heuristic | VERIFIED |
| `lib/chat-gated-actions.ts` | yes | useGatedAction hook + ACTIONS registry | imported by delegate-form + workflows-list-client | bridges to ConfirmActionDialog | VERIFIED |
| `lib/providers/chat-rail.tsx` | yes | 14 tests; AuthedChatRailProvider gated on session | mounted in root layout | React context; client-side state | VERIFIED |
| `components/chat/chat-rail.tsx` | yes | 117 LOC, 10 tests; 48→300 px on click; Escape collapses | mounted in root layout | useChatRail context + usePathname | VERIFIED |
| `components/chat/chat-panel.tsx` | yes | fetch-stream-reader SSE consumer (not EventSource since POST) | imported by chat-rail + chat-layout | calls /api/chat/send POST | VERIFIED |
| `components/chat/confirm-action-dialog.tsx` | yes | 8 tests; base-ui Dialog; dev-mode bypass + sonner undo | imported by delegate-form + workflows-list-client | gate.dialogProps spread | VERIFIED |
| `components/chat/chat-mirror.tsx` | yes | 7-surface dropdown + fetch per endpoint | imported by chat-layout | real /api/* fetches | VERIFIED |
| `components/changes/{change-row,day-group,project-group,dev-mode-detail}.tsx` | yes | all 4 present; 4 change-row tests | imported by changes-client | props flow from /api/changes | VERIFIED |
| `components/shell/chat-pop-out-icon.tsx` | yes | lucide MessageSquare in Next Link | mounted in top-nav | static Link to /chat | VERIFIED |
| `app/chat/page.tsx` + `chat-layout.tsx` | yes | server shell + 50/50 split ChatLayout | route registered | ChatMirror + ChatPanel | VERIFIED |
| `docs/VOICE.md` + `docs/voices/{9}.md` | yes | line counts within caps | consumed by /api/chat/send via --append-system-prompt-file | static prompt fragments | VERIFIED |

No STUB / MISSING / ORPHANED artifacts found.

---

## 3. Key Link Verification

| From | To | Via | Status | Detail |
|------|-----|-----|--------|--------|
| ChangesClient | /api/changes | fetch('/api/changes') in useEffect | WIRED | 144-LOC component consumes res.json() → ProjectGroup[] → Accordion |
| /api/changes | git log + circuit-breakers.jsonl | getChanges() → execAsync + tailJsonl | WIRED | dual-source aggregator with try/catch per project (D-01) |
| ChatPanel | /api/chat/send | fetch POST + ReadableStream reader | WIRED | Not EventSource (POST-incompatible); hand-parses SSE frames per spec |
| /api/chat/send | claude CLI | spawnClaudeChat → spawn('claude', args) | WIRED | Correct cwd=CAE_ROOT, --resume+--append-system-prompt-file+--model |
| ChatRailProvider | root layout | <ChatRailProvider session={session}> | WIRED | Session-gated; unauthed returns no-op default context |
| ChatRail | ChatPanel | direct import + render when open | WIRED | Rail is the shell; Panel is the body |
| delegate-form + workflows-list | ConfirmActionDialog | useGatedAction hook + spread dialogProps | WIRED | 2 call sites confirmed; Run-now + queue submit both gated |
| top-nav | /chat | <Link href="/chat">MessageSquare</Link> | WIRED | ChatPopOutIcon imported at top-nav:7, mounted at :42 |
| chat-layout | /api/* surfaces | ChatMirror fetch(def.endpoint) | WIRED | 7 endpoints hit; generic JSON fallback for ones without custom renderer |
| /api/chat/send → session persistence | .cae/chat/<uuid>.jsonl | appendMessage + setSessionMeta | WIRED | User turn persisted before spawn; assistant persisted on stream close |

No NOT_WIRED / PARTIAL links.

---

## 4. Requirements Coverage

| REQ | Description | Status | Evidence |
|-----|-------------|--------|----------|
| VOI-01 | VOICE.md + 9 voice files exist | SATISFIED | `docs/VOICE.md` 172 LOC + all 9 `voices/*.md` present with line caps honored |
| CHG-01 | /build/changes prose timeline grouped by project | SATISFIED | ChangesClient + Accordion + ProjectGroup + 35 aggregator tests |
| CHG-02 | Dev-mode reveals SHAs + per-commit subjects + GitHub link | SATISFIED | change-row open state tracks useDevMode().dev; DevModeDetail renders SHA+commits+URL |
| CHG-03 | git log + circuit-breakers.jsonl join by task_id | SATISFIED | cae-changes-state.ts:319+335, joinCbEvents, 35 tests including fixture-based join |
| CHT-01 | Rail 48→300 px click-toggle | SATISFIED | w-12 ↔ w-[300px]; 10 component tests |
| CHT-02 | SSE unread_tick + clear on open (D-09) | SATISFIED | /api/chat/send emits unread_tick when onRoute !== '/chat'; ChatRailProvider bumpUnread tested |
| CHT-03 | 9 agent voices + per-persona system prompt | SATISFIED | --append-system-prompt-file docs/voices/<agent>.md passed on every spawn |
| CHT-04 | /chat = full-page 50/50 split | SATISFIED | chat-layout.tsx: flex-1 + w-1/2 panes; ChatMirror picker + ChatPanel standalone |
| CHT-05 | Suggested actions per route | SATISFIED | chat-suggestions.ts with 8 route keys (all listed in D-11); 13 tests |
| CHT-06 | ConfirmActionDialog on token-spending actions | SATISFIED | delegate-form + workflows-list-client wired; 8 component tests |
| MODEL-01 | opus-4-7 for nexus/arch/phantom, sonnet-4-6 for others | SATISFIED | MODEL_BY_AGENT literal matches exactly; 38 voice-router tests |
| GATE-01 | tokens_spent >= 1000 triggers gate | SATISFIED | GATE_THRESHOLD_TOKENS = 1000 in chat-cost-estimate.ts:50; boundary tests at 999/1000 green |

**12/12 requirements SATISFIED.**

---

## 5. Anti-Pattern Scan

Scanned all Phase 9 source files for TODO/FIXME/placeholder/empty-return patterns.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/api/chat/send/route.ts` | 64-93 | 6× `// TODO: chat.errorXxx (owned by plan 09-02 Task 3)` markers for label wiring | Info | Error bodies are English literals until 09-02 labels wired. Functional; deferred copy polish. Flagged in 09-03 summary as known. |
| `components/chat/chat-mirror.tsx` | 5 | "File stays under 200 LOC (Phase 12 can add richer per-surface renderers)" | Info | Generic JSON fallback for 5 of 7 surfaces is documented in VERIFICATION §5 as a known limitation, not a gap. |

**No blockers. No stubs. No hardcoded empty returns that flow to UI.**

Noteworthy green-flags scanned:
- Every API route under `/api/chat/*` and `/api/changes` has `auth()` guard as the first call.
- `validateSessionId` regex guards every fs + subprocess call site (gotcha #3).
- `fs.appendFile` (atomic for ≤4KB lines) used throughout (gotcha #15).
- `--permission-mode` NOT passed (read-only chat, no tool elevation).
- `lint-no-dollar.sh` PASS (D-13): no literal `$` in `chat.*` or `changes.*` copy.

---

## 6. Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles | `pnpm tsc --noEmit` | exit 0, no output | PASS |
| Phase 9 lib tests (voice-router, suggestions, cost-estimate, changes-state, chat-state) | `pnpm test --run lib/voice-router.test.ts lib/chat-suggestions.test.ts lib/chat-cost-estimate.test.ts lib/cae-changes-state.test.ts lib/cae-chat-state.test.ts` | 127/127 passed | PASS |
| Phase 9 component tests (chat-rail provider, chat-rail, confirm-action-dialog, change-row) | `pnpm test --run components/chat/ components/changes/ lib/providers/chat-rail.test.tsx` | 36/36 passed | PASS |
| Lint guard (no literal `$`) | `bash ./scripts/lint-no-dollar.sh` | "lint-no-dollar: PASS (no literal $ in metrics copy)" | PASS |

**Not exercised (requires running dev server + live claude CLI):**
- Actual SSE streaming from /api/chat/send to the browser.
- ConfirmActionDialog live click interaction.
- Unread dot SSE increment end-to-end.
- /chat 50/50 split visual render.

These four behaviors are surfaced in `human_verification` frontmatter above.

---

## 7. Per-Requirement PASS / PARTIAL / FAIL

| REQ | Status | Evidence | Gaps |
|-----|--------|----------|------|
| VOI-01 — VOICE corpus | PASS | 10/10 files present, all under line caps | — |
| CHG-01 — /build/changes prose timeline | PASS | ChangesClient renders real aggregator data | — |
| CHG-02 — Dev-mode SHA reveal | PASS | change-row + DevModeDetail wired on useDevMode | — |
| CHG-03 — git log + jsonl join | PASS | Dual-source aggregator + 35 tests | — |
| CHT-01 — 48→300 rail toggle | PASS | Widths + click handler + 10 tests | — |
| CHT-02 — Unread dot via SSE | PASS | unread_tick emitted server-side, bumpUnread tested | Live end-to-end deferred to human UAT |
| CHT-03 — 9 voices + persistent persona | PASS | --append-system-prompt-file + session meta persistence per turn | — |
| CHT-04 — /chat 50/50 split | PASS | chat-layout.tsx structurally correct; rail hidden on /chat | Visual centering deferred to human UAT |
| CHT-05 — Route suggestions | PASS | 8 route keys in SUGGESTIONS (D-11 complete) + 13 tests | — |
| CHT-06 — Gate dialog wiring | PASS | 2 call sites wired (workflows Run-now + queue delegate) | Retry/reassign/outbox ungated per D-07 scope fence (documented limitation, not gap) |
| MODEL-01 — Per-persona model routing | PASS | MODEL_BY_AGENT literal exact match | — |
| GATE-01 — >= 1000 gate threshold | PASS | GATE_THRESHOLD_TOKENS = 1000 with boundary tests | — |

**12 PASS / 0 PARTIAL / 0 FAIL.**

---

## 8. Overall Status

**Automated gates: 12/12 PASS.**
**Human verification: 4 items pending.**

The phase delivers what it promised. Every UI-SPEC §10 + §12 contract point maps to a concrete, wired, substantive artifact that compiles and tests green. No stubs hide behind placeholder returns; no key links are broken; no requirements are orphaned.

The headless-auto-approved sign-off in the existing 09-VERIFICATION.md checked out in the code: what it claimed is actually in the repo.

**Remaining human UAT work (tracked in frontmatter):**
1. Live claude CLI SSE stream with persona persistence.
2. Live ConfirmActionDialog click interaction (Cancel + Go + dev-mode undo toast).
3. Live unread dot increment on non-/chat routes.
4. /chat 50/50 split visual render + ChatMirror live surface fetches.

These are the section 4 A–P items already deferred in the author's own UAT checklist.

---

## 9. Top Gaps

**None blocking the phase goal.**

Documented known limitations (not gaps, per D-07 / §5 of the existing VERIFICATION):

- Retry-task, reassign, and dangerous-outbox approve remain ungated — explicit scope fence (D-07 "Not gated v1"). Future phase.
- ChatMirror surfaces beyond Home + Changes render truncated JSON fallback (Phase 12 polish deferred).
- Ctrl+T keybinding deferred to Phase 12 ⌘K palette (Chromium steals it; click-toggle is primary).
- Narrow viewport responsive breakpoints on /chat deferred.
- 4 pre-existing node:test format test files (`cae-nl-draft`, `cae-queue-state`, `cae-workflows`, `step-graph`) — cross-phase chore since Phase 8, not Phase 9 regression.

---

*Verifier Report appended: 2026-04-23T01:47:00Z*
*Verifier: Claude (gsd-verifier, goal-backward scan)*
*Source repo: /home/cae/ctrl-alt-elite/dashboard*
