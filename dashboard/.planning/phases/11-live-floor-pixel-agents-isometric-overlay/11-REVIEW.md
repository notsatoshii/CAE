---
phase: 11-live-floor-pixel-agents-isometric-overlay
reviewed: 2026-04-22T18:47:34Z
depth: deep
files_reviewed: 18
files_reviewed_list:
  - middleware.ts
  - app/floor/page.tsx
  - app/floor/layout.tsx
  - app/floor/popout/page.tsx
  - components/floor/floor-canvas.tsx
  - components/floor/floor-client.tsx
  - components/floor/floor-toolbar.tsx
  - components/floor/floor-legend.tsx
  - components/floor/floor-popout-host.tsx
  - components/shell/floor-icon.tsx
  - components/shell/top-nav.tsx
  - lib/floor/cb-path.ts
  - lib/floor/event-adapter.ts
  - lib/floor/iso.ts
  - lib/floor/renderer.ts
  - lib/floor/scene.ts
  - lib/floor/state.ts
  - lib/hooks/use-floor-events.tsx
  - lib/hooks/use-prefers-reduced-motion.ts
  - lib/copy/labels.ts
findings:
  critical: 3
  warning: 5
  info: 5
  total: 13
status: issues_found
---

# Phase 11: Code Review Report — Live Floor (Pixel Agents / Isometric Overlay)

**Reviewed:** 2026-04-22T18:47:34Z
**Depth:** deep
**Files Reviewed:** 19 source files + cross-referenced /api/tail, /api/state, app/build/page.tsx, next.config.ts
**Status:** issues_found
**Commit range:** 914e6e5..HEAD (phase-11 slice)

## Summary

Phase 11 ships a Canvas 2D isometric "CAE HQ" floor plan fed by SSE off `/api/tail`. Architecture is clean: pure `iso.ts` / `renderer.ts` / `state.ts` / `scene.ts` modules with no React/DOM coupling, SSE+queue+caps contained in `useFloorEvents`, RAF loop owned by `FloorCanvas`, and an event allowlist + JSON size cap that properly defends against malformed `.jsonl` lines. Founder/dev copy path correctly routes through `labelFor()`, and reduced-motion is honored at mapEvent time (defense-in-depth vs. CSS-only).

However, the review found **three P0 bugs** that block shipping to users, and **two additional P0/P1 issues** that neutralize the security posture the feature claims:

1. **`/floor` + `/floor/popout` server pages will throw at runtime on Next 16.** `searchParams` is typed as a plain object and read synchronously. Every peer page in the codebase (e.g. `app/build/page.tsx:14-18`) types it as `Promise<…>` and `await`s it. This is a regression test gap: the tests pass plain-object `searchParams` and never exercise the Next 16 async signature. **The `/floor` route is currently broken.**

2. **Auth-drift probe (T-11-05) is silently dead code.** `/api/state` does not call `auth()` — it returns `Response.json(...)` unconditionally — so `res.status === 401` in `useFloorEvents` can never be true. The re-auth banner (`floorAuthDriftNotice`) is never shown. The plan ("auth-gated identically to /api/tail") assumed both routes were `auth()`-gated; neither actually is.

3. **`/api/tail` + `/api/state` are NOT authenticated.** The `middleware.ts` matcher was extended to cover `/floor` (commit a381a6b) but does not match `/api` paths, and neither route file calls `auth()` inline. Any unauthenticated request on the same origin can subscribe to the SSE stream and read `.cae/metrics/circuit-breakers.jsonl` contents (project metrics, tokens, sentinel events, escalations). This predates Phase 11 but Phase 11 is the first consumer with a visible on-screen reveal + a UI promise of re-auth that can't fire; the feature explicitly depends on this being fixed.

Quality-of-code is otherwise strong: pure modules are well-factored, effect TTLs are centralized, the event allowlist is tight, `parseEvent` never spreads parsed payload, and the renderer never throws.

---

## Critical Issues (P0)

### CR-01 [P0]: `/floor` server page breaks on Next 16 — `searchParams` not awaited

**File:** `app/floor/page.tsx:23-57`
**Also:** `app/floor/popout/page.tsx:22-55`
**Issue:** Both pages declare `searchParams: { project?: string; popout?: string }` as a synchronous object and read `searchParams.project` / `searchParams.popout` directly. In Next 15+ / 16 (confirmed `next: ^16.2.4` in `package.json:23`), `searchParams` is a `Promise` and must be awaited. Every other page in the codebase follows the async pattern (e.g. `app/build/page.tsx:13-18`, `app/build/phase/[num]/page.tsx:15-20`). At runtime, accessing `.project` on a promise returns `undefined` silently on the first render and triggers the Next dynamic-API warning / sync-dynamic-api error (Next 16 upgraded this to a thrown error per their migration guide). Consequence: the most-recent-Shift-project fallback always fires even when a `?project=` query is supplied, **and on Next 16.x the page fails outright.**

