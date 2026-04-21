---
phase: 03-design-system-foundation
plan: 03
subsystem: shell/top-bar
tags: [top-nav, mode-toggle, cost-ticker, memory-icon, metrics-icon, heartbeat-dot, dev-badge, state-poll]
requires:
  - p3-pl01  # dark theme tokens (var(--bg), --accent, --border-subtle, etc.)
  - p3-pl02  # DevModeProvider (consumed by dev-badge)
  - p3-pl04  # /plan, /build, /memory, /metrics routes (navigation targets)
provides:
  - lib/hooks/use-state-poll.tsx  # StatePollProvider + useStatePoll (shared 3s /api/state poll)
  - components/shell/top-nav.tsx  # 40px chrome assembling all pieces, wraps StatePollProvider
  - components/shell/mode-toggle.tsx  # Plan|Build segmented toggle (cyan accent on active)
  - components/shell/cost-ticker.tsx  # Tokens-only ticker, zero USD, est. label + tooltip
  - components/shell/memory-icon.tsx  # Lucide Brain link to /memory
  - components/shell/metrics-icon.tsx  # Lucide BarChart3 link to /metrics
  - components/shell/heartbeat-dot.tsx  # green/amber/red pulse from breaker state
  - components/shell/dev-badge.tsx  # cyan pill visible only when devMode=true
affects:
  - app/layout.tsx  # already wires TopNav (unchanged this plan)
tech-stack:
  added: []
  patterns:
    - "React context for shared polling: one setInterval per provider, many subscribers via useContext"
    - "data-testid on every shell sub-component for automated acceptance grep/curl checks"
    - "Tokens-only cost display — no USD conversion, no rate config imports anywhere"
key-files:
  created:
    - lib/hooks/use-state-poll.tsx
    - components/shell/cost-ticker.tsx
    - components/shell/memory-icon.tsx
    - components/shell/metrics-icon.tsx
    - components/shell/heartbeat-dot.tsx
    - components/shell/dev-badge.tsx
  modified:
    - components/shell/mode-toggle.tsx  # full rewrite Build|Ops -> Plan|Build
    - components/shell/top-nav.tsx      # full rewrite, 40px chrome with StatePollProvider
decisions:
  - "Cost ticker uses string concatenation instead of template literals to honor the plan's zero-`$` rule (verify regex matches literal `$` including `${}` template syntax)"
  - "TopNav stays server component; StatePollProvider (client) wraps children — keeps auth data on server, pushes polling to client"
  - "Heartbeat dot shows 'live' text when up, otherwise status word — avoids flat-dot ambiguity without adding extra labels"
  - "Dev badge returns null when dev=false (no hidden DOM node) — testid only appears when intended"
metrics:
  duration: ~12 minutes
  completed: 2026-04-20
---

# Phase 3 Plan 03: Top-bar Refactor (Plan|Build + Memory/Metrics + Tokens-only Ticker + Heartbeat + Dev Badge) Summary

Shipped the 40px global top-bar chrome per UI-SPEC §1 + §S4.2: segmented Plan|Build toggle replaces Build|Ops, Memory (🧠) and Metrics (📊) icons become global, cost ticker renders tokens only (no USD, no rate config), heartbeat dot reflects circuit-breaker state, and a dev pill appears only when `useDevMode().dev === true`. A shared `useStatePoll()` hook collapses CostTicker and HeartbeatDot into one `/api/state` fetch per 3s interval.

## What Was Built

### Task 1 — Shared poll hook + six shell pieces (commit `f0375ed`)

1. **`lib/hooks/use-state-poll.tsx`** (NEW, 87 lines) — React-context polling hook.
   - `StatePollProvider`: single `setInterval(poll, 3000)` calling `/api/state?project=...`; holds `{ data, error }` in context.
   - `useStatePoll()`: throws if used outside the provider; returns the shared `{ data, error }`.
   - Mount-guarded with `mounted` ref so late fetches don't setState after unmount.
