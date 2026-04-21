---
phase: 03-design-system-foundation
goal: "Dark theme + Geist + cyan accent + base component library; top-bar + routes refactored to Plan/Build; ExplainMode + DevMode providers wired; founder-speak copy pass across Phase 1+2 surfaces."
verified: 2026-04-20T00:00:00Z
status: human_needed
score: 16/16 automated must-haves verified
must_haves_count: 16
must_haves_passed: 16
overrides_applied: 0
human_verification:
  - test: "Dark theme visually renders on all authed routes"
    expected: "Near-black (#0a0a0a) background, light (#e5e5e5) text, Geist Sans on every route — signin, /build, /build/queue, /build/phase/2, /plan, /memory, /metrics. No Times New Roman anywhere."
    why_human: "Visual rendering + font paint cannot be verified programmatically without a headless browser; CSS bundle contains the tokens (verified) but paint confirmation requires a human or Playwright."
  - test: "Ctrl+E toggles explain-mode tooltip visibility"
    expected: "Pressing Ctrl+E flips localStorage.explainMode and makes explain-mode tooltips appear/disappear. Does not fire while typing in form fields."
    why_human: "Keyboard + DOM interaction + tooltip visibility requires a live browser session; providers are wired and throw outside provider (verified), but real keypress behavior is browser-only."
  - test: "Cmd+Shift+D (macOS) / Ctrl+Shift+D toggles dev-mode badge + technical labels"
    expected: "Pressing Cmd/Ctrl+Shift+D makes the cyan dev pill appear in the top-bar AND flips every label (heading islands + inline client-component labels) from founder-speak to dev-speak. Another press reverses."
    why_human: "Keyboard event + React-context propagation + heading-island re-render can only be confirmed in a running browser."
  - test: "Phase 1 auth flow still functional"
    expected: "Unauthed hits to /plan, /build, /memory, /metrics, /build/queue, /build/phase/N redirect to /signin?from=<path>. Signing in lands on /build (or /plan if cookie set)."
    why_human: "Middleware matcher is verified in source; live auth round-trip needs a browser + OAuth provider."
  - test: "Phase 2 existing routes still render after rename"
    expected: "After auth, /build shows phases list with founder heading 'Building {project}'. /build/queue shows 'Work queue'. /build/phase/2 shows phase detail with '← Back' link."
    why_human: "Server-rendered pages with /api/state polling need a real dev server with phase data fixtures; cannot be fully validated via curl without auth session."
  - test: "Toast notifications render from any client component"
    expected: "Calling `import { toast } from 'sonner'; toast.success('hi')` in devtools renders a visible toast on any authed page."
    why_human: "Toaster mount is source-verified; portal rendering requires live DOM."
  - test: "Screen-shake animation fires and honors prefers-reduced-motion"
    expected: "`document.body.classList.add('cae-shaking')` visibly shakes the body for ~150ms; under system prefers-reduced-motion: reduce the body stays still."
    why_human: "CSS keyframe paint + user OS preference integration cannot be validated from source."
---

# Phase 3: Design System Foundation Verification Report

**Phase Goal:** Establish design system foundation (dark theme, Geist fonts, cyan accent, base component library), refactor top-bar and routes to the Plan/Build naming, wire ExplainMode + DevMode providers, run a founder-speak copy pass across existing Phase 1+2 surfaces.

**Verified:** 2026-04-20
**Status:** human_needed (all automated checks pass; visual + keyboard + auth flow require human smoke test)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (mapped from ROADMAP Definition of Done + plan frontmatter)