The test suite doesn't catch this because the tests pass a plain-object `searchParams` (`page.test.tsx:62`, `72`, `86`, etc.), mimicking the broken signature.

**Fix:**
```ts
// app/floor/page.tsx
interface PageProps {
  searchParams: Promise<{ project?: string; popout?: string }>;
}

export default async function FloorPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/signin?from=/floor");

  const { project, popout: popoutParam } = await searchParams;
  // ... use `project` and `popoutParam` below
  const popout = popoutParam === "1";
  // ...
}
```
Apply the identical shape to `app/floor/popout/page.tsx`. Update both `page.test.tsx` files to pass `searchParams: Promise.resolve({...})` so the typing matches production.

---

### CR-02 [P0]: Auth-drift probe cannot detect drift — `/api/state` never returns 401

**File:** `lib/hooks/use-floor-events.tsx:161-191`
**Also:** `app/api/state/route.ts:16-94` (referenced, unchanged in P11)
**Issue:** The probe's correctness depends on `/api/state` being auth-gated:

```ts
if (res.status === 401) {
  setAuthDrifted(true);
} else if (res.ok) {
  setAuthDrifted(false);
}
```

But `app/api/state/route.ts` contains zero `auth()` calls and is not matched by `middleware.ts`. The route is reachable by anyone on the origin and always returns `200 OK` (or 5xx on internal error). So `setAuthDrifted(true)` is unreachable. The `floorAuthDriftNotice` re-auth banner (`floor-toolbar.tsx:148-155`) is dead UI. The SESSION_RESUME / plan claim that the probe "polls /api/state every 30s" for auth drift is not fulfilled.

Secondary bug: even if `/api/state` were auth-gated, the **first** probe doesn't run for 30 seconds after mount (only `setInterval(probe, AUTH_POLL_MS)`, no initial invocation). A user arriving at `/floor` with an already-expired session sees no banner for 30s.

**Fix (depends on CR-03 for full correctness):**
1. Auth-gate `/api/state` (and `/api/tail` — see CR-03) so that 401 is reachable.
2. In the hook, run `probe()` once immediately on mount:
   ```ts
   // lib/hooks/use-floor-events.tsx (around line 184)
   probe();  // initial check
   const id = setInterval(probe, AUTH_POLL_MS);
   ```
3. Consider probing a cheaper auth-check endpoint (e.g. a dedicated `/api/auth/ping` returning 204 vs 401) instead of re-fetching the full `/api/state` payload every 30s per active floor tab. `/api/state` reads 4–5 JSONL tails + `listProjects()` every 30s — wasteful.

---

### CR-03 [P0]: `/api/tail` SSE + `/api/state` JSON are not authenticated

**File:** `middleware.ts:13-15`
**Also:** `app/api/tail/route.ts:37-74`, `app/api/state/route.ts:16`
**Issue:** The middleware matcher is:
```ts
matcher: ["/plan/:path*", "/build/:path*", "/memory", "/metrics", "/floor", "/floor/:path*"],
```
It does NOT include `/api/tail` or `/api/state`, and neither route calls `auth()` directly. Any unauthenticated client that can reach the origin can:

- `GET /api/tail?path=<project>/.cae/metrics/circuit-breakers.jsonl` and stream live forge events, token counts, sentinel failures, phantom escalations, and halts for any project under `computeAllowedRoots()` (every Shift/Phantom project registered in `listProjects()`).
- `GET /api/state?project=…` and read the full dashboard snapshot: circuit breakers, inbox, outbox, token totals, and the last 50–200 metric entries.

This is pre-existing infra (pre-phase-11), but Phase 11 is the first feature that depends on it being gated (see CR-02) and the first that exposes the data over a long-lived SSE connection from any browser tab. The `/api/tail` inline comment at page.tsx:39 says "/api/tail enforces ALLOWED_ROOTS (T-11-04)" — ALLOWED_ROOTS prevents path-traversal out of the project tree, but it does NOT gate **who** can listen.

Exploit scenario: any webpage the user loads in the same browser can `fetch('/api/state', { credentials: 'omit' })` cross-tab since there's no session check, harvesting project telemetry. (For dev: `allowedDevOrigins: ["165.245.186.254"]` in `next.config.ts` doesn't gate anything at runtime — that's a CORS-for-dev knob.)

