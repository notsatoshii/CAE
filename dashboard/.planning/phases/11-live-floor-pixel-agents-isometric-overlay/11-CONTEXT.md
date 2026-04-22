# Phase 11 — Live Floor — Context

**Source:** This CONTEXT.md is synthesized by the planner from the phase brief + UI-SPEC §11 + Phase 11 RESEARCH.md "Claude's Discretion" section. No interactive `/gsd-discuss-phase` was run — per RESEARCH's instruction, Discretion items are treated as locked decisions.

**Created:** 2026-04-23
**Phase:** 11-live-floor-pixel-agents-isometric-overlay
**Predecessor:** 10 (Plan mode) — runs AFTER 1-10; this phase is explicitly scoped "polish, not core."

---

## Requirements

| ID | Description | Source |
|----|-------------|--------|
| **P11-01** | Top-bar 🎮 Link opens Live Floor at `/floor` | UI-SPEC §2 + §11 |
| **P11-02** | Isometric 2.5D scene with 10 named stations | UI-SPEC §11 |
| **P11-03** | SSE-driven event animations sourced from existing `/api/tail` on `.cae/metrics/circuit-breakers.jsonl` | UI-SPEC §11 + research §Don't Hand-Roll |
| **P11-04** | Pop-out to separate browser window for second-monitor use | UI-SPEC §11 + §14 |
| **P11-05** | Respects `prefers-reduced-motion` (static station tint fallback, no effect spawns) | UI-SPEC §13 + research Pattern 4 |
| **P11-06** | Dark theme + base-ui for shell/controls; canvas is raw pixels | UI-SPEC §13 |
| **P11-07** | Explain-mode legend overlay (a11y fallback so the scene is understandable without motion) | Derived — UI-SPEC "Explain mode default ON everywhere" + Phase 11 brief "never blocks work" |

---

## Locked Decisions

Per RESEARCH.md "User Constraints" (reproduced here as the authoritative, non-negotiable decision set) plus the "Claude's Discretion" answers that RESEARCH resolved. Each decision is treated as LOCKED for this phase.

