---
phase: 13-ui-ux-review-polish-loop
reviewed: 2026-04-22T22:41:59Z
depth: standard
files_reviewed: 123
files_reviewed_list:
  - dashboard/.cae/logs/.gitkeep
  - dashboard/.gitignore
  - dashboard/app/api/agents/[name]/route.ts
  - dashboard/app/api/agents/route.ts
  - dashboard/app/api/changes/route.ts
  - dashboard/app/api/chat/history/[sessionId]/route.ts
  - dashboard/app/api/chat/send/route.test.ts
  - dashboard/app/api/chat/send/route.ts
  - dashboard/app/api/chat/sessions/route.ts
  - dashboard/app/api/chat/state/route.ts
  - dashboard/app/api/incidents/route.test.ts
  - dashboard/app/api/incidents/route.ts
  - dashboard/app/api/memory/consult/[task_id]/route.ts
  - dashboard/app/api/memory/diff/route.ts
  - dashboard/app/api/memory/file/[...path]/route.ts
  - dashboard/app/api/memory/git-log/[...path]/route.ts
  - dashboard/app/api/memory/graph/route.ts
  - dashboard/app/api/memory/regenerate/route.ts
  - dashboard/app/api/memory/search/route.ts
  - dashboard/app/api/memory/tree/route.ts
  - dashboard/app/api/metrics/route.ts
  - dashboard/app/api/queue/route.ts
  - dashboard/app/api/state/route.ts
  - dashboard/app/api/tail/route.ts
  - dashboard/app/api/telemetry/client-error/route.ts
  - dashboard/app/api/workflows/[slug]/route.ts
  - dashboard/app/api/workflows/[slug]/run/route.ts
  - dashboard/app/api/workflows/route.ts
  - dashboard/app/build/agents/page.tsx
  - dashboard/app/build/changes/page.tsx
  - dashboard/app/build/page.tsx
  - dashboard/app/build/queue/page.tsx
  - dashboard/app/build/queue/queue-card.tsx
  - dashboard/app/build/queue/queue-kanban-client.tsx
  - dashboard/app/build/workflows/page.tsx
  - dashboard/app/build/workflows/workflow-form.tsx
  - dashboard/app/layout.tsx
  - dashboard/app/metrics/metrics-client.tsx
  - dashboard/app/plan/page.tsx
  - dashboard/app/signin/github-sign-in-button.tsx
  - dashboard/app/signin/page.tsx
  - dashboard/components/agents/agent-card.test.tsx
  - dashboard/components/agents/agent-card.tsx
  - dashboard/components/agents/agent-detail-drawer.tsx
  - dashboard/components/agents/agent-grid.tsx
  - dashboard/components/build-home/active-phase-cards.tsx
  - dashboard/components/build-home/live-ops-line.tsx
  - dashboard/components/build-home/needs-you-list.tsx
  - dashboard/components/build-home/recent-ledger.tsx
  - dashboard/components/build-home/rollup-strip.tsx
  - dashboard/components/build-home/sheet-live-log.tsx
  - dashboard/components/build-home/task-detail-sheet.tsx
  - dashboard/components/changes/change-row.tsx
  - dashboard/components/changes/day-group.tsx
  - dashboard/components/changes/dev-mode-detail.tsx
  - dashboard/components/changes/project-group.tsx
  - dashboard/components/chat/chat-panel.tsx
  - dashboard/components/chat/chat-rail.test.tsx
  - dashboard/components/chat/message.tsx
  - dashboard/components/memory/browse/file-tree.test.tsx
  - dashboard/components/memory/browse/file-tree.tsx
  - dashboard/components/memory/graph/graph-filters.tsx
  - dashboard/components/memory/graph/graph-pane.tsx
  - dashboard/components/memory/graph/node-drawer.tsx
  - dashboard/components/memory/why-drawer.tsx
  - dashboard/components/metrics/golden-signals-subtitles.tsx
  - dashboard/components/metrics/metrics-panels-loading.test.tsx
  - dashboard/components/metrics/reliability-panel.tsx
  - dashboard/components/metrics/speed-panel.tsx
  - dashboard/components/metrics/spending-panel.tsx
  - dashboard/components/queue/queue-columns.test.tsx
  - dashboard/components/root-error-boundary.tsx
  - dashboard/components/shell/alert-banner.test.tsx
  - dashboard/components/shell/alert-banner.tsx
  - dashboard/components/shell/ambient-clock.test.tsx
  - dashboard/components/shell/ambient-clock.tsx
  - dashboard/components/shell/cost-ticker.tsx
  - dashboard/components/shell/debug-breadcrumb-panel.test.tsx
  - dashboard/components/shell/debug-breadcrumb-panel.tsx
  - dashboard/components/shell/heartbeat-dot.tsx
  - dashboard/components/shell/incident-stream.test.tsx
  - dashboard/components/shell/incident-stream.tsx
  - dashboard/components/shell/liveness-chip.test.tsx
  - dashboard/components/shell/liveness-chip.tsx
  - dashboard/components/shell/top-nav.test.tsx
  - dashboard/components/shell/top-nav.tsx
  - dashboard/components/tail-panel.tsx
  - dashboard/components/ui/last-updated.test.tsx
  - dashboard/components/ui/last-updated.tsx
  - dashboard/components/ui/panel.test.tsx
  - dashboard/components/ui/panel.tsx
  - dashboard/lib/cae-agents-state.ts
  - dashboard/lib/cae-changes-state.ts
  - dashboard/lib/cae-graph-state.ts
  - dashboard/lib/cae-memory-git.ts
  - dashboard/lib/cae-metrics-state.ts
  - dashboard/lib/cae-workflows.ts
  - dashboard/lib/client-log-bus.test.ts
  - dashboard/lib/client-log-bus.ts
  - dashboard/lib/copy/labels.test.ts
  - dashboard/lib/copy/labels.ts
  - dashboard/lib/hooks/use-command-palette-empty-keys.test.tsx
  - dashboard/lib/hooks/use-command-palette.test.tsx
  - dashboard/lib/hooks/use-command-palette.tsx
  - dashboard/lib/hooks/use-metrics-poll.tsx
  - dashboard/lib/hooks/use-sse-health.test.ts
  - dashboard/lib/hooks/use-sse-health.ts
  - dashboard/lib/hooks/use-state-poll.test.tsx
  - dashboard/lib/hooks/use-state-poll.tsx
  - dashboard/lib/incidents-stream.test.ts
  - dashboard/lib/incidents-stream.ts
  - dashboard/lib/keybindings.test.ts
  - dashboard/lib/keybindings.ts
  - dashboard/lib/log.test.ts
  - dashboard/lib/log.ts
  - dashboard/lib/palette/actions.ts
  - dashboard/lib/palette/index-sources.test.ts
  - dashboard/lib/sse.test.ts
  - dashboard/lib/sse.ts
  - dashboard/lib/with-log.test.ts
  - dashboard/lib/with-log.ts
  - dashboard/next-env.d.ts
  - dashboard/package.json
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues
---

