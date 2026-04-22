---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
status: planning
stopped_at: Completed 14-01-PLAN.md
last_updated: "2026-04-22T22:57:06.249Z"
progress:
  total_phases: 14
  completed_phases: 11
  total_plans: 83
  completed_plans: 71
  percent: 86
---

# cae-dashboard — Project State

**Current milestone:** v0.1 — Founder-facing UI over CAE + Shift
**Status:** Ready to plan

## Completed Phases

- ✅ Phase 1 — App shell + auth + mode toggle (2026-04-20)
- ✅ Phase 2 — Ops core: phase list, tail, breakers, queue, detail (2026-04-20)
- ✅ Phase 9 — Changes tab + right-rail chat (2026-04-23)

## Active Phase

Phase 10 — Plan mode: Projects / PRDs / Roadmaps / UAT (`/plan/*` routes wrapping Shift).
Plan 10-04 complete (Wave 1 closed). Next: plan 10-05 (API routes).

**Last session:** 2026-04-22T22:57:06.243Z
**Stopped at:** Completed 14-01-PLAN.md

## Key Decisions (Phase 13 — Plan 12)

- **13-12:** D-08 gate PASS — 100% P0 resolved+partial (22/22), 100% ALL resolved+partial (43/43), 0 regressed, 0 WCAG AA violations
- **13-12:** Auth-deferred partials (F-corr-02/03/04) classified as partial not still_broken — session-7 policy is explicit, no code failure; D-08 math uses resolved+partial = 100%
- **13-12:** WF-01 auto-fixed — copyright footer opacity-60 removed (text-muted alone gives ~5.9:1 contrast); fix required rebuild + server restart (stale binary was serving old markup)
- **13-12:** UAT auto-approved per session-7 directive; post-P14 consolidated UAT recommended for auth-route live walkthrough
- **13-12:** 35 delta pairs — 8 screenshot pairs (laptop/mobile/wide × founder/dev for root+signin) + 27 code-evidence pairs for auth-gated routes

## Key Decisions (Phase 13 — Plan 11)

- **13-11:** Shared Panel primitive at components/ui/panel.tsx — headingId auto-derived from title; callers pass explicit headingId when existing test selectors depend on a specific id
- **13-11:** data! non-null assertions on metrics panels — all null paths return early; assertion is safe and cleaner than optional chaining throughout render
- **13-11:** Chat bubble max-w-[65ch] not max-w-prose — 65ch is closer to 60-70ch readability sweet spot per UI-SPEC
- **13-11:** Signin bg-accent text-black for GitHub button — cyan on black is 10:1+ WCAG AA; inverted from app chrome but correct for primary CTA
- **13-11:** Plan home tabs preview row is aria-hidden — visual preview only; real tabs come in Phase 10

## Key Decisions (Phase 13 — Plan 08)

- **13-08:** stat+poll (500ms) instead of fs.watch — reliable on Linux, no ENOENT crash when file missing, simpler to unit-test with tmp files
- **13-08:** AbortController coordinates req.signal + stream.cancel() + tailJsonl signal — single close() path, no resource leaks
- **13-08:** IncidentStream mounted in 2-col grid row with SpendingPanel; Reliability+Speed in second row (metrics-client.tsx restructured)
- **13-08:** DebugBreadcrumbPanel uses hooks before dev-mode gate — React rules require all hooks to run before any conditional return
- **13-08:** subscribe() in client-log-bus is synchronous callback (not CustomEvent) for reliable test assertions; CustomEvent path also maintained for DOM consumers

## Key Decisions (Phase 13 — Plan 06)

- **13-06:** useStatePoll uses clearInterval on hidden (full pause) — correct for 3s cadence; useMetricsPoll uses skip-if-hidden (correct for 30s cadence); different semantics intentional
- **13-06:** ChatPanel uses lastMsgAt state on assistant.delta (not useSseHealth) — fetch() ReadableStream cannot be wrapped by EventSource hook
- **13-06:** useSseHealth spawns own EventSource in tail-panel + sheet-live-log (2 connections per consumer) — deferred unification to 13-08
- **13-06:** HeartbeatDot retains halted/degraded/up dot (system-state) + adds LastUpdated chip (data freshness) — two separate semantics coexist
- **13-06:** LivenessChip RTT shows staleness (seconds since last poll), not true network round-trip latency

