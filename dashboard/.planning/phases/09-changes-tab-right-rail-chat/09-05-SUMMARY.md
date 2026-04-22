---
phase: 09-changes-tab-right-rail-chat
plan: 05
subsystem: chat-ui
tags: [wave-2, ui, chat, sse, provider, react-markdown, parallel-with-09-04]

# Dependency graph
requires:
  - phase: 09-01 (Wave 0)
    provides: "suggestionsFor from lib/chat-suggestions.ts + agentMetaFor from lib/copy/agent-meta.ts (used by Suggestions + Message)"
  - phase: 09-03 (Wave 1b)
    provides: "SSE contract on /api/chat/send (id:/event:/data: frames; assistant.begin/delta/end, unread_tick, rate_limited) + /api/chat/{sessions,history/[id],state} routes"
  - phase: 09-02 (Wave 1a)
    provides: "chat.* labels added to lib/copy/labels.ts (Task 3)"
  - phase: 04-build-home-rewrite
    provides: "AgentName + agentMetaFor (lib/copy/agent-meta.ts)"
  - phase: 03-design-system-foundation
    provides: "labelFor(dev) + labels interface + ExplainTooltip primitive"
  - phase: 08-memory-whytrace
    provides: "vitest + jsdom + @testing-library/react config"
provides:
  - "lib/providers/chat-rail.tsx — ChatRailProvider + useChatRail() + default no-op context (unauth safe)"
  - "components/chat/chat-rail.tsx — 48px collapsed / 300px expanded shell, session- and /chat-gated"
  - "components/chat/chat-panel.tsx — thread + textarea input + Suggestions chips + SSE stream consumer with id-based dedupe (D-17)"
  - "components/chat/message.tsx — single bubble, assistant markdown via react-markdown+remark-gfm (no rehype-raw — T-09-05-01)"
  - "components/chat/suggestions.tsx — route-keyed chip buttons backed by Wave 0 suggestionsFor()"
  - "app/layout.tsx — mounts ChatRailProvider + (session-gated) ChatRail"
affects: [09-06, 09-07]

# Tech tracking
tech-stack:
  added: []  # zero new deps — react-markdown + remark-gfm already present (Phase 8)
  patterns:
    - "Provider that always calls hooks unconditionally: outer ChatRailProvider is a thin session-gate that either wraps children in a no-op context or delegates to an inner AuthedChatRailProvider (inner does ALL useState/useEffect work). Keeps React rules-of-hooks happy while the outer API accepts `session: unknown | null`."
    - "SSE frame hand-parser for streaming POST responses. EventSource cannot POST, so we use fetch() → ReadableStream reader + TextDecoder → split on \\n\\n → per-frame key:value lines → JSON.parse(data) → dispatch-by-event. Buffered across chunks so multi-chunk frames work."
    - "Per-frame UUID de-dupe against provider's lastSeenMsgId (D-17). On any frame whose id matches the last seen id, skip; otherwise record id + dispatch."
    - "Auto-expand debounce via useRef<number> timestamp: collapse() records Date.now(); bumpUnread({autoExpand:true}) only flips open→true when >= 500ms have elapsed. Keeps screen-shake (Phase 3 merge event) from stacking animations with a SSE-triggered auto-expand (gotcha #13)."
    - "Rate-limit countdown via setInterval(1s) forceTick — banner re-renders with decrementing seconds without adding countdown state; keyed off rateLimitUntil so interval cleans up when back to 0."
    - "Default context pattern for unauth: createContext(NOOP_DEFAULT) + provider swaps between NOOP_DEFAULT (session=null) and the authed value object. Consumers never throw; sessionAuthed bool signals which mode is active."

key-files:
  created:
    - "dashboard/lib/providers/chat-rail.tsx"
    - "dashboard/lib/providers/chat-rail.test.tsx"
    - "dashboard/components/chat/chat-rail.tsx"
    - "dashboard/components/chat/chat-rail.test.tsx"
    - "dashboard/components/chat/chat-panel.tsx"
    - "dashboard/components/chat/message.tsx"
    - "dashboard/components/chat/suggestions.tsx"
  modified:
    - "dashboard/app/layout.tsx"

