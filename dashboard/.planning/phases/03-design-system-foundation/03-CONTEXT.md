# Phase 3: Design system foundation + founder-speak copy — Context

**Gathered:** 2026-04-20
**Status:** Ready for planning
**Source:** UI-SPEC.md §Session 4 resolutions (equivalent to PRD Express Path)

<domain>
## Phase Boundary

Phase 3 establishes the foundation every subsequent phase (4-12) depends on:

1. **Visual system** — dark theme tokens, Geist fonts, cyan accent, shadcn-aligned component library
2. **Top-bar refactor** — rename Build/Ops toggle → Plan/Build; add Memory + Metrics as global icon buttons; keep cost ticker
3. **Route reorg** — `/ops/*` → `/build/*` (CAE now owns "Build"); existing `/build/*` placeholders → `/plan/*`; middleware protection updated
4. **Global providers** — ExplainModeProvider (default ON, Ctrl+E toggles) and DevModeProvider (default OFF, ⌘Shift+D toggles)
5. **Screen-shake hook** — accepts Sentinel merge SSE event, respects `prefers-reduced-motion`, subtle amplitude
6. **Founder-speak copy pass** — every existing Phase 1+2 label, button, column header rewritten for non-dev founders per UI-SPEC §Audience reframe

**Not in scope (deferred to later phases):**
- Build Home hierarchy rewrite (Phase 4)
- Agents tab (Phase 5)
- Workflows + Queue redesign (Phase 6)
- Metrics panels (Phase 7)
- Memory browse + Graphify (Phase 8)
- Changes tab + chat rail (Phase 9)
- Plan mode routes (Phase 10)
- Live Floor (Phase 11)
- Command palette (Phase 12)

</domain>

<decisions>
## Implementation Decisions

### Visual system (locked in UI-SPEC §13)

- **Background:** `#0a0a0a` (near-black)
- **Surface:** `#121214` (cards, panels), hover `#1a1a1d`
- **Border:** `#1f1f22` (dividers), strong `#2a2a2e` (input outlines)
- **Text:** primary `#e5e5e5`, muted `#8a8a8c`, dim `#5a5a5c`
- **Accent:** `#00d4ff` (cyan — active state, primary CTA, live indicators), hover `#33deff`, muted `#00d4ff20` (bg tints for active states)
- **Semantic:** success `#22c55e`, warning `#f59e0b`, danger `#ef4444`, info `#3b82f6`
- **Running-pulse:** cyan gradient with 1.5s pulse animation
- **Typography:** Geist Sans 13px base (scale: 14/15/16/20/24/32), Geist Mono 12px for logs/tables/metadata; weights 400 body / 500 UI / 600 headings, never bolder than 700
- **Motion:** Linear-subtle. 150ms ease-out transitions, 80ms hover, 1.5s infinite pulse for live indicators. NO bounce, NO spring, NO parallax.
- **Icons:** Lucide React — 16px UI, 20px tabs, 48px empty-state hero
- **Density:** dense for lists (12-14px padding, 32-40px rows, mono metadata); breathable for detail (24-32px padding, sans 14-16px, generous line-height)

### Mode toggle rename (locked in UI-SPEC §S4.1)

- Old "Build" (Shift placeholder) → new **Plan** — routes `/plan/*`
- Old "Ops" (CAE dashboard) → new **Build** — routes `/build/*`
- Semantic: *Plan the work, then Build it*
- Segmented toggle in top-bar reads `[Plan | Build]`
- Active segment uses cyan accent underline/background

### Top-bar layout (locked in UI-SPEC §S4.2)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ CAE · [Plan|Build]  proj▾   $12.34/48k·today est.  🧠  📊  ⌘K   🟢 live  avatar │
└──────────────────────────────────────────────────────────────────────────────┘
   40px height
