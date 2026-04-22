# Phase 9: Changes tab + right-rail chat — Research

**Researched:** 2026-04-22
**Domain:** Prose-default change timeline + persistent agent-voice chat rail + Nexus "explain before doing" gate
**Confidence:** HIGH on stack (all libs verified via npm/filesystem), HIGH on reused patterns (SSE, tmux, multi-project aggregator, providers); MEDIUM on chat transport (two viable options — recommendation below); MEDIUM on voice routing (heuristic-first is the honest default).

## Summary

Phase 9 has two pillars that share no data but share most infrastructure: (1) a **Changes timeline** that is a pure aggregator over `git log` + `.cae/metrics/circuit-breakers.jsonl` across all projects, rendered prose-by-default and rewritten into dev-speak when `DevMode` is on; (2) a **right-rail chat** that is a persistent per-project conversation surface routed through an existing agent-voice layer, with a Nexus "explain before doing" gate on any token-spending action.

The Changes side is 90% mechanical: reuse `listProjects()` + `tailJsonl()` patterns from `cae-home-state.ts` / `cae-metrics-state.ts`, add `git log --all --merges --pretty=format:...` via the same `execAsync` helper `cae-home-state.ts` already uses, render with a template-per-event-type (no LLM summarization in v1). The chat side has one real architectural decision: **transport**. Recommendation: spawn `claude --print --resume <uuid> --output-format stream-json`, one session-per-chat, one SSE stream per in-flight response — reuses `claude-code.sh` patterns Phase 2 already shipped, avoids adding `@anthropic-ai/sdk` + OAuth plumbing. Persist transcripts as `.cae/chat/<session-uuid>.jsonl`.

**Primary recommendation:** 3 API routes, 1 lib module per pillar, 1 global chat provider + rail component, reuse BuildLayout to mount rail. Ship `docs/VOICE.md` as the FIRST wave (Wave 0) so no chat code can ship voiceless.

## User Constraints (from ROADMAP Phase 9 + UI-SPEC §10 §12 §Audience reframe + Session 4 resolutions)

### Locked decisions
- **Changes = prose-default.** Dev-mode toggle (⌘Shift+D) reveals SHAs + diff + GitHub links inline. Not a separate tab.
- **Grouped by project** (mirrors the multi-project aggregators in Phases 5/7/8).
- **Chat rail: collapsed 48px icon column with unread dot; expanded 300px.** Ctrl+T toggles. Auto-expands on agent streaming. Escape collapses.
- **Nine agent voices**: nexus / forge / sentinel / scout / scribe / phantom / aegis / arch / herald — every chat message carries an attribution. `AGENT_META` in `lib/copy/agent-meta.ts` is the source of truth [VERIFIED: file exists, 9 keys].
- **`docs/VOICE.md` must exist BEFORE chat code ships.** Nexus do/don't examples. Written as Wave 0 of Phase 9.
- **`/chat` route = full-screen split-screen mode** (50/50 current context + chat). Deferred from right-rail per UI-SPEC §12.
- **Nexus "always explain before doing" gate**: any token-spending action (run workflow, retry task, reassign, delegate) must preview cost estimate + summary + confirm/cancel. Dev-mode disables the extra gating (UI-SPEC §Scribe-mode Nexus).
- **Dark theme, base-ui, Tailwind v4** locked since Phase 3.
- **Founder-speak default**, Dev-mode = ⌘Shift+D. Every new label pair goes in `lib/copy/labels.ts`.
- **Explain-mode default ON**, Ctrl+E toggles.
- **Cost = TOKENS ONLY.** No USD anywhere, no hardcoded rates.
- **NO iframe.** Native components.
- **Multi-project:** mirror Phase 5/7/8 aggregator pattern via `listProjects()`.

### Claude's discretion
- Chat transport: claude CLI subprocess via tmux (reused pattern) vs. `@anthropic-ai/sdk` direct — recommend **claude CLI**, documented below.
- Prose rendering: per-event templates vs. LLM summarization — recommend **templates** (cost=0, deterministic).
- Voice routing: explicit picker vs. context-heuristic vs. always-Nexus-dispatcher — recommend **context-heuristic with Nexus as default** (documented below).
- Suggested-action source: hardcoded-per-route vs. agent-suggested — recommend **hardcoded-per-route v1** with `SUGGESTIONS: Record<route, Action[]>`.
- Unread transport: SSE vs poll — recommend **SSE on the active chat stream**, fallback to polling `/api/chat/state` every 5s for the rail collapsed state.
- Chat persistence: `.cae/chat/<session-uuid>.jsonl` at CAE_ROOT (not per-project — chat is cross-project).

### Deferred / out of scope
- `/chat` route MVP can ship as same ChatPanel in a `/chat` page shell; split-screen 50/50 layout is deferred polish (Phase 12 empty-states + polish).
- Multi-user chat threads / teams.
- File attach + slash-commands (scaffolding only; full command router deferred).
- LLM-driven prose rewrite of commits (heuristic templates v1).
- Dynamic agent-suggested actions (v1 = hardcoded per route).
- Voice routing via LLM classifier (v1 = keyword/route heuristic with Nexus fallback).

## Project Constraints (CAE repo CLAUDE.md + dashboard AGENTS.md)