### D-01 — Renderer: raw Canvas 2D (no engine)
**Why:** Pixi v8 / Phaser / Kaboom add 450 KB – 1.2 MB gzipped for a feature users dismiss 95% of the time. Iso math is ~30 lines; game loop ~40 lines. Restraint keeps maintenance debt tiny. [research §Alternatives Considered, §Don't Hand-Roll]

### D-02 — Do NOT fork pixel-agents
**Why:** Upstream CLAUDE.md confirms the webview is tangled into the VS Code extension's postMessage + terminal spawn — not extractable as a standalone library. Its sprite set is ALSO top-down (JIK-A-4 Metro City), so a perspective change would orphan the art regardless. Port *ideas* (FSM, z-sort, matrix spawn, station composition) — never code. [research §Summary, §Anti-Patterns]

### D-03 — Isometric 2.5D (NOT top-down)
**Why:** UI-SPEC §S4.4 locks "Stardew Valley × Habbo Hotel vibe" — 2:1 diamond projection (TILE_W=64, TILE_H=32) per clintbellanger formulas. [research Pattern 1]

### D-04 — Event source: reuse existing `/api/tail?path=…` SSE
**Why:** Battle-tested, already enforces `ALLOWED_ROOTS` (covers `.cae/metrics`), zero new API surface. Do NOT introduce `/api/floor-events`. [research §Don't Hand-Roll]

### D-05 — State: one React hook + `useRef` scene, NOT Zustand / Redux
**Why:** 60 fps × `setState` = render death. Only coarse UI state (`paused`, `popout`, `reduced`) goes through React state. Per-frame mutations live in `sceneRef.current`. [research Pattern 2, §Anti-Patterns]

### D-06 — Pop-out: child-SSE via `window.open`, NOT postMessage / BroadcastChannel
**Why:** Same-origin child window inherits session cookie + opens its own EventSource. No cross-window plumbing. `window.open('/floor?popout=1', 'cae-live-floor', 'width=960,height=720')`. Two SSE subscribers to the same JSONL is cheap. [research Pattern 3]

### D-07 — Scene composition: 10 stations on a 16×16 diamond grid
**Why:** RESEARCH §Code Examples froze the station coordinate map. Reproduced in `lib/floor/scene.ts`.

```
hub        (8, 8)   persona: nexus       // center
forge      (12, 6)  persona: forge
watchtower (13, 2)  persona: sentinel
overlook   (2, 2)   persona: scout
library    (4, 12)  persona: scribe
shadow     (10, 14) persona: phantom
armory     (14, 10) persona: aegis
drafting   (6, 4)   persona: arch
pulpit     (8, 13)  persona: herald
loadingBay (1, 8)   persona: null
```

### D-08 — Event vocabulary: 6 real events from upstream + synthesized merge/reject
**Why:** Grep of all projects' `circuit-breakers.jsonl` (research 2026-04-22) confirms only these events are emitted: `forge_begin`, `forge_end`, `forge_slot_acquired`, `forge_slot_released`, `sentinel_fallback_triggered`, `sentinel_json_failure`. UI-SPEC desires merge/reject/phantom_escalate/halt animations; Phase 11 MUST synthesize them:

| UI-SPEC animation | Real source event | Synthesis rule |
|-------------------|-------------------|----------------|
| "Task merge → fireworks at hub" | `forge_end` with `success: true` | success-flag derived merge |
| "Sentinel reject → red X" | `forge_end` with `success: false` | success-flag derived reject |
| Forge building pulse | `forge_begin` | direct mapping |
| Sentinel scanning | `sentinel_json_failure` | direct mapping |
| Sentinel alarm | `sentinel_fallback_triggered` | direct mapping |
| Phantom walk | `escalate_to_phantom` | direct if present, else nothing |
| Halt alarm | `halt` | direct if present, else nothing |

The Phantom walk and halt animations are conditionally fired — `mapEvent()` returns `null` for unknown events; unknown events MUST silently drop. [research §Code Examples, §Assumptions Log A3]

### D-09 — Sprites: placeholder solid-color diamond rects in v1
**Why:** No single free pack covers 9 themed iso rooms, and JIK-A-4 is top-down so sprite-sourcing needs a separate polish pass. Do NOT block Phase 11 on art. Ship colored `fill()` rects + text labels; structure the renderer so `sprite.image` swaps in without refactor. [research §Open Questions #1]

### D-10 — Project source: currently-selected project's `circuit-breakers.jsonl`
**Why:** Main window tails the active project (consistent with dashboard globals); pop-out pins to the project it opened from (query-param-captured). [research §Open Questions #2]

### D-11 — Route: `/floor` (full-bleed), not a modal/overlay
**Why:** Navigate-to-route satisfies "overlay" metaphor without modal plumbing. Full dark-bg page keeps the canvas focused. [research §Open Questions #3]

### D-12 — Loading bay (v1): static crate pile + `queue_depth` badge from `/api/state`; pulse only on recent delegation
**Why:** No per-task stream for the bay exists yet. Richer behavior waits for Phase 6's queue SSE. [research §Open Questions #4]

### D-13 — Reduced-motion behavior: skip ephemeral effects, keep passive station tints
**Why:** A frozen scene conveys less than a static-but-status-colored one. Match the `useScreenShake` idiom exactly (`matchMedia` check before each effect spawn). [research §Open Questions #5]

### D-14 — Queue cap (safety): max 500 queued events, max 10 active effects
**Why:** Same class of bug AGENTS.md flagged for Phase 2 `recentFailures` (unbounded arrays). Drop-oldest on overflow. [research §Common Pitfalls #5]

### D-15 — SSE line size cap: reject frames > 4 KB
**Why:** DoS defense matching the Changes aggregator's bounded read patterns. [research §Threat Patterns]

### D-16 — SSE parse safety: try/catch + allowlist `event` field
**Why:** Tampering threat (T-11-01). NEVER spread parsed payload into scene state; only dispatch against the 7-entry allowlist. [research §Threat Patterns]

### D-17 — Middleware: `/floor` added to protected-routes matcher
**Why:** `window.open` on same origin inherits cookie, but belt-and-suspenders auth gate matches the /memory + /metrics pattern. [research §Security Domain]

### D-18 — Dynamic import for floor-canvas with `{ ssr: false }`
**Why:** Canvas APIs don't exist on server; jsdom's `getContext()` returns `null`. Client-only mount. [research §Anti-Patterns]

### D-19 — Icon position: top-nav right cluster BEFORE Memory
**Why:** UI-SPEC §2 calls Live Floor "icon 🎮 in top bar (not a tab)". Matches the existing pattern of MemoryIcon/MetricsIcon/ChatPopOutIcon as right-cluster icon Links (component shell pattern §components/shell). Using `Gamepad2` from lucide-react. Placement: first icon in the right cluster (leftmost of the cluster, before MemoryIcon). [UI-SPEC §2, existing top-nav.tsx structure]

### D-20 — Labels centralization: `floor.*` keys added to `lib/copy/labels.ts`
**Why:** Phase 4's copy-dictionary pattern; every user-visible string passes through `labelFor(dev)` to support explain-mode and dev-mode. [established pattern, labels.ts line 940]

### D-21 — Test framework: Vitest (existing Phase 8 setup)
**Why:** `jsdom` env for component mount smokes; canvas `getContext()` MUST be mocked (jsdom returns `null`). [research §Validation Architecture]

### D-22 — Live Floor is Phase 11 (late); MUST NOT block Phases 1-10
**Why:** UI-SPEC critique #1: "ship Floor AFTER everything else — polish, not core." Confirmed in STATE.md (Phase 10 executing at time of Phase 11 planning). [UI-SPEC §Self-critique pass 2]

---

## Claude's Discretion (within this phase)

The following sub-decisions are NOT locked; executors may choose reasonable defaults as long as the locked decisions above are honored:

- Exact sprite placeholder color palette (pick from existing token palette — `--accent`, `--surface`, agent colors in `agent-meta.ts`)
- Internal layout of the `lib/floor/state.ts` FSM (enum vs. union, as long as it's serializable and testable)
- Background tile pattern (solid, checkerboard, subtle grid — any works)
- Whether to emit a `console.debug` on dropped events in dev mode
- Exact animation timings (suggest: fireworks ~1.2s ttl, redX ~0.8s, pulse 2.0s loop during forge_begin→forge_end pair)
- Camera centering — suggest iso-center at `(canvas.width/2, canvas.height/2 - 80)` so the scene fills a 960×720 popout

---

## Deferred Ideas (OUT OF SCOPE for Phase 11)

Per RESEARCH "Deferred Ideas" — MUST NOT appear in plans:

- **Electron / native popup window** — browser `window.open` is sufficient v1.
- **Visual regression testing** — deferred to Phase 13 (UI-UX review loop).
- **Rich click interactions on canvas** — scene is ambient ("never blocks work"). No click-to-inspect-station. If added later, it's a Phase 12 polish item.
- **Multi-project HQs** — one project at a time (D-10). Multi-project HQs belong in a v2 roadmap.
- **Sound effects / ambient audio** — not in brief, not in UI-SPEC.
- **Drag-and-drop repositioning of stations** — static D-07 coordinates only.
- **Real sprite art sourcing** — placeholder rects v1 (D-09). Art is a separate polish pass.
- **`/api/floor-events` new route** — D-04 mandates reusing `/api/tail`.
- **Zustand / Redux / any store library** — D-05 bans it.

---

## Decision Coverage Matrix

All 22 decisions must have at least one task implementing them across the 5 plans:

| D-XX | Plan | Implementation | Coverage |
|------|------|----------------|----------|
| D-01 | 02 | `components/floor/floor-canvas.tsx` raw Canvas 2D game loop (no engine import) | Full |
| D-02 | (meta) | No dep added; research confirms non-forkability | Full |
| D-03 | 01 | `lib/floor/iso.ts` 2:1 diamond math | Full |
| D-04 | 02 | `floor-canvas.tsx` opens `EventSource('/api/tail?path=…')` | Full |
| D-05 | 02 | `floor-canvas.tsx` uses `sceneRef = useRef(createScene())` | Full |
| D-06 | 03, 04 | `floor-controls.tsx` calls `window.open('/floor?popout=1', ...)`; `/floor?popout=1` opens its own SSE in 04 | Full |
| D-07 | 01 | `lib/floor/scene.ts` exports `STATIONS` with exact coords | Full |
| D-08 | 01 | `lib/floor/event-adapter.ts` `mapEvent()` + 7-event allowlist | Full |
| D-09 | 03 | `lib/floor/renderer.ts` colored-rect placeholder path; `public/floor/README.md` explains future asset swap | Full |
| D-10 | 04 | `app/floor/floor-client.tsx` reads selected project from URL (popout) or `/api/state` (main) | Full |
| D-11 | 04 | `app/floor/page.tsx` full-bleed route | Full |
| D-12 | 01 + 02 | `lib/floor/scene.ts` static crate pile; `mapEvent()` pulse on recent delegation via `queue_depth` delta | Full |
| D-13 | 01 + 02 | `lib/hooks/use-prefers-reduced-motion.ts` matchMedia gate; `event-adapter.ts` tests include reduced-motion → empty-effects assertion | Full |
| D-14 | 02 | `floor-canvas.tsx` caps queue=500, effects=10; `event-adapter.test.ts` tests overflow drop-oldest | Full |
| D-15 | 02 | `floor-canvas.tsx` SSE onmessage rejects `event.data.length > 4096` | Full |
| D-16 | 01 + 02 | `event-adapter.ts` `parseEvent()` try/catch + allowlist; tested; canvas never spreads parsed payload | Full |
| D-17 | 04 | `middleware.ts` matcher adds `/floor` | Full |
| D-18 | 04 | `floor-client.tsx` `dynamic(() => import('./floor-canvas'), { ssr: false })` | Full |
| D-19 | 03 + 04 | `components/shell/floor-icon.tsx` (Plan 03); mounted in `top-nav.tsx` at right-cluster head (Plan 04) | Full |
| D-20 | 01 | `lib/copy/labels.ts` `floor.*` keys added | Full |
| D-21 | 01 + 02 + 03 | Vitest tests for iso/scene/event-adapter/state/canvas-smoke/icon | Full |
| D-22 | (ordering) | Executed as Phase 11 per STATE.md — no implementation task | Full |

All 22 decisions mapped. No decision lands in "Partial". No PHASE SPLIT needed.

---

## Threat Model

### Trust Boundaries

| Boundary | Description |
|----------|-------------|
| JSONL file → SSE → client | Untrusted data crosses: adapters write to circuit-breakers.jsonl; `/api/tail` streams raw lines; client parses JSON |
| Child popout → parent (implicit) | Same-origin; child opens its own auth-gated SSE, no RPC between windows |
| Canvas → DOM | Canvas stays in a single fixed `<canvas>` node; no injection surface into the React tree |

### STRIDE Register

| ID | Category | Component | Disposition | Mitigation Plan |
|----|----------|-----------|-------------|-----------------|
| T-11-01 | Tampering | `lib/floor/event-adapter.ts` `parseEvent()` | mitigate | try/catch `JSON.parse`; dispatch only against the 7-event allowlist (`forge_begin`, `forge_end`, `forge_slot_acquired`, `forge_slot_released`, `sentinel_json_failure`, `sentinel_fallback_triggered`, `escalate_to_phantom`, `halt` — last two conditional-pass-through if present); never spread parsed payload into scene state |
| T-11-02 | DoS | `components/floor/floor-canvas.tsx` event queue | mitigate | cap `queueRef.current.length <= 500` (drop-oldest); cap `sceneRef.current.effects.length <= 10`; reject SSE frames > 4096 bytes |
| T-11-03 | Spoofing | Pop-out window `/floor?popout=1` | mitigate | same-origin only; middleware `/floor` guard; no 3rd-party content, no iframe |
| T-11-04 | Info disclosure | `/api/tail` path argument | accept | Pre-existing mitigation — `app/api/tail/route.ts` enforces `ALLOWED_ROOTS` startsWith check; Phase 11 introduces no new tail targets |
| T-11-05 | DoS | pop-out auth drift | mitigate | Child window polls `/api/state` every 30s; on 401, shows "re-auth in main window" banner + closes SSE |
| T-11-06 | Repudiation | N/A — no audit trail change | N/A | No new logged user actions in this phase |

All mitigations land in Plans 01-04. `security_enforcement` treated as enabled (config absent → default-enabled per GSD).

---

## Why a Fresh CONTEXT (no `/gsd-discuss-phase` ran)

The Phase 11 brief in ROADMAP.md is short; RESEARCH.md explicitly documented the pixel-agents pivot (fork → re-implement) and marked it as the correct call. Rather than introduce ambiguity with a human-interactive discuss pass, the planner treats RESEARCH's "User Constraints" as already-approved decisions and RESEARCH's "Claude's Discretion" answers as the sub-decisions for the phase. This matches the historical pattern: every earlier phase's CONTEXT.md froze decisions BEFORE planning; Phase 11 does the same, just sourced from RESEARCH rather than a live conversation.

If Eric later disagrees with any locked decision (D-01 through D-22), the plans that implement those decisions can be revised before execution — every decision ID is traceable to a specific task in the Decision Coverage Matrix above.