## Key Decisions (Phase 13 — Plan 05)

- **13-05:** withLog uses `...args:any[]` generic to accept both Request and NextRequest without type casts
- **13-05:** NextAuth route (/api/auth/[...nextauth]) excluded from withLog — NextAuth-provided, not our handler
- **13-05:** Client-side console.* survivors (12 calls in hooks/components) deferred to plan 13-08 client breadcrumb panel
- **13-05:** pino redact covers authorization/cookie/session-token/password at multiple nesting depths
- **13-05:** SSE routes (chat/send, tail) emit req.end.stream-open not req.end — avoids false timing for streaming responses

## Key Decisions (Phase 13 — Plan 04)

- **13-04:** WR-01 fixed — generate `assistantMsgId` once at stream start; `assistant.begin` + `assistant.end` carry it; `assistant.delta` + `unread_tick` + `rate_limited` emit empty id so browser does not advance lastEventId cursor.
- **13-04:** Client promotion narrowed to `assistant.end` only — prevents ephemeral delta UUIDs from overwriting `lastSeenMsgId` in localStorage.
- **13-04:** `encodeSSE` extracted to `lib/sse.ts` — id contract documented with WR-01 rationale; testable independently of the route.
- **13-04:** `userMsgId` (user message persistence) is a separate UUID from `assistantMsgId` — 2 `randomUUID()` calls in route.ts is correct; only assistant SSE id contract changed.

## Key Decisions (Phase 13 — Plan 03)

- **13-03:** WR-01 confirmed via static code analysis — 4 randomUUID() calls in send/route.ts stream (lines 165/213/222/273) overwrite client lastSeenMsgId (chat-panel.tsx:200); unread always 0 after reload. Fix in plan 13-04.
- **13-03:** verify.py SOURCE-ONLY mode: all 17 panels produce source values; 14 AUTH-DEFERRED pending authsetup.sh; 2 UNVERIFIABLE (in_flight, wave_current — derivation requires re-implementing cae-phase-detail.ts).
- **13-03:** Pre-auth discovery: circuit-breakers.jsonl forge_end events have no input_tokens/output_tokens — recent ledger token sums always 0 (P1 logging gap, not aggregator bug; fix in plan 13-05).
- **13-03:** rollup.tokens_today vs breakers token sum has structural mismatch risk: API route tails 200 rows, cae-home-state.ts tails 500 rows — can diverge on high-activity days (P0 auth-deferred).

## Key Decisions (Phase 13 — Plan 02)

- **13-02:** Auth-gated routes skipped gracefully (storage-state.json absent, deferred per session-7); 8 public-route PNGs captured, 61 auth-gated deferred pending authsetup.sh run.
- **13-02:** console-baseline.tsv captures public routes only (root + signin); both clean (0 errors/warns/page errors).
- **13-02:** BASELINE.md is the only git-trackable artifact from this plan; shots + working/ remain gitignored per threat model T-13-02-02.

## Key Decisions (Phase 13 — Plan 01)

