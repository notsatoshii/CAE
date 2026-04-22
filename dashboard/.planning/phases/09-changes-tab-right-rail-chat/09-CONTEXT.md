# Phase 9: Changes tab + right-rail chat — Context (locked decisions)

**Gathered:** 2026-04-22
**Status:** Ready for planning (wave 0 starts immediately after VOICE.md user-surface)
**Source:** UI-SPEC.md §10 + §12 + §Audience reframe + §S4.6 + 09-RESEARCH.md + locked decisions from the planning brief (2026-04-22)
**Primary users:** non-dev founders (Explain-mode default ON, Dev-mode opt-in ⌘Shift+D)

## Phase Boundary

Ship two pillars over **7 plans in 6 waves**:

1. **Build-mode `/build/changes`** — prose-default merge timeline grouped by project. Dev-mode reveals SHAs, per-commit subjects, and GitHub links.
2. **Persistent right-rail chat** — 48px collapsed / 300px expanded, click-toggle. Nine agent voices. Message transport is `claude --print --resume <uuid> --append-system-prompt-file docs/voices/{agent}.md` spawned via tmux. SSE stream back to the client. `/chat` full-page 50/50 split route. Nexus "explain before doing" gate on token-spending server actions.

**In scope (Phase 9):**
- Wave 0 — `docs/VOICE.md` + 9 persona system-prompt fragments under `docs/voices/{agent}.md` + 3 pure-TS libs (`lib/voice-router.ts`, `lib/chat-cost-estimate.ts`, `lib/chat-suggestions.ts`) with unit tests.
- Wave 1 (two plans parallel) —
  - 09-02 Changes aggregator: `lib/cae-changes-state.ts` + `/api/changes` route + `changes.*` labels.
  - 09-03 Chat API routes: `lib/cae-chat-state.ts` + 4 routes (`send`, `state`, `history/[id]`, `sessions`) + `chat.*` labels.
- Wave 2 (two plans parallel) —
  - 09-04 Changes UI: `/build/changes/page.tsx` + `changes-client.tsx` + `components/changes/{project-group,change-row,promote-row,diff-preview}.tsx`.
  - 09-05 Chat UI: `lib/providers/chat-rail.tsx` + `components/chat/{chat-rail,chat-panel,message,suggestions}.tsx` mounted in root layout.
- Wave 3 — `ConfirmActionDialog` + gate wiring across existing token-spending server actions (workflow run, queue delegation, workflow editor save/run paths).
- Wave 4 — `/chat` full-page 50/50 split route + `chat-mirror.tsx` picker + unread-dot wiring with SSE `unread_tick` events + `/build/changes` rail-route interop.
- Wave 5 — 09-VERIFICATION.md + human UAT.

**Out of scope (explicit, scope fence):**
- Phase 10 (Plan mode: Projects/PRDs/Roadmaps/UAT pages).
- Phase 11 (Live Floor isometric pixel-agents overlay).
- Phase 12 (⌘K command palette, polish, empty-states, keyboard-shortcut help).
- Multi-user chat / teams.
- File attach + slash-command router (scaffolding only; full router deferred).
- LLM-generated suggested actions (v1 = hardcoded per-route).
- LLM classifier for voice routing (v1 = static heuristic).
- Cron-based graphify re-run on Changes timeline (30-day git-log window; refresh on page load).

---

## Locked Decisions (non-negotiable; cite by D-XX in task actions)

### D-01 — Changes data source: dual, git-log primary + circuit-breakers.jsonl supplement
Primary: `git log --all --merges --since='30 days ago' --pretty=format:'%H|%h|%ci|%s|%an'` per project via `execAsync` with `cwd: p.path` and `maxBuffer: 4 * 1024 * 1024`. Secondary: `.cae/metrics/circuit-breakers.jsonl` `forge_end` events joined on the `task_id` extracted from merge-commit branch names (`forge/p{N}-pl{letter}-t{id}-{hash}`). **Dedupe by SHA** across subtree-merged projects (e.g., dashboard-as-subtree inside CAE surfaces the same merge twice). Cap per project at 500 merges. 30s result cache. One bad project must not poison the stream (try/catch per project, matching `cae-metrics-state.ts`).