- **base-ui does NOT support `asChild`.** Use `className` / `cn(buttonVariants())`. [AGENTS.md `p2-plA-t1-e81f6c`]
- **`react-is` pin** at `19.2.4` in `pnpm.overrides` must remain — any new dep that drags in a mismatch breaks.
- **Server/client boundary:** any component using hooks (ChatRail, ChangesClient) must be `"use client"`. Page shells stay server-components (auth redirect).
- **Circuit-breaker event schema is snake_case** (`ts`, `event`, `task_id`, `input_tokens`, `output_tokens`). Never camelCase. Events = `forge_begin` / `forge_end` with `success: bool`. [Phase 7 Wave 0 D-02]
- **SSE pattern canonical** via `lib/tail-stream.ts` + Content-Type `text/event-stream`. ReadableStream + AbortController. [VERIFIED: `app/api/tail/route.ts`]
- **Subprocess spawn canonical** via `spawn('tmux', ['new-session', '-d', '-s', ...])` with `{ detached: true, stdio: 'ignore' }`. [VERIFIED: `app/build/queue/actions.ts`, `app/api/workflows/[slug]/run/route.ts`]
- **`auth()` guard** required on every API route that mutates or spawns. [VERIFIED across all POST routes]
- **Shared `CAE_ROOT`** = `/home/cae/ctrl-alt-elite` (env-overridable). Chat transcripts belong here, not per-project.
- **Next.js 16.2.4, React 19.2.4, base-ui 1.4.0, Tailwind v4.2.2.** [VERIFIED: package.json]

## Phase Requirements → Feature Map

| REQ | Description | Approach |
|-----|-------------|----------|
| CHG-01 | `/build/changes` prose timeline, grouped by project | Aggregator `lib/cae-changes-state.ts` + client page |
| CHG-02 | Dev-mode reveals SHAs + diff preview + GitHub link | Conditional render in ChangeRow, `useDevMode()` gate |
| CHG-03 | Data source: git log + circuit-breakers.jsonl merge | `execAsync('git log --all --merges ...')` + tail jsonl |
| CHT-01 | Right-rail, 48px collapsed → 300px expanded, Ctrl+T | `ChatRailProvider` + `ChatRail` component in root layout |
| CHT-02 | Unread dot when agent speaks while collapsed | SSE event increments unread counter, clears on expand |
| CHT-03 | Per-agent voices (9 personas) | `docs/VOICE.md` (Wave 0) + attribution in every message |
| CHT-04 | `/chat` route = full-screen chat | Page route using ChatPanel component, no rail |
| CHT-05 | Suggested actions per tab context | `lib/chat-suggestions.ts` route-keyed map |
| CHT-06 | Nexus explain-before-doing gate | `ConfirmActionDialog` wrapper on every server action |
| VOI-01 | `docs/VOICE.md` with Nexus do/don't examples | Wave 0 deliverable, ≤200 lines |

---

# Research Findings — by question

## Q1. Changes timeline data source

**Answer:** Dual source — merge-git-log is primary (one row per shipped thing), `forge_end(success:true)` events supplement project/agent/token attribution.

**Why both:**
- `git log --all --merges --pretty=format:'%H|%h|%ci|%s|%an'` gives the canonical "shipped" event. Merge commit `Merge forge/p2-plA-t1-d2ca80 (Sentinel-approved)` already parses cleanly [VERIFIED in `/home/cae/ctrl-alt-elite`]. Branch name `forge/p2-plA-t1-d2ca80` tells us phase + plan + task hash.
- `.cae/metrics/circuit-breakers.jsonl` carries `forge_end` with `agent`, `input_tokens`, `output_tokens`, `task_id` [VERIFIED, `/home/cae/ctrl-alt-elite/dashboard/.cae/metrics/circuit-breakers.jsonl`]. Join on `task_id` extracted from merge-commit branch.
- Pure-git-log loses token attribution; pure-jsonl loses the GitHub URL and raw SHA. The aggregator joins them.

**Shape:**

```ts
interface ChangeEvent {
  ts: string                // ISO from merge commit
  project: string           // path
  projectName: string
  sha: string               // full hash
  shaShort: string
  mergeSubject: string      // "Merge forge/p2-plA-t1-d2ca80 (Sentinel-approved)"
  branch: string | null     // "forge/p2-plA-t1-d2ca80" extracted from subject
  phase: string | null      // "p2" — extracted from branch
  task: string | null       // "p2-plA-t1-d2ca80"
  githubUrl: string | null  // null if no origin remote or unknown host
  // Joined from jsonl (nullable if no matching forge_end)
  agent: string | null
  model: string | null
  tokens: number | null
  // Summary — list of commits merged-in, derived from `git log --oneline <merge>^..<merge>`
  commits: Array<{ sha: string; shaShort: string; subject: string }>
  // Prose version — template-rendered once, cached in row
  prose: string             // "Forge shipped 3 fixes to cae-dashboard this morning"
}
```

**Multi-project pattern:** `listProjects()` returns up to 4 candidates on this machine [VERIFIED via `cae-state.ts:82-94`]; aggregator iterates them, runs `git log` per project inside try/catch (one bad project cannot poison the whole stream — same invariant as `cae-metrics-state.ts`).

**Query tuning:** Start with `--since='30 days ago' --merges` per-project, cap at 500 merges/project. For `.cae/metrics/circuit-breakers.jsonl` reuse `tailJsonl(cbPath, 5000)` budget from `cae-agents-state.ts`. Cache with 30s TTL (matches `cae-metrics-state.ts`).

**GitHub URL derivation:** `execAsync('git config --get remote.origin.url')` per project, parse `git@github.com:owner/repo.git` or `https://github.com/owner/repo.git`, construct `https://github.com/<owner>/<repo>/commit/<sha>`. Fall back to `null` if remote is missing/non-GitHub.

**File path:** `lib/cae-changes-state.ts`, API `app/api/changes/route.ts`.

## Q2. Prose rendering: templates vs. LLM

**Answer: Templates. No LLM in v1.**

**Rationale:**
- Cost: LLM summarization of every merge event = tokens burned on a read path that renders on every poll. Phase 9 is explicit "cost = tokens only" and LLM prose = constant token burn. Hard violation.
- Latency: Timeline paints instantly with templates. LLM summarization = wait or cache-bust pain.
- Determinism: QA / founder-speak copy pass is reviewable when deterministic. LLM output drifts across model versions.

**Template set (v1):**

```ts
// lib/cae-changes-state.ts
function proseForEvent(e: ChangeEvent): string {
  const who = e.agent ? labelFor(e.agent, false) : 'CAE'  // founder label
  const count = e.commits.length
  const noun = count === 1 ? 'change' : 'changes'
  const timeFrag = relativeTime(e.ts)  // "this morning" / "Tuesday"
  return `${who} shipped ${count} ${noun} to ${e.projectName} ${timeFrag}.`
}
```

