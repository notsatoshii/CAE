---
phase: 09-changes-tab-right-rail-chat
plan: 03
subsystem: chat-api
tags: [wave-1, chat-api, sse, subprocess, uuid-validation, atomic-append, parallel-with-09-02]

# Dependency graph
requires:
  - phase: 09-01 (Wave 0)
    provides: "pickPersona, MODEL_BY_AGENT, modelForAgent (lib/voice-router.ts) + docs/voices/<agent>.md"
  - phase: 04-build-home-rewrite
    provides: "AgentName type + AGENT_META (lib/copy/agent-meta.ts)"
  - phase: 08-memory-whytrace
    provides: "vitest config + jsdom env + tests/setup.ts"
provides:
  - "lib/cae-chat-state.ts — session + transcript + meta helpers (getOrCreateSession, appendMessage, readTranscript, readTranscriptAfter, listSessions, getSessionMeta, setSessionMeta, validateSessionId, resolveChatPath, ValidationError, ChatMessage, SessionMeta, SessionSummary)"
  - "lib/chat-spawn.ts — spawnClaudeChat() wrapper around claude --print --resume (D-03)"
  - "/api/chat/send — POST text/event-stream with assistant.{begin,delta,end}/unread_tick/rate_limited events; per-frame UUID id: for D-17 dedupe"
  - "/api/chat/state — GET rail-state snapshot with unreadCount via last_seen replay"
  - "/api/chat/history/[sessionId] — GET full transcript + meta"
  - "/api/chat/sessions — GET list / POST new session"
affects: [09-05, 09-07]

# Tech tracking
tech-stack:
  added: []  # zero new runtime deps
  patterns:
    - "UUID-regex-before-fs gate: every sessionId passes validateSessionId() before any filesystem or subprocess call (gotcha #3, T-09-03-02)"
    - "resolve()+startsWith() defense-in-depth path-traversal guard inside resolveChatPath — even if the UUID regex were bypassed, the resolved path cannot escape ${CAE_ROOT}/.cae/chat/"
    - "Atomic single-syscall fs.appendFile for ChatMessage lines (gotcha #15); atomic write-tmp+rename for setSessionMeta"
    - "CAE_ROOT re-read on every lib call (no module-level cache) so unit tests can swap the chat root per-test via env"
    - "SSE frame schema: id:<uuid>\\nevent:<name>\\ndata:<json>\\n\\n — every frame has a UUID id for client-side dedupe on EventSource reconnect (D-17)"
    - "stream-json parse loop: buffer += stdout chunk; split on \\n; parse each line; dispatch on type (stream_event→content_block_delta→delta.text, result→usage.{input,output}_tokens)"
    - "Persona resolution cascade: @agent first-token override → stored session meta → pickPersona(route, message) default (D-05, gotcha #9)"
    - "Spawned claude args as typed array, never shell-parsed (T-09-03-06 command-injection mitigation)"

key-files:
  created:
    - "dashboard/lib/cae-chat-state.ts"
    - "dashboard/lib/cae-chat-state.test.ts"
    - "dashboard/lib/chat-spawn.ts"
    - "dashboard/app/api/chat/send/route.ts"
    - "dashboard/app/api/chat/state/route.ts"
    - "dashboard/app/api/chat/history/[sessionId]/route.ts"
    - "dashboard/app/api/chat/sessions/route.ts"
  modified: []