### D-02 — Prose rendering: deterministic templates only, ZERO tokens per render
No LLM summarization. Template per event type:
```ts
// lib/cae-changes-state.ts
function proseForEvent(e: ChangeEvent): string {
  const who = e.agent ? agentMetaFor(e.agent).founder_label : "CAE";
  const count = e.commits.length;
  const noun = count === 1 ? "change" : "changes";
  const timeFrag = relativeTime(e.ts); // "this morning" / "Tuesday" / "just now"
  return `${who} shipped ${count} ${noun} to ${e.projectName} ${timeFrag}.`;
}
```
Commit-level subjects in Dev-mode are shown verbatim (no prose rewrite). No conventional-commit prefix stripping in v1.

### D-03 — Chat transport: `claude --print --resume` spawned per message, SSE stream back
One `claude` subprocess per user message. Flags: `--print --resume <sessionId> --append-system-prompt-file docs/voices/{agent}.md --output-format stream-json --include-partial-messages --model <modelId>`. Stdin = user message. Stdout = newline-delimited JSON chunks. Reuse Phase 2 tmux + SSE pattern (`spawn('tmux', ['new-session', '-d', '-s', ...], { detached: true, stdio: 'ignore' })` is the queue+workflow precedent; for chat, we need the stdout stream so we use `spawn('claude', ...)` directly with `stdio: ['pipe', 'pipe', 'pipe']` and pipe stdout through `createTailStream`-style chunker into SSE). Every SSE event carries a UUID `id:` for reconnect de-dupe (see D-17).