**Fix:** Extend the middleware matcher to cover the two API routes:
```ts
// middleware.ts
export const config = {
  matcher: [
    "/plan/:path*",
    "/build/:path*",
    "/memory",
    "/metrics",
    "/floor",
    "/floor/:path*",
    "/api/tail",        // <-- add
    "/api/state",       // <-- add
    // Consider a blanket "/api/:path*" with an explicit allowlist of public routes
    // (/api/signin, /api/health) to close this class of bug project-wide.
  ],
};
```
Alternative: add `const session = await auth(); if (!session) return new Response("Unauthorized", { status: 401 });` at the top of each route. Middleware is preferred — one place, one policy.

After fix, add a regression test: `curl -o- http://localhost:3000/api/tail?path=/tmp/anything` from a no-cookie client must return 401, not 403 or 200.

---

## Warnings (P1–P2)

### WR-01 [P1]: `EventSource` has no `onerror` handler — silent failures + unbounded reconnect

**File:** `lib/hooks/use-floor-events.tsx:135-159`
**Issue:** After `new EventSource(...)`, only `onmessage` is wired. The browser's default behavior is to silently auto-reconnect every ~3 seconds on network drops *forever*. If the server returns an HTTP error on handshake (e.g. `403` once ALLOWED_ROOTS tightens, or `401` after CR-03 fix), the EventSource fires `error` then closes — we'd never know and can't surface it to the user. Right now there's nothing in the UI that tells the user "live feed lost."

Related: once CR-03 is fixed, unauthenticated reconnect attempts will hammer the server with 401s on a 3s cadence per browser tab.

**Fix:**
```ts
es.onerror = () => {
  // EventSource.readyState: 0 connecting, 1 open, 2 closed
  if (es.readyState === EventSource.CLOSED) {
    // Treat as auth drift if status code was 401 (browser doesn't expose it,
    // so probe /api/state to distinguish auth from transient network)
    void fetch("/api/state?project=" + encodeURIComponent(projectPath))
      .then((r) => { if (r.status === 401) setAuthDrifted(true); })
      .catch(() => { /* network — ignore */ });
  }
};
```
At minimum: log a console.warn on error, set an internal `connectionHealthy=false` state, and surface it in the dev-mode debug strip.

---

### WR-02 [P1]: Missing `noopener,noreferrer` on `window.open` (accepted trade-off — document explicitly)

**File:** `components/floor/floor-toolbar.tsx:63-68`
**Issue:** `window.open("/floor/popout?…", "cae-live-floor", "width=960,height=720")` opens a same-origin popup without `noopener`. This is intentional: the pop-out window needs `window.opener` for the return-to-main button (`floor-client.tsx:60, 70-71`) and Escape-to-close (`floor-popout-host.tsx:59-64`).

Risk window is small (same-origin, session-authenticated) but non-zero: if `/floor/popout` ever loads third-party iframes, scripts, or navigates to a different origin, that new origin gets `window.opener` access back to the main tab. This also couples with WR-05 (no X-Frame-Options) — a malicious embed could reach the opener.

**Fix:** Either (a) document the trade-off in a code comment and ensure `/floor/popout` never navigates cross-origin or loads third-party scripts, OR (b) replace the opener reliance with `BroadcastChannel` / `localStorage` event for close coordination:
```ts
// Option (b) — eliminates the opener dependency entirely
// In floor-toolbar.tsx:
window.open(url, "cae-live-floor", "width=960,height=720,noopener,noreferrer");

// In floor-client.tsx returnToMain():
const bc = new BroadcastChannel("cae-floor-popout");
bc.postMessage({ type: "focus-main" });
window.close();

// Main tab in app/layout.tsx (or a provider) listens and calls window.focus().
```
If keeping the current approach, add a comment at line 63 making the trade-off explicit so future contributors don't "fix" it by adding noopener and silently breaking return-to-main.

---

### WR-03 [P1]: Drift probe uses fragile string `.replace` to reverse cbPath → projectPath

**File:** `lib/hooks/use-floor-events.tsx:170-172`
**Issue:**
```ts
const projectPath = cbPath.replace("/.cae/metrics/circuit-breakers.jsonl", "");
```
This works today because `resolveCbPath` appends exactly that suffix, but:
1. If any `cbPath` ever contains the suffix mid-string (unlikely but not impossible on a project named `…/.cae/metrics/circuit-breakers.jsonl-backup/actual-project`), `replace` mutates the middle.
2. It's a hidden coupling that future refactors of `cb-path.ts` can silently break.