key-decisions:
  - "replay-from-unknown = [] semantics: readTranscriptAfter returns empty array when last_seen_msg_id matches no known message (client's cursor is stale, should refetch full transcript). Alternative (return all) would double-render on reconnect."
  - "CAE_ROOT re-read per call (not module cache) so vitest can isolate via env swap without vi.doMock on the cae-config module. Production overhead is one env lookup — negligible."
  - "Persona override PERSISTED into session meta on each @agent turn. User said @phantom once → next (unprefixed) turn also goes to phantom. Matches user intent (they switched the conversation's lead) better than one-shot-override (which drifts back on the next turn)."
  - "Error copy in routes is hardcoded English with TODO comments pointing at chat.* label keys owned by plan 09-02 Task 3 (Wave 1 disjoint-file rule). A future wiring plan can drop labelFor() in; the response shape {error: string} is stable."
  - "listSessions includes zero-message sessions with empty last_preview (vs. hiding them). Founder creates a new session and expects to see it in the picker before typing anything."
  - "/api/chat/state streaming:false is authoritative for the snapshot but NOT for the live stream. The client-side rail provider is the owner of streaming bool once it opens an EventSource."
  - "spawnClaudeChat on-error path resolves wait() with exit code 127 (POSIX convention for command-not-found) instead of rejecting. Keeps the /send route's `await handle.wait()` uniform — it always gets a number, not a thrown error — and the `code !== 0` branch emits rate_limited (which the UI surfaces as transient failure, the correct user-facing outcome)."

patterns-established:
  - "UUID-regex-before-fs is the canonical guard for any user-supplied path component under .cae/**"
  - "Stream-json parsing in an SSE re-framer: newline-buffer on stdout `data` events, JSON.parse per line, dispatch by obj.type, drop any line that fails to parse (CLI banners, partial mid-line writes)"
  - "Next 15 dynamic param pattern: `ctx: { params: Promise<{key: string}> }` + `const { key } = await ctx.params`"

requirements-completed: [CHT-01-server, CHT-02-server, CHT-03-transport, CHT-06-transport]
# Note: CHT-01 / CHT-02 / CHT-06 full completion lands with the Wave 2 UI (09-05) and Wave 3 gate (09-06). This plan ships the SERVER halves only.

# Metrics
duration: 7min
completed: 2026-04-22
---

# Phase 9 Plan 03: Chat API routes, state lib, spawn wrapper Summary

**Server plumbing for the persistent right-rail chat: 4 API routes (send-SSE, state, history, sessions), cae-chat-state lib with 22 vitest assertions, chat-spawn wrapper around `claude --print --resume` — full D-03 transport, D-05/D-06 persona routing, D-08 global session jsonl, D-09 unread SSE, D-17 per-frame UUID dedupe, security gotchas 3/4/9/12/15 honored, zero new deps.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-22T15:10:38Z
- **Completed:** 2026-04-22T15:17:50Z
- **Tasks:** 3 / 3
- **Files created:** 7 (2 lib sources, 1 test file, 4 API routes)
- **Files modified:** 0

## Accomplishments

### Task 1: `lib/cae-chat-state.ts` + tests (TDD)