# Phase 13: Code Review Report

**Reviewed:** 2026-04-22T22:41:59Z
**Depth:** standard
**Files Reviewed:** 123
**Status:** issues_found (no P0; 2 P1, 2 P2, 6 P3)

## Summary

Phase 13 shipped 12 plans touching 123 source files — the audit harness, WR-01 SSE
fix, pino structured logging, liveness primitives, MC IA adoptions (ambient clock,
alert banner, Golden Signals, agent verbs), the Incident Stream panel, the shared
`Panel` chrome, and a broad visual 6-pillar refactor. The code quality is
generally high: WR-01 is correctly patched on both server and client, pino
redaction covers `authorization` / `cookie` / `session-token` at every depth that
matters, `/api/memory/*` routes are auth-gated with strict allowlist enforcement,
and the new `incidents-stream.ts` is carefully written to clean up watchers on
abort.

The findings below are concentrated in two themes:

1. **LivenessChip uses a malformed SSE URL** (P1, functional regression). The
   top-nav chip subscribes to `/api/tail` with no `?path=` query, which the
   server rejects with 400. Every authenticated page now runs an infinite
   EventSource retry loop hitting a 400 endpoint, and the user-facing "Live /
   Stale / Offline" label permanently reports **Offline** because the SSE half
   never receives a message.