**Fix:** Either thread `projectPath` through `UseFloorEventsOpts` instead of re-deriving, or use a suffix-anchored strip:
```ts
const SUFFIX = "/.cae/metrics/circuit-breakers.jsonl";
const projectPath = cbPath.endsWith(SUFFIX)
  ? cbPath.slice(0, -SUFFIX.length)
  : cbPath;
```
Preferred: add `projectPath: string | null` to `UseFloorEventsOpts` and skip derivation altogether (`FloorCanvas` already receives it and can forward).

---

### WR-04 [P2]: `lastEventTs` is dead API surface — update-per-event re-renders with no consumer

**File:** `lib/hooks/use-floor-events.tsx:63, 97, 117, 193`
**Issue:** `lastEventTs` is declared in `UseFloorEventsResult`, set via `setLastEventTs(Date.now())` once per drained event (inside a while-loop over up to 500 queued events), and is not consumed by any component (verified via grep across `components/floor/` and `lib/hooks/`). Each `setLastEventTs` schedules a React re-render of `FloorCanvas` and its `onMetrics` chain, even though no UI reads the value. With QUEUE_CAP=500, a paused→unpaused flush can schedule hundreds of redundant state updates.

**Fix:** Drop it. Remove the `lastEventTs` state + setter + result field. If a future feature needs it, expose it via a ref (`lastEventTsRef`) instead of state to decouple from React's render cycle:
```ts
// Delete these lines:
// const [lastEventTs, setLastEventTs] = useState<number | null>(null);
// setLastEventTs(Date.now());
// lastEventTs: number | null;  (from UseFloorEventsResult)

// And from the return statement:
return { effectsCount, queueSize, authDrifted };
```

---

### WR-05 [P2]: No `X-Frame-Options` / CSP `frame-ancestors` — `/floor/popout` is clickjackable

**File:** `next.config.ts:3-6` (no `headers()` block)
**Also:** `app/floor/popout/page.tsx` inherits the gap
**Issue:** The dedicated pop-out route has:
- A session-authenticated SSE stream with live telemetry
- An Escape-to-close handler bound to `window.close()`
- A same-origin `window.opener` reference

No response headers prevent a malicious site from iframing `https://<host>/floor/popout` and overlaying invisible click targets on the controls (pause, minimize, close). Clickjacking on the return-to-main button is harmless, but on pause + minimize it could be used to mask the live floor from an observant user while exfiltration happens elsewhere in the session.

This is a global gap (applies to all app routes), not specific to Phase 11, but `/floor/popout` is the first route shipped that is explicitly intended to live in its own window and carries auth-sensitive live data.

**Fix:** Add a top-level `headers()` in `next.config.ts`:
```ts
const nextConfig: NextConfig = {
  allowedDevOrigins: ["165.245.186.254"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};
```
If any admin route genuinely needs to be framed (unlikely), use a per-route override with `source: "/floor/popout"` set to `DENY` and loosen elsewhere explicitly.

---

## Info (P3)

### IN-01 [P3]: Double-ref indirection (`sceneRefRef.current.current`) is hard to read

**File:** `lib/hooks/use-floor-events.tsx:86-89, 102, 119`
**Issue:** `const sceneRefRef = useRef(opts.sceneRef)` + `useEffect(() => { sceneRefRef.current = opts.sceneRef; })` (no deps) is a ref-of-ref pattern that adds a mental hop (`sceneRefRef.current.current.effects`) with no benefit — `opts.sceneRef` is already stable (the caller passes `useRef(createScene())`). The `useEffect` without a dep array runs on every render.
**Fix:** Store `opts.sceneRef` directly in a local variable inside each effect/callback, e.g.:
```ts
const drain = useCallback(() => {
  const scene = opts.sceneRef.current;
  // ...
}, [opts.sceneRef]);
```
Or, since the caller already guarantees ref stability, drop the wrapper entirely and destructure `sceneRef` at the top of the hook.

---

### IN-02 [P3]: RAF loop resets `lastTs` on every viewport change, causing a one-frame dt spike

**File:** `components/floor/floor-canvas.tsx:107-140`
**Issue:** The RAF effect has `[paused, viewport]` in its dep array. Every resize event triggers a new `viewport` object (new object identity even when dimensions equal, from the `setViewport((prev) => ({ ... }))` in the ResizeObserver), tearing down and restarting the RAF loop. On restart, `lastTs = performance.now()` — so the first tick after restart gets `dt = (ts - lastTs) / 1000 ≈ 0` or negative. `Math.min(dt, 0.1)` clamps the upper bound but not the lower, so a negative dt would run `effect.ttl -= dt` in reverse, briefly extending effect lifetimes by one frame. Visually unnoticeable at 60fps (<16ms) but theoretically incorrect.
**Fix:**
```ts
if (!paused) {
  const dt = Math.min(Math.max((ts - lastTs) / 1000, 0), 0.1);
  lastTs = ts;
  step(sceneRef.current, dt);
  render(safeCtx, sceneRef.current, viewport);
}
```
Better: memoize viewport by value-equality in ResizeObserver (skip the `setState` when w/h/cx/cy unchanged) to avoid the spurious RAF restarts entirely.