```

- Left: CAE wordmark · Plan/Build segmented toggle · project selector (dropdown)
- Middle: cost + token ticker ("$12.34 · 48k tok today" + "est." label)
- Right: Memory icon (🧠) → `/memory` · Metrics icon (📊) → `/metrics` · ⌘K palette trigger · live-heartbeat dot (green=up, amber=degraded, red=halt) · avatar menu

Memory + Metrics are routes (not modals). Keyboard shortcuts `G M` and `G $` (future, Phase 12 polish — not required here).

### Route reorg (locked)

| Old route | New route | Owner |
|-----------|-----------|-------|
| `/build/*` | `/plan/*` | Shift FE (placeholder pages become Plan pages later) |
| `/ops/*` | `/build/*` | CAE FE (all Phase 1+2 Ops work moves here) |
| `/ops/queue` | `/build/queue` | Queue page |
| `/ops/phase/[num]` | `/build/phase/[num]` | Phase detail |
| `/api/tail` | `/api/tail` | unchanged (API routes stay) |
| `/api/state` | `/api/state` | unchanged |
| (new) | `/memory` | Global Memory stub (content later phase) |
| (new) | `/metrics` | Global Metrics stub (content later phase) |

Middleware (currently `middleware.ts`, Next.js 16 will rename to `proxy.ts` — not in scope here) must:
- Protect `/plan/*` + `/build/*` + `/memory` + `/metrics` — redirect unauthenticated to `/signin?from=<path>`
- Leave `/signin`, `/api/auth/*` public

### Global providers (locked in UI-SPEC §S4.6)

**ExplainModeProvider:**
- Default: ON
- Toggle: Ctrl+E (global keyboard listener)
- Persistence: localStorage key `explainMode` (boolean, default true if missing)
- Context value: `{ explain: boolean, toggle: () => void }`
- Consumer pattern: wrap jargon terms in `<ExplainTerm term="SHA">commit hash</ExplainTerm>` which renders tooltip when explain=true, hides when false

**DevModeProvider:**
- Default: OFF
- Toggle: ⌘Shift+D (Mac) / Ctrl+Shift+D (Win/Linux)
- Persistence: localStorage key `devMode` (boolean, default false)
- Context value: `{ dev: boolean, toggle: () => void }`
- Visual indicator: subtle `dev` badge in top-bar when on (cyan outline pill, right of heartbeat)
- Consumer pattern: tabs/labels/components read `dev` to switch between founder-speak and technical labels

Both providers wrap `<body>` in root layout. Both expose hooks (`useExplainMode()`, `useDevMode()`).

### Screen-shake hook (locked in UI-SPEC §S4.6)

- Hook: `useScreenShake()` returns `{ shake: () => void }`
- Target: attaches to `<body>` (or a top-level wrapper)
- Animation: ~150ms CSS keyframes, low amplitude (~2-4px translation, X axis only)
- Trigger in Phase 3: test-only (button in a dev page to verify)
- Phase 9 later wires it to Sentinel merge SSE events
- Respects `prefers-reduced-motion: reduce` → no-op when user opts out

### Founder-speak copy pass (per UI-SPEC §Audience reframe tables)

Scope = every label, button, column header, toast, empty state that exists in Phase 1+2.

**Translation table (applied globally, Dev-mode flips to technical):**

| Dev-speak (old) | Founder-speak (default, explain-mode ON) | Dev-mode label |
|-----------------|------------------------------------------|----------------|
| Ops | Build | Build (same name now) |
| phase | feature | phase |
| wave | step | wave |
| task | job | task |
| Forge | Forge (the builder) | Forge |
| Sentinel | Sentinel (the checker) | Sentinel |
| Scout | Scout (the researcher) | Scout |
| Scribe | Scribe (the memory-keeper) | Scribe |
| merge commit | "shipped" | merge commit |
| SHA | version | SHA |
| branch | version | branch |
| YAML workflow | recipe | YAML workflow |
| circuit breaker halt | "CAE paused itself" | circuit breaker halt |
| token burn | spending | tokens |
| KANBAN cols: Planned/Queued/Building/Reviewing/Blocked/Merged | Waiting / In progress / Double-checking / Stuck (needs you) / Shipped | (keep technical) |
| Memory | Notes (but tab icon + page retain "Memory" as internal name — user-visible tab = "Notes") | Memory |
| Metrics | Spending / How well it's going / How fast (3 panels) | Cost / Reliability / Speed |

**Where copy lives (files to change):**
- Top-bar component
- Left-rail tab icons/tooltips
- `/build/queue` KANBAN column headers
- Phase detail sheet labels
- All button labels
- Empty states

### Emergency brake labeling

Existing Phase 2 has `Pause` / `Abort` as small icon buttons. Reframe calls for a visible "Pause this" button. **Deferred to Phase 4** (Build Home rewrite) where the cards are rebuilt — don't retrofit old card markup.

### Cost ticker "est." label

Top-bar cost ticker must show "est." (estimate) small-caps next to the dollar amount. Tooltip on hover: "Estimates based on local token logs, not Anthropic billing."

### Claude's Discretion

- Exact cubic-bezier easing value for transitions (use Tailwind default `ease-out` or custom — planner picks)
- Component library file/folder structure (`src/components/ui/*` per shadcn convention, assumed)
- Whether to re-theme existing shadcn components in place or replace with custom (recommend: re-theme via CSS variables, not replacement)
- Testing strategy (Playwright for route reorg smoke test recommended; exact implementation up to planner)
- Commit granularity within the phase (one commit per wave vs per task — planner decides)
- Whether to add a temporary `/dev/screen-shake-test` page or test via inline dev trigger

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design law
- `docs/UI-SPEC.md` — full 500+ line design contract. §S4.1–§S4.7 are session 4 resolutions that supersede earlier contradictions. Top-of-doc banner lists all overrides.
- `docs/PRD.md` — product spec (earlier context)
- `docs/ROADMAP.md` — mirror of `.planning/ROADMAP.md`

### Existing implementation (must read to know what to refactor)
- `src/app/layout.tsx` — root layout with auth + providers
- `src/app/(protected)/ops/**` — all Phase 2 Ops routes (will move to `/build/*`)
- `src/app/(protected)/build/**` — Phase 1 Shift placeholder routes (will move to `/plan/*`)
- `src/components/nav/*` — top-bar + mode toggle (will gain Memory/Metrics icons + rename labels)
- `src/middleware.ts` — auth + route protection (update matchers)
- `src/app/globals.css` — Tailwind tokens (replace with dark theme)
- `tailwind.config.ts` — theme extension (add accent/surface tokens)
- `.env.local` — GitHub OAuth creds (do not commit, do not modify)

### Shadcn + Tailwind setup
- Existing `components.json` — shadcn config
- Existing `src/components/ui/*` — shadcn components (audit, may need re-theming)

### Project instructions
- `./CLAUDE.md` if exists — follow project-specific guidelines
- `.claude/skills/cae-forge/SKILL.md` — executor skill (Forge persona/rules)
- `.claude/skills/cae-arch/SKILL.md` — planner skill (Arch persona/rules)

</canonical_refs>

<specifics>
## Specific Ideas

### Re-theming strategy

Recommended approach (non-binding on planner):
1. Extend Tailwind theme with semantic CSS variables (`--bg`, `--surface`, `--accent`, etc.) in `globals.css`
2. Update `tailwind.config.ts` to map Tailwind class names to those variables
3. Existing shadcn components pick up new theme automatically via CSS variable changes
4. Only replace shadcn components if their markup fundamentally conflicts with spec density/layout

### Geist fonts

- Package: `@next/font/google` via Next.js font loader OR `next/font/google` import
- Geist Sans: primary
- Geist Mono: for log tail, metrics tables, metadata chips
- Apply via CSS variables (`--font-sans`, `--font-mono`) referenced by Tailwind theme

### Middleware gotcha

Next.js 16 is deprecating `middleware` → `proxy` nomenclature. Keep existing `middleware.ts` filename for now (deprecation warning tolerable); the rename is a separate concern and out of Phase 3 scope.

### Route reorg migration

To avoid broken links:
- Move file contents, not copies (git mv)
- Add temporary redirect rules in middleware or Next.js config from old `/ops/*` → new `/build/*` so any bookmarks still work (can remove after Phase 12 polish)
- Or just hard-swap and accept broken bookmarks (this is pre-launch, no public users)
- Planner should pick: hard-swap is simpler

### ExplainMode consumer example

```tsx
// Before (hardcoded):
<span>Forge</span>

// After:
<ExplainTerm term="Forge" definition="The builder agent — does the actual coding">
  Forge
</ExplainTerm>
// Renders plain "Forge" text; on hover shows tooltip with definition when explainMode=true.
```

### DevMode consumer example

```tsx
import { useDevMode } from '@/lib/providers/dev-mode'

function QueueColumnHeader({ column }) {
  const { dev } = useDevMode()
  const labels = dev ? TECHNICAL_LABELS : FOUNDER_LABELS
  return <h3>{labels[column]}</h3>
}
```

### Founder-speak file targets (from Phase 1+2 grep)

- `src/components/nav/mode-toggle.tsx` — swap Build/Ops labels
- `src/components/ops/phase-card.tsx` — "phase" → "feature"
- `src/app/(protected)/ops/queue/page.tsx` — KANBAN column headers
- `src/components/ops/breaker-panel.tsx` — "circuit breaker" → "CAE paused itself"

(Exact file list to be confirmed by planner via grep — these are sample paths.)

</specifics>

<deferred>
## Deferred Ideas

- **Build Home hierarchy rewrite** → Phase 4
- **Live Ops one-liner** (pinned above Active Phases) → Phase 4
- **Agents tab + sparklines** → Phase 5
- **KANBAN card layout rework** → Phase 6 (Workflows + Queue redesign)
- **Memory tab browse + graph** → Phase 8
- **Right-rail chat** → Phase 9
- **Plan mode routes content** (not just shell) → Phase 10
- **Live Floor** → Phase 11
- **Command palette** → Phase 12
- **Explain-mode hover tooltip styling** can ship in Phase 3, but per-term dictionary may grow in later phases
- **Middleware → proxy rename** → Phase 12 polish
- **`next lint` CLI migration** → Phase 12 polish
- **Nexus VOICE.md** → Phase 9 (chat phase) — not needed for Phase 3

</deferred>

---

*Phase: 03-design-system-foundation*
*Context gathered: 2026-04-20 via PRD Express Path (UI-SPEC.md §S4 as PRD)*