**Commit-level prose** inside the "Technical" collapse is simpler: display `subject` as-is. (The subject lines are already human-written; no rewrite needed.) If we ever want per-commit prose later, add a heuristic strip of conventional-commit prefixes (`feat(x):` → `New: x`, `fix(x):` → `Fixed: x`) — that's a Phase 12 polish task.

## Q3. Right-rail chat transport

**Recommendation: Long-running `claude --print --resume <uuid> --output-format stream-json` per request, one SSE stream per response.**

**Why claude CLI over `@anthropic-ai/sdk` (npm 0.90.0, released 2026-04-16) [VERIFIED: npm view]:**

| Dimension | claude CLI subprocess | `@anthropic-ai/sdk` direct |
|-----------|----------------------|---------------------------|
| Auth | OAuth login (already set up on host) | Requires `ANTHROPIC_API_KEY` or per-dashboard OAuth plumb |
| Cost model | Flat-rate sub (no per-call bill) — matches §S4.2 "OAuth sub, not metered" | Per-call billed at API rates |
| Subprocess skill | Codebase has two shipped spawners [VERIFIED: `queue/actions.ts`, `workflows/[slug]/run/route.ts`] | New integration surface |
| Streaming | `--output-format stream-json --include-partial-messages` [VERIFIED in `claude --help`] | SDK `stream: true` |
| Persistence | `claude --resume <uuid>` re-enters prior conversation [VERIFIED: `~/.claude/projects/<path>/<uuid>.jsonl`] | Must manage state manually |
| Cost accounting | `--output-format json` already wired into adapter; tokens land in circuit-breakers.jsonl | Need separate logging |
| Agent personas | `--append-system-prompt-file <voice.md>` [VERIFIED: `claude --help`] | Re-send system on every call |
| Nexus orchestration | Matches how `adapters/claude-code.sh` already spawns agents | Bifurcates spawn surfaces |

[CITED: Anthropic SDK streaming docs — https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol] confirm the direct-SDK approach is viable; we pick claude CLI for the ecosystem fit.

**Transport design:**

```
Client (ChatRail)
  ↓ POST /api/chat/send { sessionId, message, route, project }
Server
  1. Append user message to .cae/chat/<sessionId>.jsonl
  2. Pick persona via voice router (see Q4)
  3. Spawn: claude --print --resume <sessionId>
                  --append-system-prompt-file docs/VOICE-<agent>.md
                  --output-format stream-json
                  --include-partial-messages
                  --model <sonnet>
                  --no-session-persistence=false  (default on)
  4. Stream child stdout line-by-line as SSE chunks
  5. On stream close, append full assistant message to transcript jsonl
```

Unread dot transport: the same SSE stream is what Chat reads when expanded. When collapsed, the `ChatRailProvider` keeps the EventSource open in the background (via react context shared from `app/layout.tsx`) and increments `unreadCount` on each `assistant.delta` event; clears on expand.

**Alternative considered: one long-running claude session in tmux kept alive across requests.** Rejected: stateful tmux session management is a bug magnet, and `--resume <uuid>` gives us the same affordance statelessly. `claude-code.sh` already proved the tmux-per-task pattern works for single-shot calls, not long-lived REPLs.

**File paths:**
- `app/api/chat/send/route.ts` — POST, spawns `claude --resume`, streams SSE response
- `app/api/chat/state/route.ts` — GET, returns `{ messages: [], unreadCount, sessions: [] }` for poll fallback
- `app/api/chat/history/[sessionId]/route.ts` — GET, returns full transcript
- `lib/cae-chat-state.ts` — transcript read/write helpers, session resolver
- `components/chat/chat-rail.tsx` — rail (collapsed + expanded)
- `components/chat/chat-panel.tsx` — message thread + input + suggestions
- `components/chat/message.tsx` — single message with agent attribution
- `lib/providers/chat-rail.tsx` — rail-open / unread state context

## Q4. Voice routing — which persona answers?

**Recommendation: context-heuristic router with Nexus as default + `@agent` explicit override.**

**The routing rules (documented in `docs/VOICE.md` §Routing):**

```
1. Message starts with `@forge` / `@nexus` / `@scout` / … → route to that persona (explicit override).
2. Current route matches:
   /memory/*     → Scribe answers ("memory-keeper")
   /metrics/*    → Arch answers ("architect")
   /build/agents → Nexus answers (roster-owner)
   /build/queue  → Nexus (dispatcher)
   /build/workflows → Nexus (recipe-designer)
   /build/changes → Herald ("herald" of what shipped)
   /plan/*       → Nexus (she drafts PRDs with the user)
   /chat         → Nexus (default; `@agent` overrides)
3. Keyword heuristics override route (document in VOICE.md):
   /debug/|stuck|failing|phantom/i → Phantom
   /security|auth|secret|key/i     → Aegis
   /test|review|sentinel|check/i   → Sentinel
   /research|scout|find|docs/i     → Scout
   /ship|release|announce/i        → Herald
4. Default → Nexus.
```

**Why not always-Nexus:** Loses the "nine distinct voices" design intent from UI-SPEC §0. Users get bored.

**Why not LLM classifier:** Cost + latency for what is a 15-line lookup table. Revisit if the heuristics misfire often in Session 6.

**Implementation:** `lib/chat-voice-router.ts` exports `pickPersona({ route, message }): AgentName`. Pure function, unit-testable. The router's output selects which `docs/VOICE-<agent>.md` the spawned claude gets via `--append-system-prompt-file`.

**Gotcha:** `@forge` detection MUST NOT collide with Nexus's own chat wanting to mention a persona by name. Rule: `@<agent>` only routes when it's the first token of the user message, not mid-sentence.

## Q5. VOICE.md shape

