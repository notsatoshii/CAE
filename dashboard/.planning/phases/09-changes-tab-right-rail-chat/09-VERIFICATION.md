# Phase 9 Verification — Changes tab + right-rail chat

**Phase:** 09-changes-tab-right-rail-chat
**Plans covered:** 09-01 → 09-08
**Status:** [ ] Pending UAT / [ ] Signed off
**Signed:**     (Eric)
**Date:**

---

## 1. Automated gate

All commands run from `/home/cae/ctrl-alt-elite/dashboard`.

### 1a. Install

- [x] `pnpm install --frozen-lockfile` — **PASS** (zero new deps added in Phase 9; lockfile unchanged)

### 1b. TypeScript

- [x] `pnpm tsc --noEmit` — **exits 0, zero output** (verified 2026-04-23 after 09-07 commit `eaad289`)

### 1c. Tests

- [x] `pnpm test` — **239 / 239 tests passed** across 21 Vitest-native files

  Pre-existing 4 "No test suite found" failures (node:test format, pre-Vitest) are **expected out-of-scope** — documented since 08-01-SUMMARY, tracked as a cross-phase chore:
  - `lib/cae-nl-draft.test.ts` — node:test format, no regression
  - `lib/cae-queue-state.test.ts` — node:test format, no regression
  - `lib/cae-workflows.test.ts` — node:test format, no regression
  - `components/workflows/step-graph.test.tsx` — node:test format, no regression

  **Phase 9 test files confirmed passing:**

  | File | Tests |
  |------|-------|
  | `lib/voice-router.test.ts` | 38 |
  | `lib/chat-suggestions.test.ts` | 13 |
  | `lib/chat-cost-estimate.test.ts` | 19 |
  | `lib/cae-changes-state.test.ts` | 35 |
  | `lib/cae-chat-state.test.ts` | 22 |
  | `lib/providers/chat-rail.test.tsx` | (Phase 9 Wave 2 provider tests) |
  | `components/chat/chat-rail.test.tsx` | (Phase 9 Wave 2 component tests) |
  | `components/chat/confirm-action-dialog.test.tsx` | 8 |
  | `components/changes/change-row.test.tsx` | (Phase 9 Wave 2 component tests) |

  **To re-run Phase 9 suites individually:**
  ```bash
  pnpm test lib/voice-router.test.ts
  pnpm test lib/chat-suggestions.test.ts
  pnpm test lib/chat-cost-estimate.test.ts
  pnpm test lib/cae-changes-state.test.ts
  pnpm test lib/cae-chat-state.test.ts
  pnpm test lib/providers/chat-rail.test.tsx
  pnpm test components/chat/chat-rail.test.tsx
  pnpm test components/chat/confirm-action-dialog.test.tsx
  pnpm test components/changes/change-row.test.tsx
  ```

### 1d. Lint

- [x] `./scripts/lint-no-dollar.sh` — **PASS** (no literal `$` in Phase 9 copy; all `chat.*` and `changes.*` label keys pass)

  ```bash
  ./scripts/lint-no-dollar.sh
  # Expected: "lint-no-dollar: PASS (no literal $ in metrics copy)"
  ```

### 1e. Build

- [x] `pnpm build` — **exits 0** — all Phase 9 routes registered in build output:

  | Route | Status |
  |-------|--------|
  | `/build/changes` | ƒ (Dynamic) — replaces Phase 7 stub |
  | `/chat` | ƒ (Dynamic) — full-page split |
  | `/api/changes` | ƒ (Dynamic) |
  | `/api/chat/send` | ƒ (Dynamic) |
  | `/api/chat/state` | ƒ (Dynamic) |
  | `/api/chat/history/[sessionId]` | ƒ (Dynamic) |
  | `/api/chat/sessions` | ƒ (Dynamic) |

  Full route table verified at 2026-04-23 from `pnpm build` output after 09-07 commit.

---

## 2. File presence (per locked decisions)

Run from `/home/cae/ctrl-alt-elite/dashboard`:

```bash
# VOI-01: VOICE corpus
test -f docs/VOICE.md && echo "PASS: VOICE.md" || echo "FAIL: VOICE.md"
for a in nexus forge sentinel scout scribe phantom aegis arch herald; do
  test -f "docs/voices/$a.md" && echo "PASS: voices/$a.md" || echo "FAIL: voices/$a.md"
done

# D-04: Line count guards
wc -l docs/VOICE.md   # must be <= 200 (actual: 172)
for a in nexus forge sentinel scout scribe phantom aegis arch herald; do
  wc -l "docs/voices/$a.md"  # each must be <= 40 (actual: 24-30)
done
```