| #   | Truth                                                                                                       | Status     | Evidence |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 1   | Dark theme tokens live on every route (near-black bg #0a0a0a, cyan accent #00d4ff, light text #e5e5e5)      | ✓ VERIFIED | `app/globals.css` contains 8× `#0a0a0a`, 4× `#00d4ff`; `@theme inline` maps shadcn vars; `<html className="dark">` in `app/layout.tsx:33` |
| 2   | Geist Sans + Geist Mono wired, no Times New Roman fallback                                                  | ✓ VERIFIED | `app/layout.tsx:10-19` imports `Geist` + `Geist_Mono` via `next/font/google`; `@theme inline` maps `--font-sans: var(--font-geist-sans)`; no serif/Times refs anywhere in source |
| 3   | `cae-shake` keyframe + `.cae-shaking` class + `prefers-reduced-motion` override                              | ✓ VERIFIED | `app/globals.css:180-197` defines keyframe (2× occurrences), `.cae-shaking` class, `@media (prefers-reduced-motion: reduce)` no-op override |
| 4   | ExplainModeProvider wired with Ctrl+E shortcut + localStorage persistence + in-field guard                   | ✓ VERIFIED | `lib/providers/explain-mode.tsx` present, `"use client"`, `ctrlKey && !metaKey && !shiftKey && !altKey` check, `STORAGE_KEY = "explainMode"`, hook throws outside provider, defaults to `true` |
| 5   | DevModeProvider wired with Cmd/Ctrl+Shift+D shortcut + localStorage persistence + in-field guard             | ✓ VERIFIED | `lib/providers/dev-mode.tsx` present, `"use client"`, `(metaKey \|\| ctrlKey) && shiftKey && !altKey` check, `STORAGE_KEY = "devMode"`, hook throws outside provider, defaults to `false` |
| 6   | Root layout wraps all children in both providers + mounts sonner `<Toaster />`                               | ✓ VERIFIED | `app/layout.tsx:37-43` — `<ExplainModeProvider><DevModeProvider>{TopNav}{children}<Toaster /></DevModeProvider></ExplainModeProvider>` |
| 7   | `useScreenShake()` hook exists, SSR-safe, honors prefers-reduced-motion                                      | ✓ VERIFIED | `lib/hooks/use-screen-shake.ts` present, `"use client"`, early-returns under reduced-motion + SSR, uses remove→reflow→add pattern for clean restart |
| 8   | Top-bar mode toggle reads "Plan | Build" (no "Ops"); clicking routes to /plan and /build                     | ✓ VERIFIED | `components/shell/mode-toggle.tsx` contains `"Plan"` + `"Build"` as SegmentButton labels; zero `"Ops"` matches; `router.push('/${mode}')` navigates to literal `/plan` + `/build`; sets `cae-mode` cookie |
| 9   | Memory (🧠) + Metrics (📊) icon buttons in top bar routing to /memory, /metrics stubs                        | ✓ VERIFIED | `components/shell/memory-icon.tsx` uses Lucide `Brain` + `href="/memory"`; `components/shell/metrics-icon.tsx` uses Lucide `BarChart3` + `href="/metrics"`; both wired in `top-nav.tsx:39-40`; stub pages `app/memory/page.tsx` + `app/metrics/page.tsx` render auth-gated h1 |
| 10  | Token-only cost ticker with "est." label + exact tooltip, zero USD/rate logic                                | ✓ VERIFIED | `components/shell/cost-ticker.tsx` — grep `\$\|estimateUsd\|usdFor\|calculateCost` returns 0; tooltip constant `"Token usage from local logs. OAuth subscription — not billed per call."`; reads `inputTokensToday + outputTokensToday` from `useStatePoll()` |
| 11  | Heartbeat dot (green/amber/red) reflects breaker state; shared single /api/state poll                       | ✓ VERIFIED | `components/shell/heartbeat-dot.tsx` consumes `useStatePoll()`, status machine halted/retry/phantom → red/amber/green with `animate-pulse` on up; `lib/hooks/use-state-poll.tsx` provides `StatePollProvider` (3s interval, single fetch) + `useStatePoll()`; `top-nav.tsx:19` wraps in `<StatePollProvider>` |
| 12  | Dev pill visible only when `useDevMode().dev === true`, cyan outline                                         | ✓ VERIFIED | `components/shell/dev-badge.tsx` — `const { dev } = useDevMode(); if (!dev) return null;` — cyan-outline pill with `border-[color:var(--accent)]`, `data-testid="dev-badge"` |
| 13  | Route tree reshaped: /plan, /build, /memory, /metrics exist; /ops 404s                                       | ✓ VERIFIED | `app/plan/page.tsx`, `app/build/page.tsx`, `app/memory/page.tsx`, `app/metrics/page.tsx` all present; `app/ops/` directory absent; `grep -rn '/ops' app/build/ app/plan/` returns zero; root redirect `app/page.tsx` branches on `cae-mode === "plan"` |
| 14  | Middleware matcher protects /plan, /build, /memory, /metrics (not /ops)                                      | ✓ VERIFIED | `middleware.ts` — `matcher: ["/plan/:path*", "/build/:path*", "/memory", "/metrics"]`; no `/ops` entry |
| 15  | Centralized `labelFor()` + 4 heading client-islands flip every label on devMode toggle                       | ✓ VERIFIED | `lib/copy/labels.ts` exports `labelFor(dev)` + `LABELS`; runtime test confirms `labelFor(false).buildHomeHeading('test') === 'Building test'`, `labelFor(true).buildHomeHeading('test') === 'Build — test'`, `labelFor(false).queueHeading === 'Work queue'`, `labelFor(true).queueHeading === 'CAE Queue'`; 4 heading islands present and imported by respective server pages; 8 files under `app/build/` + `app/plan/` import `labelFor` / `useDevMode` |
| 16  | shadcn primitives Dialog + Sonner (Toaster) + ScrollArea added to component library                          | ✓ VERIFIED | `components/ui/dialog.tsx` (4075 bytes), `components/ui/sonner.tsx` (1152 bytes, no next-themes import, hardcoded `theme = "dark"`), `components/ui/scroll-area.tsx` (1624 bytes) all present |