key-decisions:
  - "Provider split into outer session-gate + inner AuthedChatRailProvider so hooks are never called conditionally. Plan's reference implementation (single function with early-return before hooks) would violate rules-of-hooks. The gate-and-delegate variant preserves the public API exactly."
  - "NOOP_DEFAULT constant is frozen-object-shape-equal to the authed value. Unauth callers get stable references (setState noops) instead of throwing; matches the plan's direction."
  - "bumpUnread uses functional setOpen to read the latest open state instead of closing over `open`. Plan's reference had `setUnread((u) => (open ? u : u + 1))` which would capture a stale `open` from the render that created the callback. Functional pattern avoids the subtle ordering bug when the same dispatch fires bumpUnread + setOpen near-simultaneously."
  - "Auto-expand inside bumpUnread also clears unread (matches expand() semantics). Deviates slightly from plan in a user-friendly direction: if we're going to visually expand, the user is about to see the messages anyway, so the unread badge is noise."
  - "Toggle closes the rail by setting lastUserCollapseTs = Date.now() — same as manual collapse(). Keeps auto-expand-after-toggle-close consistent with auto-expand-after-direct-collapse for the 500ms debounce."
  - "ChatPanel mount effect gates on rail.currentSessionId presence. On first mount with no session, it POSTs /api/chat/sessions to create one (passes agent:'nexus' default) and seeds current session into the provider. Subsequent remounts inherit the session."
  - "Scope note on ChatPanel: plan did not require a component test for it; the SSE parser is exercised indirectly via the /api/chat/send contract (tested in 09-03) + the ChatRail component test stubs ChatPanel out. A dedicated ChatPanel test would need to mock fetch streaming responses; the return on test complexity vs. the pure data flow didn't clear the bar. Integration coverage lands in Wave 5."
  - "Message bubble format: agent attribution = founder_label (Nexus → 'the conductor') in founder-speak, agent label ('Nexus') in dev-mode. Matches the chatMessageAgentRole(founder, agent) contract already defined in labels.ts."

patterns-established:
  - "Streaming POST response pattern via ReadableStream + manual SSE framer — will be reused by Wave 3's ConfirmActionDialog if it needs to show token-stream previews."
  - "Session-gated provider pattern (outer gate + inner authed provider) — reusable for any future provider whose hooks require `session` to be truthy at mount."
  - "labelFor(dev).chatFoo + ExplainTooltip(text=chatExplainFoo) doubled pattern — every chat-visible string has a founder-speak default AND a dev-mode flip AND an Explain tooltip."

requirements-completed: [CHT-01, CHT-02, CHT-05]
# CHT-03 (9 personas + VOICE.md) is authored on the server side (09-03) — client-side wiring here
# only renders the agent attribution via agentMetaFor; nothing new to complete here.

# Metrics
duration: 8min
completed: 2026-04-22
---

# Phase 9 Plan 05: Chat rail UI + provider + SSE stream consumer Summary

**Persistent right-rail chat shipped: ChatRailProvider (14 tests) + 4 UI components (ChatRail 10 tests, ChatPanel, Message, Suggestions) + layout mount. Clicks expand 48px → 300px, SSE stream hand-parsed with D-17 id de-dupe, unread counter D-09, auto-expand debounce gotcha #13. Zero new runtime deps, 24/24 vitest green, tsc clean, build succeeds with all routes including /api/chat/*.**

## Performance

- **Duration:** ~8.5 min
- **Started:** 2026-04-22T15:25:35Z
- **Completed:** 2026-04-22T15:34:01Z
- **Tasks:** 3 / 3
- **Files created:** 7 (1 provider + 1 provider test, 4 components + 1 component test)
- **Files modified:** 1 (app/layout.tsx — additive only, no existing provider reorder)

## Accomplishments

### Task 1 — ChatRailProvider (TDD, CHT-02)