- **Validation primitives (threat T-09-03-02, gotcha #3):** `validateSessionId(unknown)` asserts a v4-shape UUID via `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`. `resolveChatPath(sid)` uses that guard + `path.resolve(base, f).startsWith(base + '/')` defense-in-depth.
- **Session primitives (D-08):** `getOrCreateSession(agent)` creates `${CAE_ROOT}/.cae/chat/{randomUUID}.jsonl` with `{role:"meta", session_id, agent, created_at}` as line 1 (using `flag:"wx"` to fail on collision). `getSessionMeta(sid)` parses line 1. `setSessionMeta(sid, meta)` atomic write-tmp + rename, preserving line 2+.
- **Transcript primitives (D-17, gotcha #15):** `appendMessage(sid, msg)` single-syscall `fs.appendFile` (atomic for <4KB lines). `readTranscript(sid, limit?)` parses line-by-line, skips torn/invalid lines, skips the meta line, honors optional `limit`. `readTranscriptAfter(sid, afterMsgId)` returns all messages with index > indexOf(afterMsgId); returns [] if afterMsgId is unknown (replay-from-stale).
- **`listSessions()`:** newest-first by mtime; preview truncated to 80 chars; skips non-UUID filenames and meta-less files.
- **Tests (22 vitest assertions across 8 describe blocks):** UUID validation happy-path + 6 malicious attempts (path-traversal, empty, null, undefined, number, newline-injection, leading slash, embedded dots, non-string, uppercase). Meta round-trip. Append+read round-trip with ordering + limit-N + missing-session-returns-[]. `readTranscriptAfter` with null-baseline, known-id, unknown-id. 20-way parallel appendMessage with zero torn lines. `listSessions` mtime-desc + preview-truncation + message-count.
- **Env isolation for tests:** `process.env.CAE_ROOT = await mkdtemp(...)` per-test + `vi.resetModules()` + dynamic `await import()` so each test runs against a fresh chat dir. The lib re-reads CAE_ROOT on every call (no module cache).

### Task 2: `lib/chat-spawn.ts`

- **`spawnClaudeChat({sessionId, voiceFile, model, messageText, cwd})`** → `{stdout, stderr, wait, kill}`.
- **Exact D-03 invocation:** `claude --print --resume <sid> --append-system-prompt-file <file> --output-format stream-json --include-partial-messages --model <id>`.
- **cwd=CAE_ROOT** per gotcha #4 so the claude CLI resolves `~/.claude/projects/-home-cae-ctrl-alt-elite/<uuid>.jsonl`.
- **Security (T-09-03-06):** args are a typed array, no shell interpolation. Caller enforces the UUID/voice whitelist.
- **Error path:** `spawn('claude', ...)` ENOENT fires `error` → `wait()` resolves with 127; callers' `code !== 0` branch emits SSE `rate_limited` uniformly.
- **No standalone tests** — thin (~40 LOC) wrapper; integration-covered by `/api/chat/send` in Wave 5 e2e.

### Task 3: Four API routes

**`POST /api/chat/send` (the complex one):**
- auth() guard; JSON body parse; UUID validation via `validateSessionId`; message length ≤ 4000.
- Persona cascade: `@agent` first-token regex whitelist (the 9 names) → stored `getSessionMeta` → `pickPersona({route, message})` default (D-05, gotcha #9).
- Persona decision PERSISTED: on override, rewrites `setSessionMeta(sid, {..., agent: overrideAgent})` so the NEXT turn inherits it. On missing meta, backfills a fresh meta record.
- Persists user turn to jsonl BEFORE spawning claude (crash-safe).
- `spawnClaudeChat` → `ReadableStream<Uint8Array>`; `stdout.on('data')` buffers+splits on `\n`+JSON.parses each line. Dispatches: `stream_event.content_block_delta.delta.text` → SSE `assistant.delta`. When `on_route !== '/chat'`, each delta also emits `unread_tick` (D-09). `type:"result"` → captures `usage.input_tokens/output_tokens`.
- stderr watched for `/rate.?limit|usage.?limit/i`; rate-limit OR non-zero exit → SSE `rate_limited {retry_after_sec: 30}` (gotcha #12).
- On success: persist assistant turn with full text + tokens; emit SSE `assistant.end` with the assistant message's UUID as the frame id (so client `last_seen_msg_id` cursor aligns with persisted message id — D-17).
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.

**`GET /api/chat/state`:** auth() + optional UUID validation on `?sessionId`; `readTranscriptAfter(sid, ?last_seen)` → `unreadCount = after.length`; last message content truncated to 80 chars → `lastMessagePreview`; `listSessions()` → `sessions[]`. `streaming: false` is the snapshot default (client owns the live stream bool).

**`GET /api/chat/history/[sessionId]`:** Next 15 `ctx.params` await pattern; auth() + UUID validation; `Promise.all([readTranscript, getSessionMeta])` → `{messages, meta}`.

**`GET /api/chat/sessions`** → `{sessions: SessionSummary[]}`. **`POST /api/chat/sessions`** → validates `body.agent` against a nine-name whitelist (falls back to `"nexus"` on invalid/absent); creates new uuid+meta via `getOrCreateSession`; returns `{sessionId, agent}`.

## SSE Frame Schema (frozen for Wave 2 UI — plan 09-05)

Every frame from `POST /api/chat/send` has this shape:

```
id: <uuid>
event: <name>
data: <json>

```

Six event types:

| event             | data                                              | when                                                          |
|-------------------|---------------------------------------------------|---------------------------------------------------------------|
| `assistant.begin` | `{sessionId, agent, model}`                        | Once at stream start (before any delta).                      |
| `assistant.delta` | `{delta: string}`                                  | Per text chunk from `content_block_delta`.                    |
| `unread_tick`     | `{unread: 1}`                                      | Alongside each delta when `on_route` query param ≠ `/chat`.   |
| `assistant.end`   | `{final: string, tokens: {in: number, out: number}}`| Once at stream end after successful claude exit.              |
| `rate_limited`    | `{retry_after_sec: 30}`                            | On non-zero exit OR stderr matching /rate.?limit/i.           |

The `id` on `assistant.end` equals the persisted assistant-message's id — clients use this as `last_seen_msg_id` for D-17 replay on reconnect.

## Type Shapes Frozen for Wave 2 Consumers

```ts
// From lib/cae-chat-state.ts
export interface SessionMeta {
  session_id: string;
  agent: AgentName;
  created_at: string;
}

export interface ChatMessage {
  id: string;                                 // UUID per message (D-17)
  ts: string;                                 // ISO8601
  role: "user" | "assistant";
  content: string;
  agent?: AgentName;                          // on assistant messages
  route?: string;                             // on user messages
  tokens?: { in: number; out: number };       // on assistant messages
}

export interface SessionSummary {
  session_id: string;
  agent: AgentName;
  created_at: string;
  mtime_ms: number;
  last_preview: string;                       // ≤80 chars
  message_count: number;
}
```

## Persona-Resolution Order (for `/api/chat/send`)

In this strict cascade, first-match-wins:

1. **Explicit override.** If the user message (after `.trimStart()`) matches `/^@(nexus|forge|sentinel|scout|scribe|phantom|aegis|arch|herald)\b/i`, that agent wins. The `\b` word boundary prevents `@nexustest` from matching. `@task:...` (Phase-5 task mention pattern) does NOT match because `task` is not in the whitelist (gotcha #6 honored).
2. **Stored session meta.** `getSessionMeta(sid).agent` — whatever the previous turn established (either the initial create-time persona or a later override that got persisted). Gotcha #9 stability: the same voice file gets passed on every resume.
3. **Voice-router default.** `pickPersona({route, message})` — the Wave 0 D-05 static heuristic (explicit `@agent` → keyword rules → route prefix rules → nexus default).

When step 1 fires AND differs from step 2, step 1's agent is persisted via `setSessionMeta(sid, {...meta, agent: overrideAgent})` so step 2 inherits it on the NEXT turn.

## `chat.*` Label Keys Referenced (but NOT implemented in this plan)

Per Wave 1 disjoint-file rule, `lib/copy/labels.ts` is owned by plan 09-02 Task 3. The four error paths in this plan carry hardcoded English strings with inline TODO comments pointing at the expected keys:

| Route                                        | Hardcoded response              | Expected key              |
|----------------------------------------------|---------------------------------|---------------------------|
| ALL four (no session)                        | `"unauthorized"` (body)         | `chat.errorUnauthorized`  |
| `/api/chat/send` (bad JSON)                  | `{error: "bad json"}`           | `chat.errorBadRequest`    |
| `/api/chat/send` (missing fields)            | `{error: "missing fields"}`     | `chat.errorMissingFields` |
| `/api/chat/send` (length > 4000)             | `{error: "too long"}`           | `chat.errorTooLong`       |
| `/api/chat/send`, `/state`, `/history` (bad UUID) | `{error: "bad sessionId"}` | `chat.errorBadSessionId`  |

Wave 2 UI (09-05) reads `chat.*` keys directly from labels.ts (server responses are only checked for HTTP status); a future plan may wire labelFor() into the response bodies if we ever surface these in non-English UI.

## Task Commits

| Task | Commit  | Description                                                                 |
|------|---------|-----------------------------------------------------------------------------|
| 1    | `de5c5a3` | feat(09-03): cae-chat-state — session + transcript + meta + validation     |
| 2    | `7603489` | feat(09-03): chat-spawn wrapper around claude --print --resume              |
| 3    | `2df2912` | feat(09-03): chat API routes — send (SSE) / state / history / sessions     |

Each was a single `feat` commit; Task 1 followed TDD (RED verified in-session with "Failed to resolve import", then GREEN committed as one atomic `feat`).

## Files Created/Modified

- `dashboard/lib/cae-chat-state.ts` — 245 LOC, 10 public exports.
- `dashboard/lib/cae-chat-state.test.ts` — 280 LOC, 22 vitest assertions across 8 describes.
- `dashboard/lib/chat-spawn.ts` — 127 LOC, 1 public export.
- `dashboard/app/api/chat/send/route.ts` — 260 LOC, POST handler + SSE re-framer.
- `dashboard/app/api/chat/state/route.ts` — 65 LOC.
- `dashboard/app/api/chat/history/[sessionId]/route.ts` — 55 LOC.
- `dashboard/app/api/chat/sessions/route.ts` — 60 LOC.

## Decisions Made

- **Replay-from-unknown = [].** When `readTranscriptAfter(sid, staleId)` can't locate `staleId` in the jsonl, it returns `[]` instead of the full transcript. Client's `last_seen_msg_id` is stale → it must refetch `/api/chat/history/[sessionId]`. Alternative (return all) would double-render the already-seen portion on reconnect. Documented in the module comment + tested.
- **CAE_ROOT re-read per call.** No module-level cache. One env lookup per API call (negligible). Enables clean vitest isolation via per-test env swap.
- **Persona override PERSISTS into meta.** `@phantom this is stuck` flips the session to phantom permanently (until another `@...` override). Matches user intent (they switched the conversation's lead) better than single-turn override (where the next unprefixed turn drifts back — likely not what they wanted).
- **Error copy is hardcoded English with TODO markers.** Wave 1 disjoint-file rule says 09-02 Task 3 owns `lib/copy/labels.ts`. Error bodies use stable strings so Wave 2's client can switch on `{error: "..."}` shapes without coupling to English.
- **`listSessions` includes zero-message sessions.** User creates a session before typing; it should appear in the picker immediately with an empty preview.
- **`/api/chat/state.streaming: false` is the SNAPSHOT value.** The client-side rail provider owns `streaming: true` once it opens an EventSource. Server has no authoritative view of whether a client is currently consuming `/api/chat/send`.
- **spawnClaudeChat `error` → `wait()` resolves with 127.** Unifies the caller's error path: always get a number from `wait()`, treat non-zero as "emit rate_limited and close." Correctness: 127 is POSIX command-not-found; claude-missing is effectively a transient failure from the user's POV, which is what rate_limited conveys.

## Deviations from Plan

### Auto-fixed issues

None — plan executed exactly as written for all three tasks.

### Scope boundary honored

- Did NOT modify `lib/copy/labels.ts` (owned by 09-02 Task 3 — Wave 1 disjoint-file rule).
- Did NOT touch `lib/cae-changes-state.ts` or `/api/changes/route.ts` (09-02's files).
- Pre-existing failing test suites in the repo (detected at plan start) were out of scope per GSD scope rule; my only test file (cae-chat-state.test.ts) is 22/22 green.

## Issues Encountered

- **Transient tsc error from parallel 09-02.** Mid-task tsc runs showed type errors in `lib/cae-changes-state.test.ts` (09-02's file, before 09-02 had written the implementation). Those errors vanished once 09-02 landed commit `cbc1fa3`. My files never had tsc errors. Final `pnpm tsc --noEmit` = exit 0.
- **Vitest CJS deprecation warning.** Pre-existing, same as the Phase 8 note. Noise, not a failure.

## Authentication Gates

None — the plan is pure backend code + tests. All four routes are guarded by `auth()` (the existing NextAuth session check); no new auth setup is needed for dev/smoke testing.

## Verification Results

```bash
pnpm test lib/cae-chat-state.test.ts       # 22/22 passed
pnpm tsc --noEmit                           # exit 0, clean
pnpm build                                  # green, all 4 chat routes registered
./scripts/lint-no-dollar.sh                 # PASS (no $ in new sources)
```

Route greps (from plan's verify block):
- `grep "export async function POST" app/api/chat/send/route.ts` → found
- `grep "text/event-stream"` → found
- `grep "assistant.delta"` → found
- `grep "unread_tick"` → found
- `grep "rate_limited"` → found
- `grep "auth()"` × 4 routes → found in all four
- Lib greps: `validateSessionId`, `resolveChatPath`, `readTranscriptAfter`, `path traversal` all found in `cae-chat-state.ts`
- Spawn greps: `spawnClaudeChat`, `--resume`, `--append-system-prompt-file`, `--output-format`, `stream-json`, `include-partial-messages` all found

## Next Phase Readiness

**Ready for Wave 2 (09-05 — Chat UI):**

- `/api/chat/send` — opens an EventSource with `{sessionId, message, route}` body; parse `id:` per frame for client-side dedupe; observe `assistant.delta`/`assistant.end`/`unread_tick`/`rate_limited` events.
- `/api/chat/state?sessionId=<uuid>&last_seen=<msgId>` — poll for rail state; unreadCount is definitive.
- `/api/chat/history/[sessionId]` — prime the panel thread on mount.
- `/api/chat/sessions` — list picker + new-conversation button.
- `ChatMessage`/`SessionMeta`/`SessionSummary` type shapes (see frozen table above) are stable contract.

**Ready for Wave 4 (09-07 — /chat standalone page):** same API surface; `?on_route=/chat` query param on `/send` suppresses the `unread_tick` event.

**Blockers:** None. Plan 09-02 committed `cbc1fa3` during this plan's execution; both Wave 1 plans are now merged with zero file overlap.

## User Setup Required

None — the plan is server code + unit tests only. For smoke testing:

```bash
# Requires an active NextAuth session cookie ($S) from /signin:
curl -i -X POST http://localhost:3000/api/chat/sessions \
  -H "Cookie: $S" -H "Content-Type: application/json" \
  -d '{"agent":"nexus"}'
# → {sessionId: "<uuid>", agent: "nexus"}

curl -iN -X POST http://localhost:3000/api/chat/send \
  -H "Cookie: $S" -H "Content-Type: application/json" \
  -d '{"sessionId":"<uuid>","message":"hey","route":"/build"}'
# → text/event-stream with begin → delta* → end frames
```

## Self-Check: PASSED

**Files (7) — all FOUND:**
- FOUND: dashboard/lib/cae-chat-state.ts
- FOUND: dashboard/lib/cae-chat-state.test.ts
- FOUND: dashboard/lib/chat-spawn.ts
- FOUND: dashboard/app/api/chat/send/route.ts
- FOUND: dashboard/app/api/chat/state/route.ts
- FOUND: dashboard/app/api/chat/history/[sessionId]/route.ts
- FOUND: dashboard/app/api/chat/sessions/route.ts

**Commits (3) — all FOUND:**
- FOUND: de5c5a3 (Task 1 — cae-chat-state)
- FOUND: 7603489 (Task 2 — chat-spawn)
- FOUND: 2df2912 (Task 3 — 4 chat API routes)

**Verification sweeps:**
- `pnpm test lib/cae-chat-state.test.ts` → 22/22 passed
- `pnpm tsc --noEmit` → exit 0
- `pnpm build` → green, all 4 chat routes registered in the route table
- `./scripts/lint-no-dollar.sh` → PASS
- All plan-verify greps → passed

---
*Phase: 09-changes-tab-right-rail-chat*
*Completed: 2026-04-22*
