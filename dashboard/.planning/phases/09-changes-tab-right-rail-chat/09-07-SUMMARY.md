---
phase: 09-changes-tab-right-rail-chat
plan: 07
subsystem: chat-route
tags: [wave-4, chat-route, full-page-split, nav-polish]

# Dependency graph
requires:
  - phase: 09-05 (Wave 2)
    provides: "ChatPanel (standalone prop) + ChatRailProvider + useChatRail + /chat pathname guard (D-16)"
  - phase: 09-06 (Wave 3)
    provides: "ConfirmActionDialog + useGatedAction (gate wiring complete)"
  - phase: 09-03 (Wave 1b)
    provides: "/api/chat/* routes"
  - phase: 09-02 (Wave 1a)
    provides: "/api/changes aggregator"
  - phase: 03-design-system-foundation
    provides: "ExplainTooltip + labelFor(dev) + useDevMode"
provides:
  - "app/chat/page.tsx — /chat server shell: auth-gate + redirect + ChatLayout mount"
  - "app/chat/chat-layout.tsx — 50/50 split viewport client: left=ChatMirror, right=ChatPanel standalone"
  - "components/chat/chat-mirror.tsx — 7-surface read-only picker; rich renderers for Home + Changes; JSON fallback for Agents/Workflows/Queue/Metrics/Memory"
  - "components/shell/chat-pop-out-icon.tsx — top-nav MessageSquare icon linking /chat with ExplainTooltip"
  - "components/shell/top-nav.tsx — ChatPopOutIcon inserted in right cluster (Memory · Metrics · Chat | separator | Heartbeat · DevBadge | separator | UserMenu)"
affects: [09-08]

# Tech tracking
tech-stack:
  added: []  # zero new npm deps
  patterns:
    - "Server shell pattern (auth + redirect + mount client): identical to app/memory/page.tsx and app/metrics/page.tsx. auth() → redirect('/signin') → <ClientComponent />."
    - "50/50 split with h-[calc(100vh-40px)] overflow-hidden at the wrapper and overflow-auto per pane. Each pane is an independent scroll container; no nested scroll issues."
    - "ChatMirror surface-keyed fetch effect: useEffect on def.endpoint, cancelled=true guard, setPayload/setErr on resolve. Standard pattern for API-driven mirror views."
    - "ExplainTooltip + dev-mode-aware labelFor pattern: same doubling as every previous top-nav icon (Memory, Metrics). ChatPopOutIcon follows MemoryIcon/MetricsIcon styling exactly."

key-files:
  created:
    - "dashboard/app/chat/page.tsx"
    - "dashboard/app/chat/chat-layout.tsx"
    - "dashboard/components/chat/chat-mirror.tsx"
    - "dashboard/components/shell/chat-pop-out-icon.tsx"
  modified:
    - "dashboard/components/shell/top-nav.tsx"

key-decisions:
  - "Top-nav icon order: Memory · Metrics · ChatPopOutIcon, then separator, then Heartbeat · DevBadge, then separator, then UserMenu. Chat pop-out sits with the page-navigation icons (Memory, Metrics), not with the status indicators."
  - "ChatMirror rich renderers shipped for Home (phases list) + Changes (project groups + event prose). Agents/Workflows/Queue/Metrics/Memory use truncated JSON fallback. Phase 12 polish will wire richer per-surface modes. Keeps the file well under 200 LOC."
  - "Right pane uses w-1/2 flex section (not max-w-[800px] at the section level). ChatPanel standalone=true applies max-w-[800px] mx-auto internally — consistent with D-16 'max-width 800px, centered'."
  - "ChatMirror uses a <select> element (not a radio-group) for the surface picker. Simpler markup, works across all browsers, keeps the file lean. The plan mentioned 'radio-group picker' as an implementation hint, not a hard requirement."

# Metrics
duration: 4min
completed: 2026-04-23
---

# Phase 9 Plan 07: /chat full-page split + ChatMirror + top-nav pop-out icon Summary

**`/chat` registered as a full-page 50/50 split (D-16, CHT-04): left pane = ChatMirror with 7-surface read-only picker, right pane = ChatPanel standalone. Top-nav gains a MessageSquare pop-out icon. tsc clean, build green, lint-no-dollar PASS.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-23T01:22:43Z
- **Completed:** 2026-04-23T01:26:28Z
- **Tasks:** 2 / 2
- **Files created:** 4
- **Files modified:** 1 (top-nav.tsx — one import + one JSX slot added)

## Accomplishments

### Task 1 — /chat route + 50/50 layout + ChatMirror (CHT-04, D-16)

**app/chat/page.tsx** — server shell following the memory/metrics precedent exactly: `auth()` → `redirect("/signin")` → `<ChatLayout />`. Exports `metadata` with title "Chat — CAE".

**app/chat/chat-layout.tsx** — `"use client"` component. `useState<MirrorSurface>("home")` controls the picker. `h-[calc(100vh-40px)] w-full overflow-hidden` at wrapper level; each pane `overflow-auto` independently. Left section is `flex-1` (takes remaining width); right section is `w-1/2` (50%). `ChatPanel standalone` applies `max-w-[800px] mx-auto` internally (pre-existing standalone prop from 09-05).