---

### IN-03 [P3]: `aria-hidden` on top-nav never restored on unmount

**File:** `components/floor/floor-popout-host.tsx:43-46`
**Issue:** The first effect sets `topNav.setAttribute("aria-hidden", "true")` but the cleanup at line 49-51 only restores `document.title`. If a user client-side-navigates from `/floor/popout` to another route without closing the window (e.g. via a link we add later), the top-nav stays aria-hidden on the next route. Not an issue today because `/floor/popout` has no outbound links and Escape closes the window, but it's a latent cleanup gap.
**Fix:**
```ts
return () => {
  document.title = prevTitle;
  const topNav = document.querySelector('[data-testid="top-nav"]');
  if (topNav) topNav.removeAttribute("aria-hidden");
};
```

---

### IN-04 [P3]: Drift probe doesn't distinguish "offline/network" from "session gone"

**File:** `lib/hooks/use-floor-events.tsx:168-182`
**Issue:** `catch { /* Network blip — ignore */ }` correctly avoids false positives, but when the network is down for 10+ minutes the banner stays hidden. A laptop that sleeps for the session-expiry window wakes up with no banner even though the session is, in fact, gone. Minor UX.
**Fix (post-CR-02 fix):** On repeated `catch` (≥ 3 consecutive network failures), set an `offline` flag and render a separate "connection lost" pill distinct from the auth-drift banner.

---

### IN-05 [P3]: Station label fallback uses `name` (English, always), bypassing `labelFor`

**File:** `lib/floor/renderer.ts:287`
**Issue:**
```ts
const label = (L as unknown as Record<string, string>)[labelKey as string] ?? name;
```
If a label-key is missing from `Labels`, we fall back to the raw `name` (e.g. `"hub"`, `"loadingBay"`) — not a translated string. Given we exhaustively enumerate station keys at line 67-78 and both FOUNDER + DEV tables are fully populated (verified in `labels.ts:313-325, 959-968`), this branch is unreachable today. But the `as unknown as Record<string, string>` cast disables the exhaustiveness check that would catch future regressions.
**Fix:** Remove the double-cast and use a typed lookup:
```ts
const labelKey = STATION_LABEL_KEY[name];
const label = L[labelKey];  // type-checked against keyof Labels
```
`STATION_LABEL_KEY` already constrains `labelKey` to `keyof Labels`, so no fallback is needed; `name` fallback can be deleted or kept as a defensive `label ?? name` inline.

---

## Out-of-Scope Observations (not flagged, noted for the record)

- **Performance is explicitly out-of-v1-scope per review rubric.** Worth noting for later: every event flush triggers 2–3 `setState` calls (effectsCount, queueSize, lastEventTs), each of which re-renders `FloorCanvas`, which in turn re-runs the `onMetrics` effect that re-renders `FloorClient`, which re-renders `FloorToolbar` + debug strip. With QUEUE_CAP=500 and EFFECTS_CAP=10, a high-event-rate forge session could chain hundreds of re-renders per second. Consider batching drain in a requestAnimationFrame tick instead of `queueMicrotask` after CR-02/CR-03 land.

- **`dangerouslySetInnerHTML` in `app/floor/popout/page.tsx:67-71`** uses a static string literal for chrome-suppression CSS. No injection vector — contents are compile-time constant. Not flagged.

- **`parseEvent` in `lib/floor/event-adapter.ts:53-78`** is a textbook-clean SSE parser: size cap before JSON.parse, try/catch around parse, null-safe, allowlist-checked, never spreads parsed payload. Commendable.

- **`STATIONS` in `lib/floor/scene.ts:46-58`** is correctly `Object.freeze`d at every nesting level. `createScene()` deep-copies into a mutable struct. Immutability contract holds.

- **`iso.ts` math** is correct and matches clintbellanger's canonical derivation. The `screenToMap` inverse is algebraically valid; tests confirm round-trip identity within float tolerance.

---

_Reviewed: 2026-04-22T18:47:34Z_
_Reviewer: Claude (gsd-code-reviewer, opus-4-7-1m)_
_Depth: deep_