### D-04 — VOICE.md + 9 persona fragments are a WAVE 0 DELIVERABLE with a user-surfaced sign-off flag
Wave 0 writes `dashboard/docs/VOICE.md` (≤200 lines; do/don't tables for all 9 voices; routing rules; cross-agent donts) AND 9 persona fragments at `dashboard/docs/voices/{nexus,forge,sentinel,scout,scribe,phantom,aegis,arch,herald}.md` (≤40 lines each; the literal `--append-system-prompt-file` payload). **Wave 1 does NOT execute until the ORCHESTRATOR surfaces the VOICE.md absolute path to the user and explicitly flags it for optional sign-off.** Sign-off is not blocking — user can redirect voice content via a gap-closure plan later if any persona drifts. Planner emits a post-Wave-0 notice; orchestrator owns the user surfacing.

### D-05 — Voice routing: static heuristic with explicit override
Pure function `pickPersona({ route, message }): AgentName` in `lib/voice-router.ts`. Rules, first-match-wins:
1. Message's FIRST WHITESPACE-DELIMITED TOKEN matches `@<agent>` (any of the 9 AgentMeta keys; case-insensitive; MUST NOT be `@task:...`) → that agent. Regex: `^@(nexus|forge|sentinel|scout|scribe|phantom|aegis|arch|herald)\b` (applied after `.trimStart()`).
2. Keyword heuristics (word-boundary, case-insensitive, run on the full message):
   - `/\b(stuck|failing|debug|phantom)\b/i` → Phantom
   - `/\b(security|auth|secret|key|aegis|credential)\b/i` → Aegis
   - `/\b(research|scout|find|docs|investigate)\b/i` → Scout
   - `/\b(ship|release|announce|herald)\b/i` → Herald
   - `/\b(architecture|design|arch)\b/i` → Arch
   - `/\b(test|review|sentinel|check)\b/i` → Sentinel
3. Route rules (`pathname`-prefix match):
   - `/memory` → Scribe
   - `/metrics` → Arch
   - `/build/changes` → Herald
4. Default → Nexus.

### D-06 — Per-persona model routing
`MODEL_BY_AGENT: Record<AgentName, ClaudeModelId>` const in `lib/voice-router.ts`. Opus for orchestrators + deep-thinkers, Sonnet for workers:
- `nexus` → `claude-opus-4-7`
- `arch` → `claude-opus-4-7`
- `phantom` → `claude-opus-4-7`
- `forge` → `claude-sonnet-4-6`
- `scout` → `claude-sonnet-4-6`
- `herald` → `claude-sonnet-4-6`
- `sentinel` → `claude-sonnet-4-6`
- `scribe` → `claude-sonnet-4-6`
- `aegis` → `claude-sonnet-4-6`
The `/api/chat/send` route passes `--model <modelId>` to the spawned `claude` CLI.

### D-07 — Explain-before-doing gate: CLIENT-SIDE ConfirmActionDialog, heuristic token estimate
`components/chat/confirm-action-dialog.tsx` is a client component wrapping any server action that spends tokens. Shows: **token estimate** (no `$`, no USD), **plain-English summary** of what will happen, and a **diff preview** if the action touches code. Accept/Cancel buttons; Accept fires the underlying server action.

**Gate threshold:** heuristic `tokens_spent >= 1000` (estimate from `lib/chat-cost-estimate.ts`). Actions below the threshold still show the preview but default-focus Accept.

**Dev-mode bypass:** when `useDevMode()` is true, dialog renders as instant-execute with a 1.5s undo toast (sonner) — no interstitial modal.

**Gated actions (initial registry in `lib/chat-gated-actions.ts`):**
- Workflow "Run now" (`POST /api/workflows/{slug}/run`) — estimate = sum of prior runs for this workflow, or 10k default.
- Workflow-editor Run-now button (same endpoint, different trigger) — same estimate.
- Queue delegation submit (`createDelegation` in `app/build/queue/actions.ts`) — estimate = 8k default.
- **Not gated:** Send chat message (the typing itself is the confirmation).
- **Not gated v1:** Retry task, reassign task, approve dangerous outbox — these still go through existing flows; add to registry in Wave 3 if time allows, otherwise gap plan.

### D-08 — Chat scope: GLOBAL (cross-project)
Sessions live at `{CAE_ROOT}/.cae/chat/{uuid}.jsonl`. Not per-project. The user chats about the whole team/ecosystem, not a single project. One jsonl per session, atomic append (`fs.appendFile` for lines ≤4KB, which every chat line is). Session uuid is a v4 UUID validated by `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` before any filesystem use OR `claude --resume` invocation (gotcha #3, gotcha path-traversal in Q/Security).

### D-09 — Unread dot: SSE-driven, clears on open
`ChatRailProvider` keeps one EventSource open per session. Every `assistant.delta` and `assistant.begin` SSE event increments `unreadCount` IF `open === false`. Additionally, the server emits an explicit `{event: "unread_tick"}` SSE frame when the client's last-known route (sent on connect via query param) is NOT `/chat` AND the user is not currently hovering the rail — client bumps `unread` regardless of open state for rail collapsed. Dot clears when: (a) rail opens, (b) Escape is pressed while rail is open, (c) user scrolls to bottom of thread.

### D-10 — Chat keybinding deferred; click-toggle is primary
No global keybinding v1. Ctrl+T is stolen by Chromium at the browser-chrome level (gotcha #11); Ctrl+` conflicts with DevTools; Ctrl+/ conflicts with browser help in some. **Click-to-toggle on the collapsed rail** is the primary mechanism; a visible toggle button satisfies UI-SPEC. Phase 12's ⌘K palette will add "Open chat" as a command. Escape still collapses when rail is open (client-scoped keydown handler inside `ChatPanel`, captured + preventDefault). Document the tradeoff in `docs/VOICE.md` §Routing.

### D-11 — Suggested actions: hardcoded per-route, NOT LLM-generated
`lib/chat-suggestions.ts` exports `SUGGESTIONS: Record<string, Suggestion[]>` where `Suggestion = { label: string; message: string }`. Route-keyed by `usePathname()`. Rendered as 3 chip buttons below chat input; click pre-fills input + sends. All copy is founder-speak. Map includes at minimum:
- `/build` — What's blocked? / Today's burn / What shipped?
- `/build/queue` — Prioritize this queue / Why is X stuck?
- `/build/changes` — Summarize today
- `/build/agents` — Who's idle? / Which agent is slowest?
- `/build/workflows` — Draft a recipe / What breaks most
- `/metrics` — Am I overspending? / Where is the burn coming from?
- `/memory` — What did CAE read on task X? / Show recent memory edits
- `/chat` — What should I ask first? / Summarize the week

### D-12 — Changes prose timeline grouped by project, Accordion-per-project expanded by default
base-ui `Accordion` with `type="multiple"` and `defaultValue={allProjectSlugs}` so every project is expanded on first render. Each project group shows project name + count + newest-first list of day-grouped `ChangeRow`s. Dev-mode flip: each `ChangeRow` exposes a `[▾ technical]` collapse that shows SHA (short), per-commit subjects, GitHub URL (if resolvable), and the joined `agent`/`model`/`tokens` data from `circuit-breakers.jsonl`.

### D-13 — Cost = TOKENS ONLY, no `$`
Same as Phase 7/8. Existing `lint-no-dollar.sh` guard (Phase 7) continues to run as part of `pnpm lint`. Any token-facing copy in `chat.*` and `changes.*` label keys MUST pass lint-no-dollar.sh without modification. Confirm-action-dialog shows `"~{tokens} tok"` (no currency prefix).

### D-14 — Founder-speak default with dev-mode flip for ALL new labels
New label keys live in BOTH `FOUNDER` and `DEV` objects in `lib/copy/labels.ts`, typed in the `Labels` interface. `labelFor(dev)` returns the merged shape. Keys introduced Phase 9:
- `changes.*` — page heading, empty states, Dev-mode technical-collapse labels, "N changes today / N yesterday" lede.
- `chat.*` — rail collapsed/expanded tooltips, input placeholder, suggestions heading, new-conversation label, "CAE is thinking…" pending, "rate-limited for {n}s" error, unread aria-label, gated-action dialog (title, summary label, cost label, accept, cancel, instant-execute toast).

### D-15 — Explain-mode tooltips ON for all new UI
Every Changes metadata label + every Chat control gets an `ExplainTooltip` (from `components/ui/explain-tooltip.tsx`, the Phase 8 shared primitive). Tooltips are visible when `useExplainMode().explain === true` (default). New tooltip blurbs added to `Labels` as `chatExplain*` / `changesExplain*` keys and branch on dev/founder phrasing like Phase 7/8.

### D-16 — /chat route = FULL-PAGE 50/50 SPLIT (not deferred)
`app/chat/page.tsx` renders a `<ChatLayout>` with a left pane picker `ChatMirror` and right pane `<ChatPanel standalone />`. Picker surfaces a select/radio of Build surfaces to "mirror" on the left: Home / Agents / Workflows / Queue / Changes / Metrics / Memory. When a surface is picked, the left pane renders a read-only preview of that page inline (lightweight: fetches the relevant existing `/api/*` aggregator and renders a trimmed variant — no navigation inside). Right pane: chat, full height, max-width 800px, centered. On `/chat`, the right-rail ChatRail is hidden (rail provider checks `usePathname() === "/chat"`). Ctrl+T is a no-op there. Keyboard: Escape collapses focus back to input.

### D-17 — SSE reconnect de-dupe via `last_seen_msg_id`
Server emits every SSE event with a UUID `id:` line. Client maintains `last_seen_msg_id` per session in-memory (React state inside `ChatRailProvider`). On EventSource reconnect (auto browser behavior), the client sends `?after=<last_seen_msg_id>` on the next `/api/chat/state` call; server replays from `after+1` out of the session jsonl. Duplicates arriving via browser auto-reconnect are filtered by `id` comparison client-side. Mirrors the Vercel AI SDK SSE pattern adapted to our session jsonl.

### D-18 — Scope fence: NO Phase 10/11/12 code
No files under `app/plan/**`, `components/plan/**`, `components/live-floor/**`, `components/cmd-palette/**`, or new cmd-palette libs. No modifications to `app/plan/page.tsx` beyond potentially passing new labels via `labelFor`. Any drift out of this fence → reject the task, file a Phase 10/11/12 gap-closure note.

---

## Claude's Discretion (reasonable defaults; document in task actions)

- `ChangeEvent` TypeScript shape: the research recommends `{ts, project, projectName, sha, shaShort, mergeSubject, branch, phase, task, githubUrl, agent, model, tokens, commits[], prose}`. Keep that exactly; Wave 1 Plan 02 freezes it.
- `Project` group identity: use `project.path` as the stable id; display label from `projectName` via `basename(project.path)`.
- GitHub URL derivation: `git config --get remote.origin.url` per project, parse `git@github.com:OWNER/REPO.git` or `https://github.com/OWNER/REPO(.git)?`. Null → no link rendered (do NOT fall back to `#`).
- Chat session resolver: `getOrCreateSession()` creates a new uuid on first chat open; `listSessions()` returns reverse-chronological by mtime.
- Max message length: 4000 chars (reject with 400 + `{error: "too long"}`).
- Rate-limit error surface: if `claude --print` exits non-zero with stderr matching `/rate.?limit/i` or `/usage.?limit/i`, emit SSE `{event: "rate_limited", retry_after_sec: 30}` and disable input for 30s.
- Auto-expand debounce: if screen-shake (from Phase 3 merge event) is active in the last 500ms, skip the auto-expand animation for this stream to avoid stacked motion (gotcha #13).
- `--append-system-prompt-file` + `--resume` persona stability (gotcha #9): voice file is chosen ONCE at session creation and STORED in the session metadata header (first line of the jsonl is a `{"role":"meta","agent":"nexus","created_at":...}` record). Subsequent `/api/chat/send` calls re-read this metadata and pass the SAME voice file, regardless of what the voice router would return — unless the user's new message starts with an explicit `@agent` override, in which case the meta record is rewritten for that single turn (and the next turn reads the original meta back).
- Claude CLI cwd: spawn with `cwd: CAE_ROOT` so that `~/.claude/projects/-home-cae-ctrl-alt-elite/<uuid>.jsonl` is the session path (matches the existing OAuth session directory on this host — gotcha #4).

---

## Phase Requirements → Plan Map

| REQ | Description | Plan | Verification |
|-----|-------------|------|--------------|
| CHG-01 | `/build/changes` prose timeline grouped by project | 09-02 (API) + 09-04 (UI) | vitest + e2e render |
| CHG-02 | Dev-mode reveals SHAs + per-commit subjects + GitHub link | 09-04 | component test for dev-toggle |
| CHG-03 | Data source: git log + circuit-breakers.jsonl merge by task_id | 09-02 | unit test on fixture |
| CHT-01 | Right-rail, 48px collapsed → 300px expanded, click-toggle | 09-05 | component test |
| CHT-02 | Unread dot via SSE + last_seen_msg_id de-dupe | 09-03 (server) + 09-05 (client) | provider unit test |
| CHT-03 | Per-agent voices (9 personas) + VOICE.md | 09-01 (Wave 0) | file-existence smoke |
| CHT-04 | `/chat` route = full-page 50/50 split | 09-07 | route smoke |
| CHT-05 | Suggested actions per tab context | 09-01 (lib) + 09-05 (UI) | unit test on map |
| CHT-06 | ConfirmActionDialog on token-spending server actions | 09-06 | component test + integration test for workflow run |
| VOI-01 | `docs/VOICE.md` + 9 voices/*.md exist | 09-01 | `test -f` smoke in verify |
| MODEL-01 | Per-persona model routing const in lib/voice-router.ts | 09-01 | unit test on MODEL_BY_AGENT |
| GATE-01 | `tokens_spent >= 1000` triggers confirm dialog | 09-06 | unit test on heuristic |

---

## Gotchas honored (from 09-RESEARCH.md §Gotchas)

Each plan's task action MUST reference the relevant gotcha by number when mitigating:

1. `git log --all` slowness — cap with `--since='30 days ago'` + `-n 500`; 30s cache. (plan 09-02)
2. Subtree-merged repos double-report — dedupe by SHA across projects. (plan 09-02)
3. `claude --resume` UUID validation — regex guard before spawn. (plan 09-03)
4. Claude CLI session cwd — spawn with `cwd: CAE_ROOT`. (plan 09-03)
5. base-ui `asChild` trap — ChatRail transitions use `className` + `cn(...)`, never `asChild`. (plans 09-04, 09-05)
6. `@agent` vs `@task:tb-...` collision — first-token-only rule in voice router. (plan 09-01)
7. SSE reconnect de-dupe — `last_seen_msg_id` + server replay from `after+1`. (plans 09-03, 09-05)
8. Dev-mode on `/chat` — toggles Nexus copy, not routing. (plan 09-07)
9. `--append-system-prompt-file` + `--resume` persona drift — store voice in session meta; pass same file on every turn. (plan 09-03)
10. ChatRailProvider on /signin — gate with `if (!session) return null`. (plan 09-05)
11. Ctrl+T browser conflict — click-toggle primary (D-10). (plan 09-05)
12. Claude CLI rate-limit — emit SSE `rate_limited` event, disable input 30s. (plan 09-03)
13. Screen-shake + auto-expand stacking — debounce 500ms. (plan 09-05)
14. GitHub URL derivation graceful fail — null, no `#` fallback. (plan 09-02)
15. `.cae/chat/*.jsonl` concurrent writes — atomic `fs.appendFile`. (plan 09-03)

---

## Security Domain (from 09-RESEARCH.md §Security)

- **V2 Auth:** `auth()` guard on every `/api/chat/*` POST + on `/api/changes` GET (gated behind session as all `/build/*` is). Guard on the UUID path-param endpoint against path-traversal.
- **V5 Input validation:** sessionId regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`; message length ≤ 4000 chars; `@agent` whitelist of 9 tokens.
- **Tampering/Prompt injection:** `claude --print --resume` subprocess runs with no tool-use elevated; the chat is pure text-out. We do NOT pass `--permission-mode bypass`. Future slash commands that invoke tools will need an explicit approval hop (not Phase 9).
- **Path traversal (sessionId → `.cae/chat/../../etc/passwd`):** after regex guard, `join(CAE_ROOT, ".cae", "chat", ${uuid}.jsonl)` and `.startsWith(CAE_ROOT + "/.cae/chat/")` assertion.

---

## Validation Architecture

| REQ | Test type | Command | File |
|-----|-----------|---------|------|
| VOI-01 | smoke | `test -f dashboard/docs/VOICE.md && for a in nexus forge sentinel scout scribe phantom aegis arch herald; do test -f dashboard/docs/voices/$a.md || exit 1; done` | Wave 0 verify |
| CHT-03 | unit | `pnpm test -- --run lib/voice-router.test.ts` | 09-01 |
| CHT-05 | unit | `pnpm test -- --run lib/chat-suggestions.test.ts` | 09-01 |
| GATE-01 | unit | `pnpm test -- --run lib/chat-cost-estimate.test.ts` | 09-01 |
| CHG-01 | unit | `pnpm test -- --run lib/cae-changes-state.test.ts` | 09-02 |
| CHG-03 | unit | same file as CHG-01 (join fixture) | 09-02 |
| CHT-01 | component | `pnpm test -- --run components/chat/chat-rail.test.tsx` | 09-05 |
| CHT-02 | component | `pnpm test -- --run lib/providers/chat-rail.test.tsx` | 09-05 |
| CHG-02 | component | `pnpm test -- --run components/changes/change-row.test.tsx` | 09-04 |
| CHT-06 | component | `pnpm test -- --run components/chat/confirm-action-dialog.test.tsx` | 09-06 |
| CHT-04 | smoke | `pnpm build` succeeds + page route exists + manual UAT | 09-07 |

Per-plan: that plan's test file(s). Per-wave merge: full `pnpm test && pnpm lint && pnpm build`. Phase gate: 09-VERIFICATION.md checklist.

---

## Wave Structure

| Wave | Plan | Parallel with | Autonomous | Depends on |
|------|------|---------------|------------|------------|
| 0 | 09-01 | — | yes (plus user-surface flag for VOICE.md) | — |
| 1 | 09-02 | 09-03 | yes | 09-01 |
| 1 | 09-03 | 09-02 | yes | 09-01 |
| 2 | 09-04 | 09-05 | yes | 09-02 |
| 2 | 09-05 | 09-04 | yes | 09-03 |
| 3 | 09-06 | — | yes | 09-05 |
| 4 | 09-07 | — | yes | 09-05, 09-06 |
| 5 | 09-08 | — | no (human UAT checkpoint) | 09-07 |

**File-ownership invariant:** same-wave plans have ZERO files_modified overlap. Verified at planner time.

---

## Environment Availability

From 09-RESEARCH.md §Environment Availability: node v22.22.0, pnpm 10.28.2, git 2.43.0, tmux 3.4, claude CLI 2.1.117, `~/.claude/projects/` present. **Zero new npm deps.** Existing deps used: `@base-ui-components/react`, `lucide-react`, `sonner`, `react-markdown` (Phase 8), `remark-gfm` (Phase 8), `vitest` (Phase 8). Validated decisions rely on all these already being in `package.json`.

---

## Rollback / undo strategy

Each plan's tasks commit atomically with a grep/test/build guard in `<verify>`. If a plan's verify fails, `git reset --hard HEAD~{N}` where N = tasks in plan. Wave-level rollback: `git revert` the merge commit of the plan branch (Forge merges each plan via `forge/p9-*` branches per Phase 1 convention).