**components/chat/chat-mirror.tsx** — 7-surface picker via `<select>`. Per-surface `useEffect` fetches the aggregator API on surface change (cancelled guard prevents stale-set after unmount). Rich renderers:
- `home`: phases list (up to 10 rows) with projectName · phaseN + progress/wave
- `changes`: project groups (up to 5) with event prose (up to 5 per group)
- all others: truncated JSON fallback (`JSON.stringify(...).slice(0, 2000)`) — T-09-07-01 cap honored

ChatRail auto-hides on `/chat` — verified by Wave 2's `usePathname() === "/chat"` guard in `chat-rail.tsx` (not re-implemented here; audited as per plan).

### Task 2 — Top-nav ChatPopOutIcon (CHT-04)

**components/shell/chat-pop-out-icon.tsx** — `"use client"`, follows MemoryIcon/MetricsIcon pattern exactly: `inline-flex h-7 w-7` hover target + `MessageSquare size-4` lucide icon + `ExplainTooltip` with `chatExplainRail` text. Dev-mode-aware via `useDevMode()` + `labelFor(dev)`. No `$` anywhere.

**components/shell/top-nav.tsx** — one new import + one new JSX slot. `ChatPopOutIcon` inserted after `MetricsIcon` in the right cluster, before the first separator. Final right-cluster order:

```
MemoryIcon · MetricsIcon · ChatPopOutIcon | separator | HeartbeatDot · DevBadge | separator | UserMenu
```

## Top-Nav Layout (final icon order)

| Position | Component | Role |
|----------|-----------|------|
| Right 1 | MemoryIcon | Navigate to /memory |
| Right 2 | MetricsIcon | Navigate to /metrics |
| Right 3 | ChatPopOutIcon | Navigate to /chat (pop-out full page) |
| Separator | — | Visual divider |
| Right 4 | HeartbeatDot | System health status |
| Right 5 | DevBadge | Dev-mode indicator |
| Separator | — | Visual divider |
| Right 6 | UserMenu | Auth / account |

## Mirror Surfaces — Rich vs. JSON Fallback

| Surface | Endpoint | Renderer |
|---------|----------|----------|
| Home | /api/state | Rich: phases list (up to 10 rows, progress + wave) |
| Changes | /api/changes | Rich: project groups with event prose (5 groups × 5 events) |
| Agents | /api/agents | JSON fallback (truncated 2000 chars) |
| Recipes | /api/workflows | JSON fallback |
| Queue | /api/queue | JSON fallback |
| Metrics | /api/metrics | JSON fallback |
| Memory | /api/memory/tree | JSON fallback |

Phase 12 polish can add richer per-surface renderers if needed. The plan explicitly permits JSON fallback for v1.

## UX Notes — Narrow Viewport Behavior

On viewports below ~800px total width:
- Left pane `flex-1` compresses to near-zero, pushing ChatMirror off-screen.
- Right pane `w-1/2` stays at 50% (minimum of ~400px on a 800px screen).
- The select dropdown and loading states still render, but are tight.

This is a known deferred issue — Phase 12 polish will add responsive breakpoints (e.g., stack vertically on mobile, or hide the mirror pane below a threshold). The plan explicitly defers narrow-viewport handling to Phase 12.

## Deviations from Plan

### None — plan executed exactly as written.

The plan's reference implementations were followed verbatim, with only minor rendering style choices (apostrophes escaped as `&apos;` per JSX rules). The `<select>` vs radio-group note: the plan's interface description mentions "radio-group picker" as a description, but the reference code in the task action uses `<select>`. The reference code was followed.

## Known Stubs

None — all rendered data flows from real aggregator API routes (already live from Waves 1-3). The JSON fallback for 5 surfaces renders actual API responses (truncated), not hardcoded empty values.

## Threat Flags

No new trust boundaries beyond those in the plan's threat model. Both T-09-07-01 and T-09-07-02 are accounted for:
- T-09-07-01: ChatMirror fetches auth-gated same-user APIs; JSON fallback truncates at 2000 chars.
- T-09-07-02: ChatPopOutIcon link to `/chat` is same-origin, no user-controlled destination.

## Task Commits

| Task | Commit    | Type | Description |
|------|-----------|------|-------------|
| 1    | `5949d9b` | feat | /chat full-page 50/50 split + ChatMirror picker (CHT-04, D-16) |
| 2    | `7dd5837` | feat | top-nav chat pop-out icon (CHT-04) |

## Self-Check: PASSED

**Files:**
- FOUND: dashboard/app/chat/page.tsx
- FOUND: dashboard/app/chat/chat-layout.tsx
- FOUND: dashboard/components/chat/chat-mirror.tsx
- FOUND: dashboard/components/shell/chat-pop-out-icon.tsx
- FOUND: dashboard/components/shell/top-nav.tsx (modified)

**Commits:**
- FOUND: 5949d9b (Task 1)
- FOUND: 7dd5837 (Task 2)

**Verification sweeps:**
- `pnpm tsc --noEmit` → exit 0, clean (both tasks)
- `pnpm build` → green, /chat route registers
- `./scripts/lint-no-dollar.sh` → PASS
- Plan verify greps → all FOUND
- `/chat` in Next.js build route list → confirmed

---
*Phase: 09-changes-tab-right-rail-chat*
*Completed: 2026-04-23*