**Shape:** one root `docs/VOICE.md` (≤200 lines) + nine small `docs/voices/<agent>.md` (≤40 lines each) that are the actual `--append-system-prompt-file` payloads.

**Rationale:** Root file is human-readable do/don't reference. Per-agent files are system-prompt fragments. Splitting means copy drift is contained.

**Root doc structure (from Intercom's "conversational voice guide" pattern and GitHub Primer voice-and-tone):**

```markdown
# CAE voice

## Why this exists
<2 paragraphs — for non-devs, and for founders under stress.>

## Global rules
1. Always explain before doing. Never just run.
2. Never more than 3 sentences at a time.
3. Drop dev jargon, translate inline, never abbreviate agent roles.
4. Admit uncertainty. "I think …" is fine. "I'm sure" had better be true.
5. Attribute every message to a persona.

## Voice routing
<Copy Q4 routing table here verbatim.>

## Nexus — do / don't
| Situation | Don't say | Do say |
|-----------|-----------|--------|
| User asks to retry a failing task | "Retrying task p3-t4 with Opus." | "Heads up — I'll hand this back to the builder on Opus. Costs about 4k tokens. Go?" |
| Task fails 3x | "Escalating to Phantom." | "Forge struck out three times. Sending this to Phantom — the debugger. He's good at log archaeology." |
| User asks "what is CAE doing" | "3 forge_begin events in-flight on p3." | "Builder's on the sign-in page, checker's about to look at auth. Should land in ~2 min." |
| Greeting | "Hello. How can I help?" | "Hey. What's broken." |

## Don'ts across all agents
- Emoji-as-punctuation (✨, 🚀, 🎉 banned unless user reacts first).
- Apologies without action. If you can't do it, say why.
- "Let me know if you have any questions" (every message ends with a concrete action or a verdict).

## Per-agent one-liners
- **Nexus** — dry + smart-ass, honest, decisive. Translates dev-speak.
- **Forge** — terse, blue-collar, "done.". Doesn't narrate process.
- **Sentinel** — pedantic, lists issues numerically.
- **Scout** — over-enthusiastic researcher, cites sources.
- **Scribe** — librarian energy, reminds you where notes live.
- **Phantom** — noir detective, clues & hypotheses, reads logs for a living.
- **Aegis** — paranoid, security-first, 2FA everything.
- **Arch** — structured architect, draws boxes.
- **Herald** — marketing copy over-energy.
```

**Per-voice file shape (`docs/voices/nexus.md`):**
```markdown
You are Nexus, the lead orchestrator of Ctrl+Alt+Elite.
Voice: dry, playful, smart-ass. First-name with agents. Drops dev jargon then translates inline.
Rules:
- Always explain a token-spending action BEFORE running it. Show cost estimate + summary + wait for user "go".
- ≤3 sentences per message.
- Never say "Let me know if …". End with an action or a verdict.
- Never write code. Delegate to Forge. Never review code. That's Sentinel.
Examples of your tone:
> "Forge botched that one three times. Phantom next? He's scary but he reads logs for a living."
> "Heads up — I'll ask the builder to try again on Opus. ~4k tokens. Go?"
When routed to, acknowledge the context in one sentence and offer one concrete next action.
```

**References consulted:** [CITED: Intercom's style guide pattern — https://www.intercom.com/resources/design-guides]; [CITED: GitHub Primer's voice-and-tone — https://primer.style/foundations/content]. Both converge on: tiny top file, do/don't tables, per-context examples. Our situation is narrower (9 personas, always-present agents), so the concrete-examples column is the highest-leverage content.

## Q6. "Explain before doing" gate — where does it live?

**Recommendation: client-side confirmation component (`ConfirmActionDialog`) wrapping every server action that spawns an agent or runs a workflow. Server-side guard as belt-and-suspenders, but UX-primary interaction is client.**

**Why client-side:**
- The gate is a UX feature ("show user a preview before executing"), not a security feature. Users could already mutate via curl if they wanted.
- Latency: server-round-trip for "are you sure" is bad UX compared to a confirm dialog that has already computed the cost estimate client-side.
- Dev-mode bypass (per UI-SPEC §Scribe-mode Nexus) is trivial client-side (`useDevMode()`); server-side duplicated.

**Where to intercept:**

```
Button click → setPendingAction(action)
                                ↓
                      <ConfirmActionDialog open={pendingAction !== null}
                                            action={pendingAction} />
                                ↓
                      user clicks "Go" → pendingAction.execute() → server action runs
```

**Token estimate source:** `lib/chat-cost-estimate.ts` returns a heuristic based on action type:
- "retry task" → avg of task's prior attempts tokens (or 5k default)
- "run workflow" → sum of prior runs (or 10k default)
- "delegate new task" → 8k default (founder-editable)

No LLM call for the estimate; heuristic from `.cae/metrics/circuit-breakers.jsonl` aggregates.

**Actions that MUST pass through the gate (list, can grow):**
- Retry task (`/build/phase/...?retry=...`)
- Run workflow (`POST /api/workflows/<slug>/run`)
- Delegate new BUILDPLAN (`/build/queue` new-job)
- Approve dangerous outbox action (`/build?approval=...`)
- Reassign task (future)
- **Send chat message** — NO gate. The user is typing; that IS the confirmation.

**Dev-mode bypass:** when `useDevMode()` returns true, the dialog renders as an instant-execute with a 1.5s undo toast. Keeps the power-user flow fast.

**File paths:**
- `components/chat/confirm-action-dialog.tsx`
- `lib/chat-cost-estimate.ts`
- `lib/chat-gated-actions.ts` — single registry so every gated action shares the same interception path

## Q7. Chat split-screen `/chat` route

**Recommendation: v1 = `/chat` page that mounts `<ChatPanel standalone>` full-width. Split-screen 50/50 is deferred to polish (Phase 12) because it's a layout experiment, not a content feature.**

**Why deferred:**
- The rail already gives users chat side-by-side with any tab at 300px. Going 50/50 is a second axis (minimize rail, full-size chat + collapsed rail on previous tab = different semantic).
- UI-SPEC §12 says "`/chat` route for extended sessions" — doesn't mandate split layout in first ship.
- Real user testing in Session 5/6 may reveal the right split shape (left=last tab, left=composer-draft, etc).

**v1 shape:**
- `/chat` route: `app/chat/page.tsx` renders a full-viewport `<ChatPanel standalone>`.
- Rail is hidden on `/chat` to avoid two chats. The rail provider respects `pathname === '/chat'` → collapsed and non-expandable.
- Keyboard: Ctrl+T on `/chat` does nothing (no rail to toggle).

## Q8. Unread dot + notifications

**Recommendation: SSE on the active chat stream. Collapsed rail reuses the same EventSource (via React context) so every assistant delta bumps `unreadCount`. Clear on expand.**

**State shape (`ChatRailProvider`):**

```ts
interface ChatRailState {
  open: boolean                  // false = 48px, true = 300px
  unread: number                 // bumped by SSE, cleared on open
  currentSessionId: string | null
  streaming: boolean             // true while SSE stream is in-flight
  lastMessagePreview: string     // for collapsed-rail render
  toggle: () => void             // Ctrl+T
  expand: () => void             // auto-expand on streaming
  collapse: () => void           // Escape
}
```

**Auto-expand trigger:** the SSE `assistant.begin` event calls `expand()` unless user explicitly collapsed in the last 5s. (Preserves the "user pressed Escape" intent.)

**Persistence:** `open` and `unread` are in-memory only — they reset on page reload. `localStorage` would be over-engineered for ephemeral UI state.

## Q9. Chat history persistence

**Recommendation: `.cae/chat/<session-uuid>.jsonl` at CAE_ROOT (global, not per-project). One jsonl per session.**

**Why global:** Chat conversations cross projects ("what's burning today across everything?"). Per-project storage forces artificial scoping.

**Why jsonl not DB:**
- Matches every other persistence surface in this repo (`.cae/metrics/*.jsonl`, inbox/outbox dirs). Ops on disk are auditable with grep + tail.
- No new dep. Phase 9 should introduce zero new runtime deps.
- Session resume via `claude --resume <uuid>` already keeps its own state at `~/.claude/projects/<projectPath>/<uuid>.jsonl` [VERIFIED on this machine] — our `.cae/chat/` transcript is a parallel "cleaned" thread (agent attribution, suggested-actions metadata, dialog-reply events) for rendering.

**File format:**
```jsonl
{"ts": "2026-04-22T14:01:01Z", "role": "user", "content": "what broke today?", "route": "/build"}
{"ts": "2026-04-22T14:01:02Z", "role": "assistant", "agent": "nexus", "content": "Nothing broke. p3 is ~2 min out.", "tokens": {"in": 412, "out": 38}}
```

**Session resolver (`lib/cae-chat-state.ts`):**
```ts
getOrCreateSession(project: string): Promise<string>  // returns uuid
appendMessage(sessionId: string, msg: ChatMessage): Promise<void>
readTranscript(sessionId: string, limit?: number): Promise<ChatMessage[]>
listSessions(): Promise<SessionSummary[]>  // for `/chat` session picker
```

**New conversation button:** generates a fresh uuid, writes an empty jsonl, updates `ChatRailProvider.currentSessionId`.

**Retention:** No auto-delete v1. User can rm the file. Session count is bounded by how often the user clicks "new conversation" — not a practical concern yet.

## Q10. Suggested actions

**Recommendation: hardcoded per-route map v1. Dynamic LLM-generated suggestions deferred.**

**Shape (`lib/chat-suggestions.ts`):**

```ts
type Suggestion = { label: string; message: string }  // label shown, message sent on click

export const SUGGESTIONS: Record<string, Suggestion[]> = {
  '/build': [
    { label: "What's blocked?", message: "Anything stuck today?" },
    { label: "Today's burn", message: "How many tokens did we spend today?" },
    { label: "What shipped?", message: "What got shipped in the last hour?" },
  ],
  '/build/queue': [
    { label: "Prioritize this queue", message: "Which of these should I do first?" },
    { label: "Why is X stuck?", message: "Why is the stuck column growing?" },
  ],
  '/build/changes': [
    { label: "Summarize today", message: "Plain-English, what shipped today?" },
  ],
  '/metrics': [
    { label: "Am I overspending?", message: "Is today's burn higher than usual?" },
  ],
  // ... one entry per route
}
```

**Rendered as:** 3 chip buttons below the chat input. `pathname` from `usePathname()`. Click → pre-fills input + sends.

**Why hardcoded v1:** deterministic, reviewable in the founder-speak copy pass. Dynamic suggestions need an LLM call on every tab switch = token burn.

**Upgrade path:** later phase can add `dynamic: true` flag per route that calls `POST /api/chat/suggestions` with `{ route, recentContext }` → LLM returns 3 phrases. Architecture is compatible.

---

# Architecture recommendation

## Module layout

```
app/
  build/
    changes/
      page.tsx              # server shell (auth + metadata)
      changes-client.tsx    # "use client" — renders groups + dev-mode toggle
  chat/
    page.tsx                # /chat standalone full-page ChatPanel
  api/
    changes/
      route.ts              # GET → ChangeEvent[]
    chat/
      send/route.ts         # POST msg → SSE stream
      state/route.ts        # GET → rail state (unread, sessions, preview)
      history/[sessionId]/route.ts  # GET transcript
      sessions/route.ts     # GET list, POST new

components/
  chat/
    chat-rail.tsx           # 48px → 300px shell w/ Ctrl+T + unread dot
    chat-panel.tsx          # thread + input + suggestions
    message.tsx             # single bubble w/ agent attribution
    suggestions.tsx         # 3 chips
    confirm-action-dialog.tsx  # explain-before-doing gate
  changes/
    change-row.tsx          # prose + [▾ technical] collapse
    change-day-group.tsx    # "Today" / "Yesterday" grouping
    dev-mode-detail.tsx     # SHA + commits + GitHub link

lib/
  cae-changes-state.ts      # aggregator (parallel to cae-home-state, cae-metrics-state)
  cae-chat-state.ts         # transcript CRUD + session resolver
  chat-voice-router.ts      # pickPersona({route, message}): AgentName
  chat-suggestions.ts       # SUGGESTIONS map
  chat-cost-estimate.ts     # heuristic for gate dialog
  chat-gated-actions.ts     # registry + wrapper util
  providers/
    chat-rail.tsx           # ChatRailProvider (React context)

docs/
  VOICE.md                  # root voice guide
  voices/
    nexus.md                # system-prompt fragment
    forge.md
    sentinel.md
    scout.md
    scribe.md
    phantom.md
    aegis.md
    arch.md
    herald.md
```

## Route / module count

- **4 API routes** (`changes`, `chat/send`, `chat/state`, `chat/history/[sessionId]`, `chat/sessions`) — 5 if we count the sessions list split. Call it **5 routes**.
- **6 lib modules** (`cae-changes-state`, `cae-chat-state`, `chat-voice-router`, `chat-suggestions`, `chat-cost-estimate`, `chat-gated-actions`) plus the **1 new provider** (`chat-rail`).
- **~8 new components** (rail + panel + message + suggestions + confirm + 3 changes components).
- **2 new pages** (`/build/changes` proper + `/chat`).
- **10 markdown docs** (VOICE.md + 9 per-persona files).

## Wave plan (suggested for planner)

- **Wave 0** — `docs/VOICE.md` + `docs/voices/*.md` (ALL 9). No code blocked on this. User review of VOICE.md is a gate.
- **Wave 1** — Aggregator + API route: `lib/cae-changes-state.ts` + `/api/changes/route.ts` + unit tests. In parallel: `lib/chat-voice-router.ts` + `lib/chat-suggestions.ts` + `lib/chat-cost-estimate.ts` + tests.
- **Wave 2** — Changes UI: `/build/changes` page + `change-row.tsx` + `change-day-group.tsx` + `dev-mode-detail.tsx` + `labels.ts` extensions.
- **Wave 2 (parallel)** — Chat plumbing: `lib/cae-chat-state.ts` + `chat/send` route (SSE spawn) + `chat/state` + `chat/history` + `chat/sessions`.
- **Wave 3** — Chat UI: `ChatRailProvider` + `ChatRail` + `ChatPanel` + `Message` + `Suggestions` + Ctrl+T + unread dot + auto-expand.
- **Wave 4** — Gate: `ConfirmActionDialog` + `chat-gated-actions.ts` + wiring into existing server actions (queue delegate, workflow run, retry).
- **Wave 5** — `/chat` page + integration + a11y + VERIFICATION.md + human sign-off.

Six waves is comparable to Phase 8's six waves (similar surface area).

---

# Code examples

## Change event aggregation (skeleton)

```ts
// lib/cae-changes-state.ts
const execAsync = promisify(exec);

export async function getChanges(): Promise<ChangeEvent[]> {
  const projects = await listProjects();
  const perProject = await Promise.all(projects.map(readChangesForProject));
  return perProject.flat().sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

async function readChangesForProject(p: Project): Promise<ChangeEvent[]> {
  try {
    const { stdout } = await execAsync(
      `git log --all --merges --since="30 days ago" --pretty=format:'%H|%h|%ci|%s|%an'`,
      { cwd: p.path, maxBuffer: 4 * 1024 * 1024 },
    );
    const merges = stdout.split('\n').filter(Boolean).map(parseMergeLine);
    const ghUrlBase = await resolveGithubUrlBase(p.path);
    const cbEvents = await tailJsonl(
      join(p.path, '.cae', 'metrics', 'circuit-breakers.jsonl'),
      5000,
    );
    return merges.map((m) => joinWithJsonl(m, p, ghUrlBase, cbEvents));
  } catch (err) {
    console.error(`[changes] ${p.name} failed:`, err);
    return [];
  }
}
```

## SSE chat response (skeleton)

```ts
// app/api/chat/send/route.ts
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response('unauthorized', { status: 401 });
  const { sessionId, message, route } = await req.json();
  const agent = pickPersona({ route, message });
  await appendMessage(sessionId, { role: 'user', content: message, ts: now(), route });

  const voiceFile = join(CAE_ROOT, 'dashboard', 'docs', 'voices', `${agent}.md`);
  const stream = spawnClaude({
    args: [
      '--print',
      '--resume', sessionId,
      '--append-system-prompt-file', voiceFile,
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--model', 'sonnet',
    ],
    stdin: message,
  });

  return new Response(makeSSE(stream, sessionId, agent), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

---

# Gotchas to honor (planner must wire verification for each)

1. **`git log --all` can be slow on repos with hundreds of merges.** Cap with `--since='30 days ago'` or `-n 500`. Benchmark on `/home/cae/ctrl-alt-elite` which already has dozens of `Merge forge/...` commits visible. Failure symptom: /build/changes takes >2s to paint.

2. **Subtree-merged repos (e.g., `dashboard` as a subtree inside CAE) double-report merges.** Verified in git log — `Merge commit '58e2e1e...' as 'dashboard'` shows up once per project. Dedupe by SHA across projects before render.

3. **`claude --resume` uses UUIDs only.** Validate format server-side: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`. Invalid UUID = `claude` exits non-zero with opaque error.

4. **Claude CLI session files live at `~/.claude/projects/<escaped-cwd>/<uuid>.jsonl`.** Directory name is the sanitized cwd path. If we spawn claude with `cwd` = CAE_ROOT, sessions land under `-home-cae-ctrl-alt-elite`. This affects `--resume` lookup — spawn must use the SAME cwd as the session was created with.

5. **base-ui `asChild` trap.** ChatRail's expand/collapse transitions must NOT use `asChild` on base-ui primitives. Write the element directly + `className={cn(...)}`. [AGENTS.md phase 2 gotcha]

6. **`@agent` vs. `@task:tb-...` mention parse collision.** UI-SPEC §5 has `@task:tb-abc123` mentions in the task detail comments thread. Chat `@agent` parse must be exactly-one-token-at-start-of-message; otherwise delegate to plain text. Add unit test.

7. **SSE reconnect and duplication.** Browser EventSource auto-reconnects on disconnect. Server must send a `Last-Event-ID`-awareness or the client must de-dupe on `messageId`. Phase 2's `/api/tail` doesn't handle this (log tail is idempotent; chat deltas aren't). Add an `id: <uuid>` field to every SSE chunk and dedupe client-side.

8. **Dev-mode toggle must not show jargon on /chat.** `/chat` is primarily a Nexus surface — Dev-mode changes what SHE says (shows SHAs, task IDs, raw model names), not the routing. Copy-QA step required in Wave 5.

9. **`--append-system-prompt-file` + `--resume` interaction.** Appending a new system prompt on every resume call can drift the conversation's persona mid-thread. Solution: set voice ONCE at session creation, store `agent` in the session metadata, and pass the SAME voice file on every resume. Router re-picks only on new sessions or explicit `@agent` switch.

10. **ChatRailProvider mounted in root layout means unauthenticated `/signin` renders it.** Gate with `if (!session) return null` inside provider. [VERIFIED: `app/layout.tsx` pattern `{session && <TopNav ...>}`]

11. **Ctrl+T collides with browser "new tab" on Chrome/Firefox.** [VERIFIED: MDN standard binding]. Either use Ctrl+Shift+T (conflicts with "reopen closed tab"), Ctrl+` (conflicts with terminal), or keep Ctrl+T but add `preventDefault()` ONLY when focus is inside the dashboard (not on browser chrome — and Chrome intercepts Ctrl+T at the chrome level regardless). **Accept that Ctrl+T in non-Chromium browsers works, Chromium users get a visible rail toggle button** — the UI-SPEC already says click-to-toggle on the collapsed rail. Plan must include this tradeoff as a documented constraint.

12. **Spawning `claude --print` counts against the user's OAuth rate. Chat is a fast-feedback surface.** If rate-limited, handle gracefully: show a "CAE is rate-limited for 30s" inline message, disable input for that window.

13. **Screen shake on merge (Phase 3 shipped) and chat auto-expand on stream must not stack.** If an agent streams mid-shake, rail-expand animation + screen-shake together look glitchy. Debounce: skip auto-expand if shake is active.

14. **GitHub URL derivation fails gracefully.** Not every project has an origin remote (e.g., `/tmp/bridge-test-repo`). Null → no link rendered. Don't fall back to `#`.

15. **`.cae/chat/<uuid>.jsonl` with concurrent writes.** If user sends message A and before SSE finishes starts typing message B, both append to the jsonl. Use atomic `appendFile` (single syscall) — Node's `fs.appendFile` is atomic for <4KB under POSIX, and each jsonl line is well under that.

---

# Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | dashboard dev + build | yes | v22.22.0 | — |
| pnpm | install | yes | 10.28.2 | — |
| git | /api/changes aggregator | yes | 2.43.0 | — |
| tmux | chat subprocess spawn (reused pattern) | yes | 3.4 | — |
| claude CLI | chat LLM transport | yes | 2.1.117 (2026-04-21) | — (blocker) |
| `~/.claude/projects/` | session resume | yes | present | — |

All deps present. Zero new runtime deps needed — every library Phase 9 uses is already in `package.json` (@base-ui/react 1.4.0, react-markdown 10.1.0 for agent message rendering, lucide-react 0.510.0 for icons, sonner for toast on dev-mode instant-execute).

---

# Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 1.6.1 (installed in Phase 8 Wave 0) |
| Config file | `vitest.config.ts` / per-file (see Phase 8 precedent) |
| Quick run | `pnpm test -- --run path/to/file.test.ts` |
| Full suite | `pnpm test` |

### Phase requirements → test map

| REQ | Behavior | Test type | Command | File exists? |
|-----|----------|-----------|---------|-------------|
| CHG-01 | aggregator returns ChangeEvent[] sorted desc | unit | `pnpm test -- --run lib/cae-changes-state.test.ts` | ❌ Wave 1 |
| CHG-02 | dev-mode reveals SHA + commits | unit (component) | `pnpm test -- --run components/changes/change-row.test.tsx` | ❌ Wave 2 |
| CHG-03 | git log + jsonl join on task_id | unit | same as CHG-01 | ❌ Wave 1 |
| CHT-01 | rail width toggles 48 ↔ 300 on Ctrl+T | unit (component) | `pnpm test -- --run components/chat/chat-rail.test.tsx` | ❌ Wave 3 |
| CHT-02 | SSE delta increments unread | unit | `pnpm test -- --run lib/providers/chat-rail.test.tsx` | ❌ Wave 3 |
| CHT-03 | voice router picks agent from route + message | unit | `pnpm test -- --run lib/chat-voice-router.test.ts` | ❌ Wave 1 |
| CHT-04 | /chat page renders ChatPanel full-width | smoke | manual + e2e optional | — |
| CHT-05 | suggestions map keyed by route | unit | `pnpm test -- --run lib/chat-suggestions.test.ts` | ❌ Wave 1 |
| CHT-06 | ConfirmActionDialog intercepts gated action | unit (component) | `pnpm test -- --run components/chat/confirm-action-dialog.test.tsx` | ❌ Wave 4 |
| VOI-01 | VOICE.md + 9 voice files exist | smoke | `test -f docs/VOICE.md && test -f docs/voices/nexus.md && …` | ❌ Wave 0 |

### Sampling rate
- **Per task commit:** run that task's test file.
- **Per wave merge:** full `pnpm test` + `pnpm lint` + `pnpm build`.
- **Phase gate:** full suite green + UAT checklist of "message a persona, confirm gated action, see timeline".

### Wave 0 gaps
- [ ] `docs/VOICE.md` + 9 voices/*.md
- [ ] Wave 1 test files per table (all new)

---

# Security Domain

| ASVS | Applies | Control |
|------|---------|---------|
| V2 Auth | yes | `auth()` guard on every POST (pattern shipped) |
| V3 Session | yes | NextAuth session cookie (reused) |
| V4 Access control | yes | server-only agent spawn, no cross-user chat leakage |
| V5 Input validation | yes | UUID validation on sessionId, max-length message body, `@agent` parse whitelist |
| V6 Crypto | no | no new crypto surface |

| Threat | STRIDE | Mitigation |
|--------|--------|-----------|
| Prompt injection via chat message → spawned claude | Tampering | run claude in non-write mode by default (`--permission-mode plan` for chat), gate tool-use actions explicitly |
| Malformed UUID crashes claude subprocess | DoS | regex-validate before spawn |
| User overwrites another user's session transcript | Tampering | v1 = single-user dashboard, deferred multi-user; document as known limitation |
| Path traversal via sessionId into .cae/chat/../../ | Tampering | sanitize: UUID-only regex before path join |

---

# Sources

### Primary (HIGH)
- `docs/UI-SPEC.md` §0, §2, §10, §12, §13, §14, §Audience reframe, §S4.1–S4.7 (design law, locked)
- `ROADMAP.md` Phase 9 definition + Phase 8 shipped context
- `package.json` — deps + versions [VERIFIED]
- `lib/cae-home-state.ts`, `lib/cae-metrics-state.ts`, `lib/cae-agents-state.ts` — aggregator patterns [VERIFIED]
- `app/api/tail/route.ts` — SSE pattern [VERIFIED]
- `app/build/queue/actions.ts`, `app/api/workflows/[slug]/run/route.ts` — tmux spawn pattern [VERIFIED]
- `adapters/claude-code.sh` — adapter reference [VERIFIED, 200 lines read]
- `lib/copy/agent-meta.ts` — 9-agent canonical source [VERIFIED]
- `lib/providers/explain-mode.tsx` — Ctrl+E binding pattern [VERIFIED]
- `agents/cae-nexus.md`, `agents/cae-forge.md`, `agents/cae-sentinel.md` — persona content [VERIFIED]
- `claude --help` output — CLI flags (`--resume`, `--session-id`, `--output-format stream-json`, `--include-partial-messages`, `--append-system-prompt-file`) [VERIFIED]
- `~/.claude/projects/…/<uuid>.jsonl` — session persistence on-disk [VERIFIED]
- `.cae/metrics/circuit-breakers.jsonl` — event shape [VERIFIED: sampled]
- `git log --all --merges` on /home/cae/ctrl-alt-elite — merge-commit format [VERIFIED: sampled]

### Secondary (MEDIUM)
- [CITED: Vercel AI SDK docs — https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol] — SSE-based stream protocol, informed the alternative considered
- [CITED: Upstash blog — https://upstash.com/blog/sse-streaming-llm-responses] — Next.js SSE streaming patterns
- [CITED: Intercom — https://www.intercom.com/resources/design-guides] — voice-and-tone guide structure inspiration
- [CITED: GitHub Primer — https://primer.style/foundations/content] — do/don't tone table pattern

### Tertiary (LOW)
- `@anthropic-ai/sdk` 0.90.0 availability [VERIFIED via npm view] — noted as the alternative transport; not recommended

---

# Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `claude --resume <uuid> --append-system-prompt-file <f>` persona stays stable across multi-turn resume | Q3, Gotcha #9 | Mid-conversation persona drift; would need to switch to single-append-at-creation |
| A2 | Ctrl+T can be caught in Firefox but NOT Chromium | Gotcha #11 | Accept click-to-toggle as primary interaction (already design-intended) |
| A3 | Token-usage heuristics (5k retry / 10k workflow / 8k delegate) are reasonable founder-facing defaults | Q6 | Defaults too high → unnecessary friction; too low → bypassed mental model. Revisit after 2 weeks of real use |
| A4 | 30-day `--since` window gives a full Changes timeline | Q1, Gotcha #1 | Founder may want "all-time" history; add pagination in Phase 12 polish |
| A5 | Voice routing via static heuristic correctly picks persona ≥80% of the time | Q4 | Misroutes feel janky; LLM classifier is the deferred upgrade |

---

# Open questions (for /gsd-discuss-phase or user gate)

1. **Which key toggles the chat rail?** Ctrl+T is the SPEC. Chrome hard-steals it. Confirm: accept (UI-SPEC wins) with visible toggle button fallback, or switch to Ctrl+` / Ctrl+/ / Ctrl+Shift+Space? Recommend keep Ctrl+T, document the Chromium constraint, rely on visible toggle button + keyboard hint.
2. **What model powers chat?** Default sonnet-4-6 (matches agent roster average)? Or opus for Nexus-as-host? Recommend `sonnet` default, Opus override only when routing lands on Sentinel / Phantom (adversarial + diagnostic work).
3. **Should chat read other projects' `.cae/chat/*.jsonl` or only the current?** Recommend: global for v1 (chat crosses projects), flag if founder wants per-project isolation.
4. **Is VOICE.md user-reviewable before code ships in Wave 0?** Strongly recommend yes — Eric's voice calibration from previous sessions (memory notes: "feedback_be_critical", "feedback_autonomous_keep_going") suggests he has strong voice preferences.

---

# Metadata

**Confidence breakdown:**
- Stack + versions: HIGH — every lib verified via `package.json` or `npm view`
- Architecture patterns: HIGH — all reused from Phases 2–8 shipped code
- Chat transport: MEDIUM — claude CLI chosen but `@anthropic-ai/sdk` is a valid alternative if the OAuth story changes
- Voice routing heuristics: MEDIUM — static rules may need tuning after founder testing
- Gotchas: HIGH — most are grounded in verified AGENTS.md entries + sampled file contents
- VOICE.md shape: MEDIUM — structure inspired by public style guides, specific content Eric-gated

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days — stable ecosystem, no breaking changes expected)