Red-phase test file landed first with 14 assertions covering:
- initial state (open=false, unread=0, currentSessionId=null, streaming=false, lastSeenMsgId=null, lastMessagePreview="", sessionAuthed=true on authed)
- expand() → open + unread=0
- collapse() → !open (and records lastUserCollapseTs internally)
- toggle() → both directions, opening clears unread
- bumpUnread() — increments when closed, no-op when open
- bumpUnread({autoExpand:true}) — DOES auto-expand when >=500ms since last collapse (vi.useFakeTimers advances 501ms)
- bumpUnread({autoExpand:true}) — SKIPS auto-expand when <500ms since collapse (only 100ms advanced — gotcha #13 honored)
- setLastSeenMsgId / markAllRead / setCurrentSession / setStreaming / setLastMessagePreview
- unauthed (`session=null`) → NOOP_DEFAULT with sessionAuthed=false; all action calls are inert and do NOT throw
- unauthed still renders children (provider wraps but with no-op context)

Green-phase implementation chose the session-gate-delegate-to-inner-authed-provider shape instead of the plan's reference single-function with early-return-before-hooks (which would be a rules-of-hooks violation). Public API shape is unchanged.

### Task 2 — Four chat components + ChatRail test (CHT-01, CHT-05)

- **components/chat/chat-rail.tsx** — 48px collapsed shell (💬 icon + unread dot with 9+ cap + optional message preview) / 300px expanded shell (header with current-agent title + pop-out Link to /chat + close ✕ + ChatPanel body). Hides on /chat (D-16) and when !sessionAuthed (gotcha #10 defense-in-depth over provider default). Click expands; Enter/Space also expand. Close button collapses.
- **components/chat/chat-panel.tsx** — thread + textarea + Suggestions chips + SSE stream consumer. Mount effect creates/loads a session. Enter=send, Shift+Enter=newline. Input disabled while sending OR during rate-limit countdown. Rate-limit banner re-ticks every 1s.
- **components/chat/message.tsx** — single bubble. Assistant content renders through `react-markdown` + `remark-gfm` (no rehype-raw — T-09-05-01 XSS mitigation). User content is plain text + whitespace-preserved. Agent attribution renders founder_label in founder-speak, label in dev-mode. Streaming caret animates at tail of last assistant bubble during the active stream.
- **components/chat/suggestions.tsx** — calls `usePathname()` + `suggestionsFor()` from Wave 0, renders up to 3 chip buttons; click pre-fills + sends via `onPick(message)` callback. Returns `null` when the route has no suggestions.

Component test (10 assertions): collapsed w-12, expanded w-[300px], pathname="/chat" → null, !sessionAuthed → null, unread badge text (3), unread badge cap ("9+"), click expand, click collapse, expanded mounts ChatPanel (stubbed in test), no base-ui polymorphic render-prop.

### Task 3 — Root layout mount

Surgical `app/layout.tsx` edit: added 2 imports (`ChatRailProvider`, `ChatRail`) and wrapped the existing `StatePollProvider` children with `<ChatRailProvider session={session}>`. `<ChatRail />` is mounted AFTER `{children}` (so it overlays, not pushes layout) and is itself session-gated (`{session && <ChatRail />}`) to match the TopNav gating pattern. No changes to the `<html>` / font / ExplainMode / DevMode / StatePoll / Toaster wrapping order.

## ChatRailContextValue Shape (frozen for Wave 4)

```ts
export interface ChatRailContextValue {
  open: boolean;                                    // rail expanded/collapsed
  unread: number;                                   // badge count
  currentSessionId: string | null;                  // active /api/chat/* session uuid
  streaming: boolean;                               // a /send call is in flight
  lastMessagePreview: string;                       // teaser shown when collapsed
  lastSeenMsgId: string | null;                     // cursor for D-17 dedupe
  sessionAuthed: boolean;                           // false if provider mounted without session
  toggle: () => void;
  expand: () => void;
  collapse: () => void;
  setCurrentSession: (id: string | null) => void;
  setLastSeenMsgId: (id: string) => void;
  setLastMessagePreview: (s: string) => void;
  markAllRead: () => void;
  bumpUnread: (opts?: { autoExpand?: boolean }) => void;
  setStreaming: (v: boolean) => void;
}
```

## SSE Frame-Parser Implementation (ChatPanel.send)

ChatPanel opens a fetch() streaming POST (EventSource cannot POST). The response body is pulled via `res.body.getReader()` + TextDecoder. Frames are SSE-shaped: `id: <uuid>\nevent: <name>\ndata: <json>\n\n`. Parser state:

```ts
let buf = "";
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  let idx;
  while ((idx = buf.indexOf("\n\n")) >= 0) {
    const frame = buf.slice(0, idx);
    buf = buf.slice(idx + 2);
    // lines → { id, event, data }
    let id = null, event = null, data = null;
    for (const l of frame.split("\n")) {
      if (l.startsWith("id: ")) id = l.slice(4);
      else if (l.startsWith("event: ")) event = l.slice(7);
      else if (l.startsWith("data: ")) data = l.slice(6);
    }
    if (!event) continue;
    // D-17: skip duplicate frames arriving after reconnect
    if (id && rail.lastSeenMsgId && id === rail.lastSeenMsgId) continue;
    if (id) rail.setLastSeenMsgId(id);
    const obj = data ? JSON.parse(data) : {};
    // dispatch by event:
    //   assistant.begin → setCurrentAgent(obj.agent)
    //   assistant.delta → append obj.delta to last bubble + rail.bumpUnread({autoExpand:true})
    //   assistant.end   → replace bubble with obj.final
    //   rate_limited    → setRateLimitUntil(Date.now() + retry_after_sec*1000)
    //   unread_tick     → rail.bumpUnread()
  }
}
```

Cross-chunk safety: `buf` persists between reader reads so a frame split across two TCP segments reassembles correctly. Malformed `data` JSON is swallowed per-frame (continue) instead of killing the whole stream.

## Layout Provider Order (before → after)

**Before:**

```tsx
<ExplainModeProvider>
  <DevModeProvider>
    <StatePollProvider>
      {session && <TopNav session={session} />}
      {children}
      <Toaster />
    </StatePollProvider>
  </DevModeProvider>
</ExplainModeProvider>
```

**After:**

```tsx
<ExplainModeProvider>
  <DevModeProvider>
    <StatePollProvider>
      <ChatRailProvider session={session}>
        {session && <TopNav session={session} />}
        {children}
        {session && <ChatRail />}
        <Toaster />
      </ChatRailProvider>
    </StatePollProvider>
  </DevModeProvider>
</ExplainModeProvider>
```

`ChatRailProvider` is innermost among the four providers (ExplainMode → DevMode → StatePoll → ChatRail). The order matters because `ChatRail`/`ChatPanel`/`Message`/`Suggestions` call `useDevMode()` + `useExplainMode()` (via `ExplainTooltip`) and those providers must be higher in the tree.

## Task Commits

| Task | Commit    | Type | Description                                                                |
|------|-----------|------|----------------------------------------------------------------------------|
| 1    | `c9b5520` | feat | ChatRailProvider + useChatRail + 14 tests (CHT-02, D-09, D-17, #10, #13)  |
| 2    | `ff537c3` | feat | Chat UI — ChatRail + ChatPanel + Message + Suggestions + 10 tests (CHT-01, CHT-05, D-16, D-17) |
| 3    | `85fbe88` | feat | Mount ChatRailProvider + ChatRail in root layout (D-16, gotcha #10)        |

Each task is a single atomic `feat` commit. TDD tasks (1 and 2) verified RED in-session via the "Failed to resolve import" error; only the GREEN commits are in history.

## Files Created/Modified

- `dashboard/lib/providers/chat-rail.tsx` — 200 LOC. Provider with NOOP_DEFAULT + inner AuthedChatRailProvider + Escape keybind + auto-expand debounce.
- `dashboard/lib/providers/chat-rail.test.tsx` — 180 LOC. 14 vitest assertions across 3 describe blocks.
- `dashboard/components/chat/chat-rail.tsx` — 100 LOC. Collapsed + expanded shells; click + keyboard interaction; z-40 fixed positioning.
- `dashboard/components/chat/chat-rail.test.tsx` — 140 LOC. 10 vitest assertions with next/navigation + provider + ChatPanel mocks.
- `dashboard/components/chat/chat-panel.tsx` — 340 LOC. Session bootstrap, history load, send flow, SSE parser, rate-limit countdown, form + textarea.
- `dashboard/components/chat/message.tsx` — 85 LOC. Single bubble with agent attribution + markdown + streaming caret.
- `dashboard/components/chat/suggestions.tsx` — 55 LOC. Chip buttons from suggestionsFor().
- `dashboard/app/layout.tsx` — +8 lines, −3 lines. Two imports + one JSX wrapper + one JSX mount.

## Decisions Made

- **Outer-gate + inner-authed provider split** for session handling. Plan's reference called hooks after an early-return on `!session` — that's a rules-of-hooks violation in React. My shape always returns `<ChatRailContext.Provider>`, with the *value* swapping between `NOOP_DEFAULT` (session falsy) and a fully-hooked authed state object (session truthy).
- **bumpUnread auto-expand ALSO clears unread** (deviation from literal plan text). If the rail visually expands, the badge would be a stale-state artifact; better to clear.
- **toggle() records lastUserCollapseTs on the close branch.** Keeps the 500ms auto-expand debounce consistent whether the user closed via the close-button (collapse()) or toggle().
- **No standalone ChatPanel component test** this plan — the plan's success criteria only required `chat-rail.test.tsx` + `chat-rail` provider test. ChatPanel's data flow (SSE parser, session bootstrap) would need heavy fetch-streaming mocks; left for Wave 5 integration coverage. Plan did NOT require ChatPanel tests in its success_criteria.
- **Use `usePathname() ?? "/"` fallback** in rail + panel + suggestions. Next 16 typing makes `usePathname()` potentially-null (before hydration or on server-only paths); the fallback avoids a never-taken string-method-on-null path.
- **ChatPanel creates a session on mount** (if none) rather than waiting for the first send. Lets the session picker (Wave 4) show an in-progress session immediately after the rail is first opened.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking issue] Rules-of-hooks violation in plan reference implementation**
- **Found during:** Task 1 RED → GREEN transition (plan reference would crash the test runner with "Rendered more hooks than during the previous render").
- **Issue:** Plan's reference code had `if (!session) return <Provider value={DEFAULT}>...` BEFORE calling `useState`/`useCallback`/`useEffect`. React lint + runtime both reject this.
- **Fix:** Split into outer `ChatRailProvider` (no hooks, branches on session) and inner `AuthedChatRailProvider` (all hooks, unconditional). Public API (`ChatRailProvider` + `useChatRail`) is identical.
- **Files modified:** lib/providers/chat-rail.tsx (created in GREEN phase with fix applied).
- **Commit:** `c9b5520`.

**2. [Rule 3 — Blocking issue] `asChild` literal grep false-positive**
- **Found during:** plan verify step (`! grep -q "asChild"`).
- **Issue:** The ChatRail jsdoc header had a comment "No base-ui asChild anywhere..." that made the raw substring grep match.
- **Fix:** Rephrased the comment to "No base-ui polymorphic render prop (gotcha #5)". Actual `asChild=` prop usage was always zero.
- **Files modified:** components/chat/chat-rail.tsx.
- **Commit:** included in `ff537c3`.

### Scope boundary honored

- Did NOT touch `app/build/changes/**` or `components/changes/**` (09-04's files).
- Did NOT edit `lib/copy/labels.ts` (09-02 Task 3 already added `chat.*` keys, per 09-01 Handoff-1b).
- Did NOT touch `lib/voice-router.ts`, `lib/chat-suggestions.ts`, `lib/chat-cost-estimate.ts` — imported only.
- Did NOT change provider mount order for ExplainMode/DevMode/StatePoll — inserted ChatRailProvider as innermost.

### Transient parallel-execution issues

- **app/build/changes/page.tsx tsc error mid-task.** Parallel plan 09-04 had not yet committed `changes-client.tsx` when I first ran `pnpm tsc --noEmit` after Task 2. Error vanished once 09-04's commit `d509104` landed. None of my files had errors.
- **`pnpm build` "Another next build process is already running".** First attempt collided with 09-04's build; `sleep 15 && pnpm build` succeeded on retry. Documented per the parallel-execution contract in the prompt.

**Total auto-fixes:** 2.
**Impact on plan:** Public API shape unchanged; plan success criteria met.

## Issues Encountered

- **Plan's `sessionAuthed: true` default in interface but `false` in NOOP_DEFAULT.** Worked around by including `sessionAuthed` as a required field (not optional) in the interface; NOOP_DEFAULT sets it to `false` and the authed inner provider sets it to `true`. Test coverage verifies both paths.
- **Vitest CJS deprecation warning.** Pre-existing (Phase 8 note). Noise, not failure.
- **Parallel 09-04 plan mid-execution visible in `git status` + `git log`.** Zero file-ownership conflict per Wave 2 disjoint-file contract. Confirmed by grep: no plan-09-05 files touched by plan-09-04.

## Authentication Gates

None — this plan is pure UI + client provider. All `/api/chat/*` routes (09-03) already carry `auth()` guards; ChatRailProvider gates on session truthiness at mount.

## Verification Results

```bash
pnpm test lib/providers/chat-rail.test.tsx    # 14/14 pass
pnpm test components/chat/chat-rail.test.tsx  # 10/10 pass
pnpm tsc --noEmit                              # exit 0, clean
pnpm build                                     # green — all routes registered including:
                                               #   /api/chat/send, /api/chat/state,
                                               #   /api/chat/sessions, /api/chat/history/[sessionId]
./scripts/lint-no-dollar.sh                    # PASS
```

Plan verify greps (all FOUND):
- `ChatRailProvider` + `useChatRail` + `sessionAuthed` + `lastUserCollapseTs` in `lib/providers/chat-rail.tsx`
- `ChatRail` in `components/chat/chat-rail.tsx`
- `ChatPanel` in `components/chat/chat-panel.tsx`
- `Suggestions` in `components/chat/suggestions.tsx`
- `Message` in `components/chat/message.tsx`
- `/api/chat/send` + `assistant.delta` in `components/chat/chat-panel.tsx`
- `ChatRailProvider` + `import { ChatRail }` + `session={session}` + `session && <ChatRail` in `app/layout.tsx`
- No `asChild=` prop usage anywhere in `components/chat/*.tsx`

## Next Phase Readiness

**Ready for Wave 3 (09-06 — ConfirmActionDialog + gate wiring):**
- `useChatRail()` is stable; any new chat-aware UI can read `currentSessionId` + `streaming`.
- Message rendering / markdown pipeline established — ConfirmActionDialog can render gate preview in the same style.

**Ready for Wave 4 (09-07 — /chat full-page split):**
- `ChatPanel` already accepts `standalone={true}` prop — centers at max-w-800px.
- `ChatRail` component auto-hides on `/chat` via D-16 pathname guard (tested).
- `ChatRailProvider` state shape includes `currentSessionId` so the /chat picker can switch sessions without tearing down the provider.

**Blockers:** None.

## User Setup Required

None — pure UI work. For smoke testing:

1. Sign in via `/signin` (GitHub OAuth).
2. Visit `/build` → rail visible at 48px on the right.
3. Click rail → expands to 300px with ChatPanel body.
4. Type a message + Enter → SSE stream renders tokens into an assistant bubble.
5. Navigate to `/chat` (the 09-07 placeholder route) → rail disappears.
6. Sign out → rail disappears on `/signin` (provider returns NOOP_DEFAULT, sessionAuthed=false).

## Known Stubs

None — all rendered data flows from real API routes (from Wave 1b / 09-03) or from Wave 0 libs. The only "placeholder" string in the source is the HTML `placeholder=""` attribute on the textarea (input affordance, not a data stub).

## Self-Check: PASSED

Verified all claimed artifacts exist and all commits are in the log.

**Files (8):**
- FOUND: dashboard/lib/providers/chat-rail.tsx
- FOUND: dashboard/lib/providers/chat-rail.test.tsx
- FOUND: dashboard/components/chat/chat-rail.tsx
- FOUND: dashboard/components/chat/chat-rail.test.tsx
- FOUND: dashboard/components/chat/chat-panel.tsx
- FOUND: dashboard/components/chat/message.tsx
- FOUND: dashboard/components/chat/suggestions.tsx
- FOUND: dashboard/app/layout.tsx (modified)

**Commits (3):**
- FOUND: c9b5520 (Task 1 — ChatRailProvider + tests)
- FOUND: ff537c3 (Task 2 — 4 components + rail test)
- FOUND: 85fbe88 (Task 3 — layout mount)

**Verification sweeps:**
- `pnpm test lib/providers/chat-rail.test.tsx components/chat/chat-rail.test.tsx` → 24/24 passed
- `pnpm tsc --noEmit` → clean
- `pnpm build` → green, all 4 chat routes + 2 new chat-rail imports compile
- `./scripts/lint-no-dollar.sh` → PASS
- All plan verify greps → passed
- `grep -E 'asChild\s*=|asChild\{' components/chat/*.tsx` → zero matches

---
*Phase: 09-changes-tab-right-rail-chat*
*Completed: 2026-04-22*