- [x] `docs/VOICE.md` exists, **172 lines** (≤ 200 cap — D-04) **FOUND**
- [x] All 9 `docs/voices/{agent}.md` exist, each **24–30 lines** (≤ 40 cap — D-04) **FOUND**
- [x] `lib/voice-router.ts` exports `pickPersona`, `MODEL_BY_AGENT`, `modelForAgent` (D-05, D-06) **FOUND**
- [x] `lib/chat-suggestions.ts` covers all 8 routes listed in D-11 (SUGGESTIONS map) **FOUND**
- [x] `lib/chat-cost-estimate.ts` gates at `>= 1000` tokens (D-07, GATE-01) **FOUND**
- [x] `lib/cae-changes-state.ts` produces 30-day dedupe'd ChangeEvent[] (D-01, D-02) **FOUND**
- [x] `lib/cae-chat-state.ts` stores jsonl at `${CAE_ROOT}/.cae/chat/<uuid>.jsonl` (D-08) **FOUND**
- [x] `components/chat/chat-rail.tsx` 48 → 300 px on click (CHT-01, D-10) **FOUND**
- [x] `components/chat/confirm-action-dialog.tsx` gates token-spending actions (CHT-06) **FOUND**
- [x] `app/chat/page.tsx` exists and renders a 50/50 split (CHT-04, D-16) **FOUND**

---

## 3. Requirement coverage

| REQ | Description | Automated verify command | Status |
|-----|-------------|--------------------------|--------|
| VOI-01 | `docs/VOICE.md` + 9 persona fragments | `test -f docs/VOICE.md && for a in nexus forge sentinel scout scribe phantom aegis arch herald; do test -f docs/voices/$a.md \|\| exit 1; done && echo PASS` | [x] PASS |
| CHG-01 | `/build/changes` prose timeline grouped by project for 30-day window | `pnpm test lib/cae-changes-state.test.ts` + manual UAT §4 item 7 | [ ] PENDING UAT |
| CHG-02 | ⌘Shift+D reveals SHAs, per-commit subjects, GitHub link; founder-mode per-row click opens technical panel | `pnpm test components/changes/change-row.test.tsx` + manual UAT §4 item 8-9 | [ ] PENDING UAT |
| CHG-03 | Aggregator joins `git log --merges` with `forge_end` events by `task_id` from branch name | `pnpm test lib/cae-changes-state.test.ts` (35 tests; `joinCbEvents` + integration tests) | [x] PASS |
| CHT-01 | Rail is 48px by default; click expands to 300px | `pnpm test components/chat/chat-rail.test.tsx` + manual UAT §4 item 2 | [ ] PENDING UAT |
| CHT-02 | Unread dot shows + clears per D-09 | `pnpm test lib/providers/chat-rail.test.tsx` + manual UAT §4 items 1-2 | [ ] PENDING UAT |
| CHT-03 | Nine agent voices — each persona fragment is a valid system-prompt file | `for a in nexus forge sentinel scout scribe phantom aegis arch herald; do test -f docs/voices/$a.md \|\| exit 1; done` | [x] PASS |
| CHT-04 | `/chat` full-page split renders ChatMirror + ChatPanel | `grep -r "ChatMirror\|ChatLayout" app/chat/ && pnpm build \| grep '/chat'` + manual UAT §4 item 13-14 | [ ] PENDING UAT |
| CHT-05 | Suggestions chips appear below input for matching route | `pnpm test lib/chat-suggestions.test.ts` + manual UAT §4 item 6 | [ ] PENDING UAT |
| CHT-06 | Clicking Run-now on a workflow shows ConfirmActionDialog with token estimate | `pnpm test components/chat/confirm-action-dialog.test.tsx` + manual UAT §4 items 10-12 | [ ] PENDING UAT |
| MODEL-01 | `MODEL_BY_AGENT` has `claude-opus-4-7` for nexus/arch/phantom; `claude-sonnet-4-6` for the other six | `pnpm test lib/voice-router.test.ts` + `grep -A 20 "MODEL_BY_AGENT" lib/voice-router.ts` | [x] PASS |
| GATE-01 | `shouldGate({type:'delegate_new'}) === true` (returns 8000 >= 1000) | `pnpm test lib/chat-cost-estimate.test.ts` (19 tests; boundary 999/1000 cases included) | [x] PASS |

**One-shot verify for all automated REQs:**

```bash
cd /home/cae/ctrl-alt-elite/dashboard

# VOI-01 + CHT-03
test -f docs/VOICE.md && for a in nexus forge sentinel scout scribe phantom aegis arch herald; do test -f "docs/voices/$a.md" || exit 1; done && echo "PASS: voice corpus"

# MODEL-01 — grep the const
grep -A 12 "MODEL_BY_AGENT" lib/voice-router.ts | grep -E "nexus|arch|phantom" | grep "opus" && echo "PASS: opus-for-orchestrators"

# GATE-01 — unit test
pnpm test lib/chat-cost-estimate.test.ts

# CHG-03 — aggregator tests
pnpm test lib/cae-changes-state.test.ts

# All 239 tests
pnpm test
```

---

## 4. Human UAT checklist (run dev server: `pnpm dev`)

**Pre-condition:** Sign in first via GitHub OAuth at `http://localhost:3000/signin`. Confirm `/signin` does NOT render a chat rail.