**Score:** 16/16 automated truths verified.

### Automated Check Results

| Check | Description | Result |
| ----- | ----------- | ------ |
| 1 | `grep -c '#0a0a0a' app/globals.css ≥ 1` | ✓ 8 matches |
| 1 | `grep -c '#00d4ff' app/globals.css ≥ 1` | ✓ 4 matches |
| 1 | `grep -c 'cae-shake' app/globals.css ≥ 1` | ✓ 2 matches (keyframe def + class rule) |
| 1 | `grep -c 'prefers-reduced-motion' app/globals.css` | ✓ 1 match |
| 2 | Geist fonts wired in `app/layout.tsx` | ✓ `Geist`, `Geist_Mono`, `geistSans.variable`, `--font-geist-sans` present |
| 3 | `<html className="dark">` | ✓ `app/layout.tsx:33` |
| 4 | Mode toggle contains `Plan`, zero `"Ops"` | ✓ Plan: 1, Ops: 0 |
| 5 | No `/ops/` refs under `app/build/`, `app/plan/` | ✓ Zero matches |
| 6 | Memory + Metrics stub pages exist | ✓ Both present (630 + 635 bytes) |
| 7 | All 7 shell components present | ✓ top-nav, mode-toggle, cost-ticker, memory-icon, metrics-icon, heartbeat-dot, dev-badge |
| 8 | All 4 heading islands present | ✓ build-home, build-queue, phase-detail, plan-home |
| 9 | Both providers exist | ✓ explain-mode.tsx, dev-mode.tsx |
| 10 | Both hooks exist | ✓ use-screen-shake.ts (.ts), use-state-poll.tsx |
| 11 | shadcn primitives | ✓ dialog.tsx, sonner.tsx, scroll-area.tsx |
| 12 | No USD chars/functions in cost-ticker | ✓ `grep -cE '\$\|estimateUsd\|usdFor\|calculateCost'` → 0 |
| 13 | `labelFor` exported | ✓ `export function labelFor(dev: boolean): Labels` at line 153 |
| 14 | Middleware protects new routes | ✓ Matcher lists `/plan/:path*`, `/build/:path*`, `/memory`, `/metrics` |
| 15 | `pnpm tsc --noEmit` | ✓ Exit 0 |
| 16 | `pnpm build` | ✓ Exit 0; 12 routes emitted (/, /build, /build/phase/[num], /build/queue, /memory, /metrics, /plan, /signin, /api/*) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `app/layout.tsx` | `app/globals.css` | `import './globals.css'` + `<html className="dark">` | ✓ WIRED | Import on line 3, className on line 33 |
| `app/layout.tsx` | `ExplainModeProvider + DevModeProvider + Toaster` | JSX wrapping | ✓ WIRED | Lines 37-43, outer=Explain, inner=Dev, Toaster sibling to children |
| `components/shell/top-nav.tsx` | `StatePollProvider` | JSX wrap around header | ✓ WIRED | `<StatePollProvider>` at line 19 |
| `components/shell/top-nav.tsx` | 6 shell sub-components + UserMenu | imports + JSX composition | ✓ WIRED | Every sub-component imported on lines 2-9 and rendered |
| `components/shell/mode-toggle.tsx` | `/plan, /build` | `router.push('/${mode}')` + cookie | ✓ WIRED | Lines 21-22 |
| `components/shell/cost-ticker.tsx` | `useStatePoll()` | React context hook | ✓ WIRED | Line 3 import + `useStatePoll()` call |
| `components/shell/heartbeat-dot.tsx` | `useStatePoll()` | React context hook | ✓ WIRED | Imports hook, reads `data.breakers.halted/retryCount/recentPhantomEscalations` |
| `components/shell/dev-badge.tsx` | `useDevMode()` | React context hook | ✓ WIRED | `const { dev } = useDevMode();` gate |
| `lib/hooks/use-state-poll.tsx` | `/api/state` | `fetch` in `setInterval` | ✓ WIRED | `fetch('/api/state?project=...')` every 3s with mount-guard |
| Heading islands | `lib/providers/dev-mode` + `lib/copy/labels` | `useDevMode()` + `labelFor(dev)` | ✓ WIRED | All 4 islands call both |
| `app/build/page.tsx` | `BuildHomeHeading` | JSX + import | ✓ WIRED | `<BuildHomeHeading projectName={projectName} />` at line 28 |
| `app/build/queue/page.tsx` | `BuildQueueHeading` | JSX + import | ✓ WIRED | Line 43 |
| `app/build/phase/[num]/page.tsx` | `PhaseDetailHeading` | JSX + import | ✓ WIRED | Line 43 |
| `app/plan/page.tsx` | `PlanHomeHeading` | JSX + import | ✓ WIRED | Line 8 |
| `middleware.ts` | `/plan, /build, /memory, /metrics` | matcher regex | ✓ WIRED | Config matcher covers all four |
| `app/page.tsx` | `cae-mode` cookie | `cookieStore.get("cae-mode")` | ✓ WIRED | Branches `=== "plan"` → `/plan`, else → `/build` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `cost-ticker.tsx` | `data.breakers.inputTokensToday/outputTokensToday` | `useStatePoll()` → `StatePollProvider` fetch `/api/state` | Existing route `app/api/state/route.ts` from Phase 2 | ✓ FLOWING (consumes real /api/state contract from Phase 2) |
| `heartbeat-dot.tsx` | `data.breakers.halted/retryCount/recentPhantomEscalations` | Same shared poll | Same /api/state | ✓ FLOWING |
| `BuildHomeHeading`, etc. | `projectName` / `phaseNumber` / `phaseName` | Server-page prop derived from `auth()` + project query | Server pages (carried from Phase 2) | ✓ FLOWING |
| `DevBadge` | `dev` | `useDevMode()` context | localStorage key `devMode` | ✓ FLOWING |
| Memory/Metrics stubs | Static copy only | N/A — stub pages | By design (content in later phases) | ✓ FLOWING (stub by roadmap intent) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| TypeScript compiles | `pnpm tsc --noEmit` | Exit 0 | ✓ PASS |
| Next.js build succeeds | `pnpm build` | Exit 0, 12 routes emitted | ✓ PASS |
| `labelFor()` runtime parity | `pnpm dlx tsx -e "..."` exercising all headings | `Building test`/`Build — test`/`Plan`/`Plan mode`/`Work queue`/`CAE Queue` all match | ✓ PASS |
| Route emission | `/build`, `/build/phase/[num]`, `/build/queue`, `/plan`, `/memory`, `/metrics` all in build output | Confirmed in build log | ✓ PASS |
| No stale technical terms | `grep -rn 'CAE Queue\|Active Forge\|Input tokens today\|Delegate to CAE' app/build/ app/plan/` | 0 matches | ✓ PASS |

### Requirements Coverage

No REQ-IDs mapped to this phase in REQUIREMENTS.md (phase uses frontmatter-only requirements, all internal to design system). Plans 03-01 through 03-06 together declare 21 requirement tokens (`dark-theme-tokens`, `geist-fonts`, `shake-keyframes`, `explain-mode-provider`, `dev-mode-provider`, `use-screen-shake-hook`, `toaster-wired`, `top-bar-refactor`, `mode-toggle-rename`, `memory-metrics-icons`, `cost-ticker-tokens-only`, `heartbeat-dot`, `dev-badge`, `shared-state-poll-hook`, `route-reorg`, `middleware-update`, `memory-stub`, `metrics-stub`, `founder-speak-labels`, `dev-mode-flip-pattern`, `heading-client-islands`, `shadcn-primitive-dialog`, `shadcn-primitive-sonner`, `shadcn-primitive-scroll-area`) — each is satisfied by the corresponding artifact above.

### Anti-Patterns Found

None. Spot-scan on modified files surfaced:

- Cost-ticker empty-data path shows `— tok today` but this is the intentional pre-hydration fallback text (not a stub — real data overwrites on `useStatePoll()` first fetch).
- Memory + Metrics pages render short copy pointing at later phases (Phase 7 + Phase 8). This is per the ROADMAP DoD: "Memory + Metrics icon buttons in top bar (route to stub pages, full content in later phases)." Stubs are a feature, not a gap.
- `app/plan/page.tsx` body copy is static (not devMode-reactive); this is explicitly deferred by Plan 05 decisions — only the heading flips via client-island. Acceptable per phase scope.

No TODO/FIXME comments were introduced in this phase's files. No `return null` stubs that bypass rendering (DevBadge's `return null` when `dev=false` is intentional UX).

### Gaps Summary

No automated gaps. All 16 must-haves verified against source + build + runtime tests. Phase goal achieved at the code/artifact level.

**Remaining scope is human verification only:** browser-based visual confirmation (dark theme paint, Geist rendering), keyboard-shortcut behavior (Ctrl+E + Cmd/Ctrl+Shift+D live), toast rendering, screen-shake paint, OAuth auth round-trip through the new matcher. These cannot be validated programmatically without either Playwright harness or live browser session.

### Human Verification Required

See `human_verification:` frontmatter block above for the full checklist. Summary:

1. Visual dark theme + Geist render on all routes
2. Ctrl+E toggles explain-mode tooltips
3. Cmd/Ctrl+Shift+D toggles dev badge + every label
4. Unauthed → signin redirect for /plan, /build, /memory, /metrics, /build/queue, /build/phase/N
5. After auth, existing Phase 2 routes render correctly under /build/*
6. `toast.success('hi')` renders via sonner Toaster
7. Body shake animates on `document.body.classList.add('cae-shaking')` and is suppressed under prefers-reduced-motion

---

_Verified: 2026-04-20_
_Verifier: Claude (gsd-verifier)_