2. **`components/shell/mode-toggle.tsx`** (REWRITE, 53 lines) — `Plan | Build` segmented toggle.
   - `usePathname()` flips `activeMode` based on `/plan` vs `/build` prefix.
   - Click sets cookie `cae-mode=plan|build` and `router.push('/${mode}')`.
   - Active segment: `bg-[color:var(--accent-muted)] text-[color:var(--accent)]` (cyan #00d4ff accent per §13).
   - Inline `SegmentButton` subcomponent keeps the file flat.
3. **`components/shell/cost-ticker.tsx`** (NEW, 41 lines) — **Tokens only. Zero `$`.**
   - Consumes `useStatePoll()`, reads `data.breakers.inputTokensToday + outputTokensToday`.
   - `formatTokens(n)` uses **string concatenation** (not template literals) to honor zero-`$` rule.
   - Tooltip literal: `Token usage from local logs. OAuth subscription — not billed per call.`
   - Pre-hydration fallback shows `— tok today · est.` in muted color.
4. **`components/shell/memory-icon.tsx`** (NEW, 16 lines) — `<Link href="/memory">` wrapping Lucide `Brain` size-4.
5. **`components/shell/metrics-icon.tsx`** (NEW, 16 lines) — `<Link href="/metrics">` wrapping Lucide `BarChart3` size-4.
6. **`components/shell/heartbeat-dot.tsx`** (NEW, 39 lines) — status machine:
   - `error` → `degraded` (amber)
   - `data.breakers.halted` → `halt` (red)
   - `data.breakers.retryCount > 0 || recentPhantomEscalations > 0` → `degraded` (amber)
   - otherwise → `up` (green with `animate-pulse`)
7. **`components/shell/dev-badge.tsx`** (NEW, 18 lines) — `useDevMode().dev` gate; returns `null` when off. Cyan outline pill (`border-[color:var(--accent)] text-[color:var(--accent)]`) when on.

### Task 2 — Top-nav assembly (commit `c30598f`)

**`components/shell/top-nav.tsx`** (REWRITE, 48 lines) — 40px sticky chrome.

Layout (left → middle → right):
- **Left cluster** (`gap-3`): `CAE` wordmark · `·` divider · `<ModeToggle />`
- **Middle** (`flex-1`): `<CostTicker />`
- **Right cluster** (`gap-2`): `<MemoryIcon />` `<MetricsIcon />` | `<HeartbeatDot />` `<DevBadge />` | `<UserMenu session={...} />`

Thin 1×16px vertical dividers (`h-4 w-px bg-[color:var(--border-subtle)]`) group the icon pair from the heartbeat/dev pair from the avatar. The whole header sits inside `<StatePollProvider>` so every `useStatePoll()` consumer shares the subscription. Explicit `style={{ fontFamily: "var(--font-sans)" }}` guards against any serif fallback on the load-bearing chrome.

## Verification

- `pnpm tsc --noEmit` → exit 0
- `pnpm build` → compiled + static pages generated successfully. All 12 routes present (`/`, `/build`, `/build/phase/[num]`, `/build/queue`, `/memory`, `/metrics`, `/plan`, `/signin`, api routes). Pre-existing webpack warning from `lib/cae-phase-detail.ts` dynamic require is unrelated to this plan.
- `grep -cE '\$|estimateUsd|usdFor|calculateCost' components/shell/cost-ticker.tsx` → `0` ✓
- `grep -c Ops components/shell/mode-toggle.tsx` → `0` ✓ (no trace of old label)
- `grep -c 'data-testid=' components/shell/*.tsx` → 8 hits across 7 files (cost-ticker has 2 — loading state + ready state):
  - top-nav.tsx: `top-nav`
  - mode-toggle.tsx: `mode-toggle`
  - cost-ticker.tsx: `cost-ticker` (×2)
  - memory-icon.tsx: `memory-icon`
  - metrics-icon.tsx: `metrics-icon`
  - heartbeat-dot.tsx: `heartbeat-dot`
  - dev-badge.tsx: `dev-badge`
- Dev server boots (`pnpm dev` → http://localhost:3000/signin serves 200 HTML).
- Curl-based testid check on `/signin` returns **zero** testids — see Deviations below (TopNav is session-gated by design, signin has no session, not a bug).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cost ticker template-literal `${}` would have tripped `! grep -q '$'`**

- **Found during:** Task 1, initial code paste
- **Issue:** The plan pasted the exact `formatTokens` body using template literals (```${(n / 1000).toFixed(1)}k```). Running the plan's own `grep -c '\$' components/shell/cost-ticker.tsx` returned `2` because `$` in `${}` template syntax is a literal dollar sign. The plan's hard rule ("No `$` symbol anywhere in the file") and the success-criteria grep would both fail.
- **Fix:** Rewrote `formatTokens` to use string concatenation instead of template literals. Behavior identical; now `grep -cE '\$|estimateUsd|usdFor|calculateCost' components/shell/cost-ticker.tsx` returns `0`.
- **Files modified:** `components/shell/cost-ticker.tsx` (lines 5–9)
- **Commit:** `f0375ed` (folded into Task 1)

### Acceptance-criteria gap (documented, not blocking)

**Curl-based testid acceptance on `/signin`:** The success criteria says `curl /signin | grep -q 'data-testid="cost-ticker"'` etc. should pass. In reality `app/layout.tsx` only renders `<TopNav session={...} />` when `session` is truthy (line 39: `{session && <TopNav session={session} />}`). The `/signin` route, by design, is unauthenticated — so TopNav does not render there and none of the shell testids appear in its HTML.

The grep-source check passes (all seven testids present in source). To run the curl check for real you need an authed session cookie or an `auth()` fixture, which this plan does not introduce. The plan's own Task 2 acceptance notes this: *"Authed session needed; executor documents in SUMMARY if auth fixture not available — all server-rendered testids will still appear in HTML once auth resolves."* Flagging here per that note.

### Authentication gates

None.

## Key Decisions

1. **String concatenation in `formatTokens`** — to pass the zero-`$` verify rule literally (template literal `${}` contains `$`).
2. **StatePollProvider inside TopNav, not root layout** — keeps the poll lifecycle tied to the chrome that actually needs it. If a future surface outside the chrome needs polling, we can hoist the provider into `app/layout.tsx` above `<TopNav>`.
3. **Heartbeat renders status text next to dot** — avoids ambiguous "green dot" when CSS vars haven't loaded; text reads `live | degraded | halt`.
4. **Divider spans use `aria-hidden`** — purely visual separators should not pollute screen-reader navigation.

## Self-Check: PASSED

**Files:**
- FOUND: `/home/cae/ctrl-alt-elite/dashboard/lib/hooks/use-state-poll.tsx`
- FOUND: `/home/cae/ctrl-alt-elite/dashboard/components/shell/mode-toggle.tsx`
- FOUND: `/home/cae/ctrl-alt-elite/dashboard/components/shell/cost-ticker.tsx`
- FOUND: `/home/cae/ctrl-alt-elite/dashboard/components/shell/memory-icon.tsx`
- FOUND: `/home/cae/ctrl-alt-elite/dashboard/components/shell/metrics-icon.tsx`
- FOUND: `/home/cae/ctrl-alt-elite/dashboard/components/shell/heartbeat-dot.tsx`
- FOUND: `/home/cae/ctrl-alt-elite/dashboard/components/shell/dev-badge.tsx`
- FOUND: `/home/cae/ctrl-alt-elite/dashboard/components/shell/top-nav.tsx` (rewritten)

**Commits:**
- FOUND: `f0375ed` — feat(03-03): shared state-poll hook + six shell pieces
- FOUND: `c30598f` — feat(03-03): assemble 40px top-nav with StatePollProvider + seven elements