### Build / Chat Rail

- [ ] **(A) /build** — chat rail is visible on the right edge at 48px with a live-status dot (not an error dot)
- [ ] **(B) Click the rail** → expands to 300px; input is focusable, placeholder text visible
- [ ] **(C) Type a message + Enter** → see streaming response from Nexus (dry, playful voice per docs/voices/nexus.md); "CAE is thinking…" shows during stream
- [ ] **(D) @-mention routing** — type `@forge what's the build status?` → response attributed to Forge persona; persona persists on the next turn
- [ ] **(E) Collapse** — press Escape → rail returns to 48px
- [ ] **(F) Route-keyed suggestions** — navigate to `/metrics` → rail still shows; try the default suggestion "Am I overspending?" chip below input → chip fills input and sends

### Changes Timeline

- [ ] **(G) /build/changes** — prose timeline appears grouped by project; today's activity uses "this morning / this afternoon / this evening" relative time; no SHAs visible by default (founder mode)
- [ ] **(H) Technical expand** — click `[▾ technical]` on a row → SHA (short), per-commit subjects, and GitHub link appear (link only if repo has a GitHub remote; no `#` fallback if none)
- [ ] **(I) Dev-mode flip** — press ⌘Shift+D → all technical panels auto-expand across the timeline; copy flips to dev-speak throughout the page; press again → reverts to founder-mode

### Gate Dialog

- [ ] **(J) Workflow Run-now gate** — navigate to `/build/workflows` → click "Run now" on any recipe → ConfirmActionDialog appears with: summary sentence, token estimate (`~N tok`, no `$` anywhere), Cancel + Go buttons
  - Click **Cancel** → dialog closes; workflow does NOT run
  - Click **Go** → dialog closes; workflow run fires
- [ ] **(K) Dev-mode bypass** — toggle ⌘Shift+D on, click "Run now" → no modal; workflow fires instantly + 1.5s "Undo" toast appears in corner
- [ ] **(L) Queue delegation gate** — navigate to `/build/queue` → click "New job" → fill in BUILDPLAN text → click Send → gate dialog shows with a summary containing the first ~80 chars of the plan → click Go → job appears in the queue

### /chat full-page split

- [ ] **(M) Chat pop-out icon** — click the MessageSquare icon in the top-nav right cluster → lands on `/chat`; right-rail is HIDDEN on this page
- [ ] **(N) 50/50 split layout** — left pane shows ChatMirror with surface picker (select dropdown); right pane shows full-height chat panel (max-w 800px centered)
- [ ] **(O) Mirror picker** — pick "Changes" in the dropdown → left pane shows the Changes summary (project groups with prose); right pane chat still works
- [ ] **(P) Return to /build** → right-rail reappears at 48px

---

## 5. Known limitations (pre-documented, not gaps)

- **Ctrl+T keybinding not wired** (D-10). Ctrl+T is stolen by Chromium at browser-chrome level. Click-toggle is the primary mechanism. Phase 12 ⌘K palette will add an "Open chat" command.
- **ChatMirror JSON fallback for 5 surfaces**: Agents / Workflows / Queue / Metrics / Memory render truncated JSON (2000 chars). Home + Changes have rich prose renderers. Phase 12 polish will wire richer per-surface modes.
- **Only three gate sites in Wave 3**: Workflows Run-now + queue delegation. Retry-task, reassign, and outbox-approve remain ungated — per D-07 "Not gated v1" scope fence. Documented in 09-06-SUMMARY.
- **VOICE.md sign-off** — wave-0 surfaced VOICE.md to orchestrator per D-04. Optional sign-off was non-blocking. Any persona drift after live testing → gap-closure plan via `/gsd-plan-phase 09 --gaps`.
- **4 pre-existing node:test suites** — `cae-nl-draft`, `cae-queue-state`, `cae-workflows`, `step-graph` fail under Vitest with "No test suite found". Pre-date Phase 9; tracked as cross-phase chore since 08-01.
- **Narrow viewport on /chat** — below ~800px total width, left pane compresses to near-zero. Responsive breakpoints deferred to Phase 12.

---

## 6. VOICE.md sign-off notice

Per D-04, VOICE.md was surfaced to the orchestrator at end of Wave 0 (09-01-SUMMARY). User sign-off on persona voice/tone is **optional and non-blocking** for the Phase 9 automated gate. If any persona voice drifts after UAT live testing, file a gap-closure plan via `/gsd-plan-phase 09 --gaps` rather than editing in place.

**VOICE.md path:** `/home/cae/ctrl-alt-elite/dashboard/docs/VOICE.md`

---

## 7. Sign-off

I have executed sections 1–4 and the output matches expectations.

- [ ] Signed (Eric)
- Date:
- Notes:

---

*Phase: 09-changes-tab-right-rail-chat*
*Plans covered: 09-01 through 09-08*
*Automated sweep: 2026-04-23*
*Verifier: Claude executor (automated) + Eric (human UAT — pending)*