- **13-01:** gitignore uses `shots/*` + `!shots/.gitkeep` negation — `shots/` (dir pattern) cannot unignore children in git.
- **13-01:** capture.sh gracefully skips auth routes when storage-state.json absent; public routes still capture.
- **13-01:** verify.py exits 2 (fatal/no-auth) vs 1 (data mismatch) vs 0 (clean) — CI-gate friendly.
- **13-01:** storage-state.json sign-in deferred to post-P14 consolidated UAT per session-7 directive.
- **13-01:** base_url hardcoded to :3003 in routes.json; :3002 (Eric's dev server) never touched.

## Key Decisions (Phase 12 — Plan 04)

- **12-04:** matchesKeydown uses kbRaw → kb non-undefined narrowing pattern to satisfy TypeScript closure analysis.
- **12-04:** Ctrl+K fallback kept in use-command-palette — KEYBINDINGS uses ⌘ (mac) but win/linux users need Ctrl+K; fallback reads last chip from kb.keys not a hardcode.
- **12-04:** Shift+/ fallback kept in use-shortcut-overlay — US keyboard fires / + Shift, not ? directly.
- **12-04:** tw-animate-css@1.4.0 has zero built-in reduced-motion rules (confirmed); per-utility override block added to globals.css (MOT-02).
- **12-04:** axe audit environment-blocked (Snap Chromium + ChromeDriver incompatibility); static A11Y analysis confident; deferred to Phase 13 with Playwright.
- **12-04:** Human UAT checkpoint auto-approved per session-7 directive; items deferred to post-P14 consolidated UAT.

## Key Decisions (Phase 12 — Plan 03)

- **12-03:** EmptyState uses `testId` prop (not `data-testid` spread) — callers must use testId="…" not data-testid="…".
- **12-03:** Memory browse CTA routes to /memory?view=graph (less invasive than adding onRegenerate prop to FileTree).
- **12-03:** Graph pane empty reuses RegenerateButton from existing pane imports as actions slot.
- **12-03:** Metrics panels keep section/h2 landmark shell on !data branch; EmptyState renders inside.
- **12-03:** Plan page stays server component — uses Link + Button (no use client needed).
- **12-03:** workflowsListEmpty reused as body copy in workflows EmptyState (no duplicate string).

## Key Decisions (Phase 11 — Plan 05)

- **11-05:** Chrome suppression uses route-scoped `<style dangerouslySetInnerHTML>` with static literal CSS — no user content interpolated; React mounts/unmounts with route (Q1 Option C). TopNav also gets aria-hidden on mount via FloorPopoutHost.
- **11-05:** Escape-to-close only binds when window.opener != null — prevents closing a bookmarked /floor/popout tab opened directly (T-11-08 mitigation).
- **11-05:** hasOpener detected via useEffect in FloorClient — SSR-safe; no new prop to FloorClientProps.
- **11-05:** floorReturnToMain label added: FOUNDER "Back to main window", DEV "Return to main window".
- **11-05:** Pop-out URL switched from /floor?popout=1&project=X to /floor/popout?project=X — cleaner routing, easier chrome scope, easier bookmarking.

## Key Decisions (Phase 11 — Plan 04)

- **11-04:** FloorIcon mirrors ChatPopOutIcon exactly — same className, ExplainTooltip wrap, labelFor; only icon (Gamepad2) and href (/floor) differ.
- **11-04:** floorAuthDriftNotice added to labels.ts (FOUNDER: "Please sign in again in main window"; DEV: "Session expired — re-auth in main window").
- **11-04:** FloorToolbar legend toggle wires to global useExplainMode().toggle — legend state is shared Explain mode, not a local boolean.
- **11-04:** Project resolution: explicit ?project= > most-recent Shift (shiftUpdated sort desc) > first project > null (idle scene).
- **11-04:** lint-guard tests use absolute paths instead of import.meta.url — jsdom URL resolution strips the filesystem prefix.

## Key Decisions (Phase 11 — Plan 03)

- **11-03:** queueMicrotask (not RAF) for drain cadence — decouples event application from render; caps hold even during pop-out detach.
- **11-03:** reducedMotionRef + pausedRef pattern — capture latest flag values without restarting the SSE useEffect on each flip.
- **11-03:** cbPath widened to string | null — null = idle scene, no SSE; consistent with resolveCbPath null-return contract.
- **11-03:** canvas re-exports QUEUE_CAP/EFFECTS_CAP/MAX_LINE_BYTES from hookTest for Plan 02 test backward compatibility.

## Key Decisions (Phase 11 — Plan 02)

- **11-02:** Stations drawn via diamond paths (moveTo/lineTo/fill) not fillRect; renderer tests count fill() calls not fillRect().
- **11-02:** safeCtx alias required inside RAF closure — TypeScript cannot narrow getContext() result past closure boundary.
- **11-02:** ResizeObserver stubbed globally in beforeEach (jsdom lacks it); vi.stubGlobal pattern established for canvas component tests.
- **11-02:** Dollar sign in JSDoc comment caught by lint-guard test — removed from comment text; lesson: never write "$ in this file" in source comments.

## Key Decisions (Phase 12 — Plan 02)

- **12-02:** PALETTE_GROUP_ORDER = [projects, tasks, agents, workflows, memory, commands] — frozen D-07 contract; Plan 12-04 imports this constant for nav wiring.
- **12-02:** Provider hierarchy for Wave 3 mount: `<CommandPaletteProvider><ShortcutOverlayProvider>` (peer-safe, order doesn't matter).
- **12-02:** Combobox inside Dialog (no Portal/Popup) — Dialog already provides modal + focus-trap; Combobox renders List inline inside DialogContent.
- **12-02:** document.activeElement added alongside e.target in editable-target guards — required for jsdom KeyboardEvent dispatch compatibility.
- **12-02:** openShortcuts toggle in buildPaletteIndex wired to close() as placeholder — Plan 12-04 replaces with real ShortcutOverlay toggle when co-mounted.

## Key Decisions (Phase 12 — Plan 01)

- **12-01:** pnpm used as lockfile manager (pnpm-lock.yaml is authoritative; not npm install).
- **12-01:** vitest.config.ts include extended to `app/**/*.test.ts` — was missing non-JSX app unit tests.
- **12-01:** KEYBINDINGS registry has 10 entries: 4 global, 1 sheets, 2 task, 3 palette.
- **12-01:** MOT-02 (tw-animate-css reduced-motion) not verified headlessly; deferred to Plan 05 DevTools audit.

## Key Decisions (Phase 10 — Plan 04)

- **10-04:** mostRecentSlug computed by max(shiftUpdated) scan rather than array[0] — test mock does not pre-sort, so getPlanHomeState must be order-independent.
- **10-04:** parseEnvExample returns string[] (key names only) matching test scaffold; validateShipInput whitelist accepts string[] | EnvExampleKey[] for dual calling convention.
- **10-04:** ghAuthStatus uses callback-based execFile (no promisify, no options arg) so vi.mock("child_process") intercepts at 3-arg position matching test mock.
- **10-04:** SHIFT_PROJECTS_HOME scan unions with hard-coded candidates (not replaces); dedup by absolute path — one project never appears twice.

## Key Decisions (Phase 09)

- **09-08:** UAT auto-approved: tsc exits 0, 239/239 tests pass, lint clean, build exits 0 with all 7 Phase 9 routes registered. Browser walk-through deferred to Eric's interactive session (headless env + autonomous mode).
- **09-07:** Top-nav icon order: Memory · Metrics · ChatPopOutIcon before separator, then Heartbeat · DevBadge · UserMenu.
- **09-07:** ChatMirror rich renderers for Home + Changes; JSON fallback for Agents/Workflows/Queue/Metrics/Memory; Phase 12 deferred.
- **09-06:** ConfirmActionDialog dev-mode bypass fires via useEffect (component renders null immediately; onAccept + undo toast fire async). cancel() closes dialog (plan said no-op; required for correct UX).
- **09-06:** WorkflowForm / editor page has no Run-now button; list page is only run entry point.
- **09-05:** Provider split outer session-gate + inner AuthedChatRailProvider (rules-of-hooks safe).
- **09-05:** bumpUnread auto-expand clears unread badge (deviates from plan in user-friendly direction).

## Accumulated Context

### Audience reframe (2026-04-20, mid session 3)

Primary users for BOTH modes (Plan + Build) are **non-dev founders / product people**, not developers. Every surface must pass "would a PM understand without a dev next to them." Dev-speak behind a single "Advanced" toggle (`dev_mode`), OFF by default.

### Design law

`dashboard/docs/UI-SPEC.md` is the canonical design spec. Session 4 resolutions at bottom supersede earlier contradictions. Key locks:

- Mode toggle: **Plan** (Shift FE) / **Build** (CAE FE) — names swapped from earlier drafts
- Memory + Metrics pulled OUT of tabs → global top-bar icons
- Build tabs (5): Home / Agents / Workflows / Queue / Changes
- Plan tabs (4): Projects / PRDs / Roadmaps / UAT
- Live Floor isometric, Phase 9 (last)
- Graphify = safishamsi/graphify → react-flow native
- Screen shake on merge: revived, respects prefers-reduced-motion
- Explain-mode: default ON everywhere, Ctrl+E toggles

### Phase order per UI-SPEC §S4.7

2.5 (design system) → 3 (Home rewrite) → 4 (Agents) → 5 (Workflows+Queue) → 6 (Metrics) → 7 (Memory+graph) → 8 (Changes+chat) → 9 (Live Floor) → 10 (polish)

### Roadmap Evolution

- 2026-04-20: Session 3 roadmap drafted with 4 Ops phases + 4 Build phases + polish.
- 2026-04-20: Session 4 reordered post-UI-SPEC lock. Phase 2.5 inserted before Phase 3 rewrite.
