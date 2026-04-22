---
phase: 11-live-floor-pixel-agents-isometric-overlay
fixed_at: 2026-04-23T04:07:34Z
review_path: .planning/phases/11-live-floor-pixel-agents-isometric-overlay/11-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-04-23T04:07:34Z
**Source review:** `.planning/phases/11-live-floor-pixel-agents-isometric-overlay/11-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (CR-01, CR-02, CR-03, WR-01, WR-02, WR-03, WR-04, WR-05)
- Fixed: 8
- Skipped: 0
- Tests before: 28 | Tests after: 32 (+4 regression tests added)

---

## Fixed Issues

### CR-01: searchParams not awaited — /floor and /floor/popout break on Next 16

**Files modified:** `app/floor/page.tsx`, `app/floor/popout/page.tsx`, `app/floor/page.test.tsx`, `app/floor/popout/page.test.tsx`
**Commit:** `83c13d4`

**Applied fix:**
- Changed `PageProps.searchParams` from `{ project?: string; popout?: string }` to `Promise<{ project?: string; popout?: string }>` in both pages.
- Added `const { project, popout: popoutParam } = await searchParams;` before any property reads in `/floor/page.tsx`.
- Added `const { project } = await searchParams;` in `/floor/popout/page.tsx`.
- Updated all 12 existing test call-sites to pass `Promise.resolve({...})` instead of plain objects.
- Added regression test 18 in each test file: passes `Promise.resolve({ project: "/z" })` and asserts the page picks `/z` not the fallback project — this test would FAIL against the old sync signature because `Promise.resolve({project:"/z"}).project` is `undefined`.

**Before:** `searchParams.project` silently returned `undefined` on Next 16 (Promise treated as plain object); fallback project always fired; page threw a sync-dynamic-api error in production.
**After:** `await searchParams` resolves the Promise before any property access; explicit `?project=` query correctly overrides the fallback.

---

### CR-02: Auth-drift probe never fires on mount — expired sessions invisible for 30s

**Files modified:** `lib/hooks/use-floor-events.tsx`, `lib/hooks/use-floor-events.test.tsx`
**Commit:** `b706389`

**Applied fix:**
- Added `void probe();` immediately before `setInterval(probe, AUTH_POLL_MS)` in the auth-drift `useEffect`, so the probe fires at mount time in addition to every 30s interval.
- Updated test 14 to capture `fetchAfterMount` after draining the immediate probe, then assert a second call fires after the interval — making the test precisely verify both the immediate and periodic behavior.
- Updated test 15 to drain the immediate probe with `await Promise.resolve()` instead of requiring `advanceTimersByTime(30s)`.
- Added regression test 17: mounts the hook with a 401-returning fetch stub, drains only microtasks (no timer advance), and asserts `authDrifted === true` — proves the probe fires at mount without waiting 30s.

**Before:** A user arriving at `/floor` with an expired session saw no re-auth banner for 30 seconds.
**After:** The probe fires on mount; an expired session surfaces the banner within a single microtask tick.

---

### CR-03: /api/tail and /api/state unauthenticated — project telemetry exposed

**Files modified:** `middleware.ts`
**Commit:** `f876065`

**Applied fix:**
- Extended the `middleware.ts` matcher array to include `"/api/tail"` and `"/api/state"`.
- Both routes are now covered by the existing `auth((req) => { if (!req.auth) redirect... })` handler — the same guard that protects `/floor`, `/build`, `/memory`, and `/metrics`.
- Added inline comments identifying the security reason for each new matcher entry.

**Before:** Any unauthenticated HTTP client on the same origin could `GET /api/tail?path=...` to stream live forge events and `GET /api/state?project=...` to read full dashboard snapshots including circuit-breakers, inbox/outbox, and token counts.
**After:** Both routes return a redirect to `/signin` for unauthenticated requests. The auth-drift probe in CR-02 can now actually receive 401 responses (previously always 200).

---

### WR-01: EventSource has no onerror handler — silent failures on auth or network error

**Files modified:** `lib/hooks/use-floor-events.tsx`, `lib/hooks/use-floor-events.test.tsx`
**Commit:** `dcd0d70`

**Applied fix:**
- Added `es.onerror` handler after `es.onmessage` in the SSE `useEffect`.
- On any error: logs `console.warn` with the current `readyState`.
- When `readyState === EventSource.CLOSED` (not just a transient reconnect): probes `/api/state` to distinguish auth failure (401 → `setAuthDrifted(true)`) from network loss (fetch throws → ignore). Uses `cbPathToProject()` (added in WR-03) for the URL.
- Added regression test 18: stubs fetch to return 401, simulates `onerror` with `readyState=CLOSED` via `Object.defineProperty`, then asserts both that fetch was called with `/api/state` and that `authDrifted` became `true`.

**Before:** An SSE disconnect (network drop, server 401, or ALLOWED_ROOTS tightening) was fully silent — no log, no UI indication, no auth check.
**After:** Errors are logged; CLOSED-state errors trigger an auth probe that surfaces the re-auth banner if the session is gone.

---

### WR-02: Missing noopener documentation — future contributor could silently break return-to-main

**Files modified:** `components/floor/floor-toolbar.tsx`
**Commit:** `9219f0c`

**Applied fix:**
- Added a 7-line code comment in `handlePopOut()` above the `window.open()` call explaining:
  1. Why `noopener,noreferrer` is intentionally omitted.
  2. Which two features depend on `window.opener` (`returnToMain()` in floor-client.tsx, Escape handler in floor-popout-host.tsx).
  3. The risk boundary: same-origin, session-authenticated, must never navigate cross-origin.
  4. The migration path if the constraint changes (BroadcastChannel, referencing 11-REVIEW.md WR-02).

**Before:** No documentation; a future contributor "fixing" the missing `noopener` would silently break return-to-main and Escape-to-close.
**After:** The trade-off is explicit and the migration path is documented inline.

---

### WR-03: Drift probe uses fragile string.replace to strip cbPath suffix

**Files modified:** `lib/hooks/use-floor-events.tsx`
**Commit:** `f842547`

**Applied fix:**
- Added module-level constant `CB_SUFFIX = "/.cae/metrics/circuit-breakers.jsonl"`.
- Added helper `cbPathToProject(cbPath: string): string` that uses `endsWith(CB_SUFFIX) ? slice(0, -CB_SUFFIX.length) : cbPath` — suffix-anchored, no mid-string mutation risk.
- Replaced both raw `.replace("/.cae/metrics/circuit-breakers.jsonl", "")` calls (one in the onerror handler added by WR-01, one in the probe) with `cbPathToProject(...)`.

**Before:** `cbPath.replace(suffix, "")` would mutate mid-string if the suffix ever appeared inside the path; coupling to the literal string was invisible to future refactors of `cb-path.ts`.
**After:** `cbPathToProject` is suffix-anchored (`endsWith` guard), named, and in one place — safe to grep and update when `resolveCbPath` changes.

---

### WR-04: lastEventTs state has no consumer — spurious re-renders per drained event

**Files modified:** `lib/hooks/use-floor-events.tsx`
**Commit:** `4e5e7f7`

**Applied fix:**
- Removed `lastEventTs: number | null` from `UseFloorEventsResult` interface (replaced with a comment noting the removal and the ref-based alternative if needed).
- Removed `const [lastEventTs, setLastEventTs] = useState<number | null>(null)`.
- Removed `setLastEventTs(Date.now())` from inside the drain while-loop.
- Removed `lastEventTs` from the return statement: `return { effectsCount, queueSize, authDrifted }`.
- No test changes needed — no test was asserting `lastEventTs` values.

**Before:** Every drained event scheduled a `setState` that re-rendered `FloorCanvas` and its entire subtree with no visible output; with QUEUE_CAP=500 a paused→unpaused flush could trigger hundreds of redundant renders.
**After:** Drain produces at most 2 state updates per call (`effectsCount`, `queueSize`), not one per event.

---

### WR-05: No X-Frame-Options on /floor/popout — clickjacking surface

**Files modified:** `next.config.ts`
**Commit:** `0e0ff44`

**Applied fix:**
- Added `async headers()` to the `NextConfig` object returning a single `/:path*` rule with three response headers:
  - `X-Frame-Options: DENY` — broad browser compatibility.
  - `Content-Security-Policy: frame-ancestors 'none'` — modern browsers (takes precedence over XFO when both present).
  - `Referrer-Policy: no-referrer` — defense-in-depth, suppresses referrer leakage on cross-origin navigations.
- Applied globally (not just `/floor/popout`) since clickjacking is a project-wide gap and no route has a legitimate need to be framed.

**Before:** Any site could iframe `/floor/popout` and overlay invisible click targets on the pause, minimize, and close controls.
**After:** All routes respond with `X-Frame-Options: DENY` and `frame-ancestors 'none'`; iframe embedding is blocked at the browser level.

---

## Skipped Issues

None — all 8 in-scope findings were successfully fixed.

---

_Fixed: 2026-04-23T04:07:34Z_
_Fixer: Claude (gsd-code-fixer, sonnet-4-6)_
_Iteration: 1_