2. **Incident-stream route is NOT protected by middleware**, despite a docstring
   claim to the contrary (P1, security hygiene). The same applies to five other
   `/api/*` routes that phase 13 touched while wrapping them with `withLog` —
   those gaps are pre-existing (not regressions), but plan 13-05 was the
   ideal moment to close them and it did not.

The remaining items are minor (duplicate SSE connections in tail-panel /
sheet-live-log, hydration risk in `AmbientClock`, a stale JSDoc comment, etc.).

Phase 13's user-facing security priorities all verify clean:

- **Pino redaction**: `*.authorization`, `*.cookie`, and `*.headers.*`
  variants redact as specified; tests in `lib/log.test.ts` cover both.
- **Client error bridge sanitization**: only five named string fields are
  extracted from the request body (`message`, `stack`, `url`, `userAgent`,
  `componentStack`); no arbitrary properties leak into pino.
- **Incident Stream SSE filters level >= warn**: `filterLevel("warn")` in
  `lib/incidents-stream.ts` correctly drops debug/info lines. Secrets that
  reach pino are redacted before they reach the JSONL file.
- **`/api/memory/regenerate`**: authed (`await auth()` + unauthorized() at
  line 24).
- **WR-01 fix has no regression in the chat unread counter**: server only
  emits `id` on `assistant.begin` / `assistant.end`; client only promotes
  `lastSeenMsgId` on `assistant.end` with non-null id; deltas still drive
  `rail.bumpUnread()` unchanged.

## Warnings

### WR-01 [P1]: LivenessChip always reports Offline — malformed SSE URL

**File:** `components/shell/liveness-chip.tsx:40`
**Issue:** The chip subscribes to `useSseHealth("/api/tail")` with no `?path=`
query parameter. `/api/tail/route.ts:42-44` rejects that with `return new
Response("Missing path", { status: 400 })`. `EventSource` interprets HTTP 400
as a transport error → `onerror` fires → hook sets `status:"closed"` and
`lastMessageAt` stays null. `classify(null, 30_000)` returns `"dead"`, so
`worst(stateFreshness, "dead") === "dead"`, and the pill label is permanently
`"Offline"`.

Two knock-on effects:

1. The feature ships a lie: a chip whose purpose is "honest liveness
   aggregation" is structurally incapable of ever reporting `"Live"`.
2. The browser's EventSource retries on error with a default backoff —
   every authed page now generates a constant stream of 400 responses
   from `/api/tail` (one per mounted LivenessChip, which is global via
   `top-nav`).

**Fix:** Either (a) point the chip at a real, always-on SSE endpoint such
as `/api/incidents`, or (b) add a dedicated `/api/heartbeat` SSE that
emits a keep-alive every N seconds without requiring a file path:

```tsx
// Option (a) — cheapest; /api/incidents always streams on this single-user app
const tail = useSseHealth("/api/incidents");

// Option (b) — new endpoint; more honest semantically
// app/api/heartbeat/route.ts emits `:\n\n` ping every 10s
const tail = useSseHealth("/api/heartbeat");
```

Also add a guard in `useSseHealth` so an empty-string path short-circuits
without constructing an EventSource (`sheet-live-log.tsx` can pass `""`):

```ts
export function useSseHealth(path: string): SseHealthState {
  const [state, setState] = useState<SseHealthState>({
    lastMessageAt: null,
    status: path ? "connecting" : "closed",
  });
  useEffect(() => {
    if (!path) return;
    const es = new EventSource(path);
    // ...
  }, [path]);
  return state;
}
```

### WR-02 [P1]: `/api/incidents` docstring falsely claims middleware auth

**File:** `app/api/incidents/route.ts:22`
**Issue:** The route header comment reads:

> Security (T-13-08-01):
>   - Protected by Next.js middleware (/api/* requires auth session)

This is not true. `middleware.ts:13-23` declares a **specific** matcher list
(`/api/tail`, `/api/state`, plus `/plan/**`, `/build/**`, `/memory`,
`/metrics`, `/floor/**`) — it does NOT match all `/api/*`. The route has no
in-handler `await auth()` check either. Anyone with network access to the
dashboard can `GET /api/incidents` and receive a full SSE feed of every
warn+/error log line, including any PII that has survived pino redaction
(client error messages, stack traces, filesystem paths, etc.).

Same gap applies (pre-existing, not a phase-13 regression, but touched by
plan 13-05's `withLog` rewrap):

- `GET /api/agents` and `GET /api/agents/[name]` — no auth
- `GET /api/queue` — no auth
- `GET /api/metrics` — no auth
- `GET /api/workflows` — no auth
- `POST /api/workflows` — no auth (**writes** workflow YAML to disk via
  `writeWorkflow`); worst offender
- `PUT /api/workflows/[slug]` — no auth (overwrites existing workflow)
- `DELETE /api/workflows/[slug]` — no auth (unlinks workflow from disk)
- `POST /api/telemetry/client-error` — intentional, documented, acceptable
  for single-user; flagged here only for completeness

**Fix:** Either tighten the middleware matcher, or add `await auth()` at the
top of each handler. Middleware is less surgical (can't distinguish SSE vs
normal routes, affects redirect targets), so prefer in-handler:

```ts
// app/api/incidents/route.ts
async function handler(req: Request) {
  const session = await auth();
  if (!session) {
    return new Response("unauthorized", { status: 401 });
  }
  // ... existing body
}
```

Also correct the docstring so future readers don't trust a false security
claim:

```ts
 * Security (T-13-08-01):
 *   - Requires authenticated session (await auth() at top of handler)
 *   - pino.redact (plan 13-05) removes auth/session/password before writing
 *   - No user query params; no path traversal risk
```

### WR-03 [P2]: Duplicate SSE connections in `TailPanel` and `SheetLiveLog`

**Files:** `components/tail-panel.tsx:40,43`, `components/build-home/sheet-live-log.tsx:27,42`
**Issue:** Both components open a `new EventSource(sseUrl)` for the data feed
AND call `useSseHealth(sseUrl)`, which internally opens a **second**
EventSource to the same URL. Result: every mounted tail panel runs two
independent SSE connections to `/api/tail`, doubling file-watch cost on the
server and doubling inbound bandwidth on the client. For a single-user app
the absolute cost is negligible, but the code is wrong — `useSseHealth`
should piggy-back on the existing stream, not open a new one.

**Fix:** Change `useSseHealth` to accept an optional pre-existing
EventSource, or derive liveness from a caller-supplied `lastMessageAt`
setter the consumer already maintains. Example refactor:

```ts
// New API: caller drives lastMessageAt themselves on their ONE stream.
export function useSseHealthForStream(
  es: EventSource | null,
): SseHealthState {
  const [state, setState] = useState<SseHealthState>({
    lastMessageAt: null,
    status: "connecting",
  });
  useEffect(() => {
    if (!es) return;
    const onOpen = () => setState((s) => ({ ...s, status: "open" }));
    const onMsg = () => setState((s) => ({ ...s, lastMessageAt: Date.now() }));
    const onErr = () => setState((s) => ({ ...s, status: "closed" }));
    es.addEventListener("open", onOpen);
    es.addEventListener("message", onMsg);
    es.addEventListener("error", onErr);
    return () => {
      es.removeEventListener("open", onOpen);
      es.removeEventListener("message", onMsg);
      es.removeEventListener("error", onErr);
    };
  }, [es]);
  return state;
}
```

Callers then create one EventSource with `useRef<EventSource>` and pass it
in. `LivenessChip` (which is a standalone consumer with no other stream)
can stay on `useSseHealth(path)`.

### WR-04 [P2]: `redact` path `*.authjs\\.session-token` likely a no-op

**File:** `lib/log.ts:63`
**Issue:** pino-redact uses dot as a segment separator in its glob paths.
The entry `"*.authjs\\.session-token"` is intended to match a literal key
`"authjs.session-token"` (the default NextAuth cookie name), but pino
interprets `\.` as an escape inside a string and then sees `authjs.session-
token` as `authjs` → `session-token`, not `"authjs.session-token"`.

The redact spec for a key that contains a literal `.` in pino is bracket
notation:

```ts
paths: ['*["authjs.session-token"]']
```

In practice this is **not** exploitable today because anything carrying
the session cookie flows through the `cookie` header, which IS redacted
via `*.cookie` and `*.headers.cookie`. But the intent expressed by the
line is misleading — a future log call that writes `{ authjs: { "session-
token": "..." } }` as a **nested** object (instead of a flat header) will
silently leak.

**Fix:**

```ts
const REDACT_PATHS = [
  "*.authorization",
  "*.cookie",
  "*.headers.authorization",
  "*.headers.cookie",
  "*.password",
  "*.token",
  "*.apiKey",
  "*.api_key",
  '*["authjs.session-token"]',
  '*.headers["authjs.session-token"]',
];
```

Add a test for the bracket form so the intent is pinned:

```ts
it("redacts nested authjs.session-token key with dot in name", async () => {
  const { log } = await import("@/lib/log");
  log("t").info({ cookies: { "authjs.session-token": "abc" } }, "x");
  const obj = lastLine();
  const c = obj.cookies as Record<string, unknown>;
  expect(c["authjs.session-token"]).toBe("[redacted]");
});
```

## Info

### IN-01 [P3]: `AmbientClock` reads `matchMedia` at render time (hydration race)

**File:** `components/shell/ambient-clock.tsx:35-38`
**Issue:** `getReducedMotion()` returns `false` during SSR (no `window`), but
may return `true` on client. The same render also computes `fmt(new Date(),
reduceMotion)` — so the server renders `HH:mm:ss` with server-side wall
time, and the client hydrates with `HH:mm` (or different seconds). React
will emit a hydration-mismatch warning for the `<span>` text. The `<body
suppressHydrationWarning>` in `app/layout.tsx:46` only applies to the body
itself, not descendants.

**Fix:** Render a stable placeholder on first paint, then upgrade after
mount:

```tsx
export function AmbientClock() {
  const [mounted, setMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [time, setTime] = useState<string>("--:--:--");

  useEffect(() => {
    const rm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    setReduceMotion(rm);
    setTime(fmt(new Date(), rm));
    setMounted(true);
    const intervalMs = rm ? 60_000 : 1_000;
    const id = setInterval(() => setTime(fmt(new Date(), rm)), intervalMs);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className="font-mono text-[10px] ..."
      aria-label={mounted ? `Local time ${time.slice(0, 5)}` : "Local time loading"}
      data-testid="ambient-clock"
      suppressHydrationWarning
    >
      {time}
    </span>
  );
}
```

### IN-02 [P3]: `DebugBreadcrumbPanel` crashes on empty `level` string

**File:** `components/shell/debug-breadcrumb-panel.tsx:41-42`
**Issue:** `levelLabel(level)` does `level[0].toUpperCase()`. If a caller
ever passes `clientLog("" as ClientLogLevel, ...)` the access `level[0]`
is `undefined` and `.toUpperCase()` throws. Types prevent this today (the
union is `"debug" | "info" | "warn" | "error"`) but a `cae:log` CustomEvent
dispatched by external code — or a future test — could sneak through.

**Fix:**

```ts
function levelLabel(level: string): string {
  return level.length > 0 ? level[0].toUpperCase() : "?";
}
```

### IN-03 [P3]: `StatePollProvider` keeps polling `/api/state` on `/signin`

**File:** `app/layout.tsx:52`, `lib/hooks/use-state-poll.tsx`
**Issue:** The provider is mounted unconditionally in the root layout while
`<TopNav />`, `<AlertBanner />`, etc. are wrapped in `{session && …}`. On
the `/signin` route the provider still fires `fetch("/api/state?…")` every
3s. Middleware (`middleware.ts:22`) matches `/api/state` and redirects
unauthed callers to `/signin` — so `res.ok` is false and `setError(...)` is
called every 3s. Not a security issue, but it is wasted network and a
constant flicker in DevTools.

**Fix:** Either gate the provider on `session` (move the `{session && …}`
above it), or early-return in `poll()` when `document.pathname` starts with
`/signin`. The simpler fix is the conditional mount, though it requires
re-checking that `useStatePoll` is never called from unauthed pages.

### IN-04 [P3]: `withLog` logs full `req.url` including query string

**File:** `lib/with-log.ts:50`
**Issue:** Every request emits `req.begin` with `{ method, url, reqId }`
where `url` is the raw `req.url`. Query strings are included verbatim.
Today the dashboard does not put secrets in query strings, but OAuth
callback URLs, future PAT-in-URL patterns, or third-party webhook
forwarders often do — and a secret in a query string would be logged to
`.cae/logs/dashboard.log.jsonl` *and* streamed out through
`/api/incidents`.

**Fix:** Strip the query string, or log path + known-safe query keys only:

```ts
const u = new URL(req.url, "http://localhost");
l.info({ method: req.method, path: u.pathname, reqId }, "req.begin");
```

If the full URL is genuinely needed, add a per-route allowlist of query
keys that may be logged.

### IN-05 [P3]: `client-error` route has no size guard

**File:** `app/api/telemetry/client-error/route.ts:22`
**Issue:** The handler's own docstring notes "No size limit beyond Next.js
default 1MB bodyParser limit (single-user app)". 1MB of stack trace per
client error is excessive. Because the route is intentionally unauthed
(window.onerror fires before login), a misbehaving or malicious client on
the network could fill `dashboard.log.jsonl` with ~1MB entries at will,
and each one is then fan-out streamed to every connected `/api/incidents`
subscriber. In a single-user app the blast radius is "your own disk" but
for defense-in-depth:

**Fix:**

```ts
const MAX_FIELD = 8_000; // characters
function trunc(s: unknown): string | undefined {
  if (typeof s !== "string") return undefined;
  return s.length > MAX_FIELD ? s.slice(0, MAX_FIELD) + "…[truncated]" : s;
}

async function postHandler(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    message?: string; stack?: string; url?: string;
    userAgent?: string; componentStack?: string;
  };
  log("client.error").error({
    clientMsg: trunc(body.message) ?? "(no message)",
    stack: trunc(body.stack),
    clientUrl: trunc(body.url),
    userAgent: trunc(body.userAgent),
    componentStack: trunc(body.componentStack),
  }, "client.error.reported");
  return NextResponse.json({ ok: true });
}
```

Consider rate-limiting the route (e.g., 10 requests / 5 min / IP) if
you're ever running on a network the user doesn't fully control.

### IN-06 [P3]: Remaining client-side `console.*` calls not converted

**Files:**
- `app/build/agents/page.tsx:38`
- `lib/hooks/use-command-palette.tsx:36,51`
- `lib/palette/actions.ts:100`
- `components/agents/model-override.tsx:47`
- `lib/hooks/use-shortcut-overlay.tsx:36`
- `lib/hooks/use-floor-events.tsx:166`
- `lib/palette/build-index.ts:55`
- `components/build-home/task-detail-sheet.tsx:63,71`

**Issue:** Plan 13-05 claimed "convert 35 console.* sites to scoped logger"
but the above client-side sites still use `console.warn` / `console.error`
/ `console.info` directly. Most are unreachable by pino (they run in the
browser, where `lib/log.ts` cannot be imported anyway) so this is not a
bug, just a claim that doesn't match the code. If you want client logs to
land server-side, route them through `clientLog(...)` from
`lib/client-log-bus.ts`, which triggers the `'cae:log'` CustomEvent and
the ClientErrorBridge POST.

**Fix:** For each site, decide: (a) keep the `console.*` and update the
plan-05 claim, or (b) replace with `clientLog("warn", "palette", msg,
ctx)`. Suggest (b) for at least `lib/hooks/use-command-palette.tsx` and
`lib/palette/build-index.ts`, since those run in dev hot-paths where a
dev-mode consumer actually watches breadcrumbs.

---

_Reviewed: 2026-04-22T22:41:59Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
