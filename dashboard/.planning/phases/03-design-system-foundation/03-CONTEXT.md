# Phase 3: Design system foundation + founder-speak copy — Context

**Gathered:** 2026-04-20
**Revised:** 2026-04-21 (cost ticker → tokens-only; added shadcn primitives Dialog / Sonner / ScrollArea)
**Status:** Ready for planning
**Source:** UI-SPEC.md §Session 4 resolutions (equivalent to PRD Express Path)

<domain>
## Phase Boundary

Phase 3 establishes the foundation every subsequent phase (4-12) depends on:

1. **Visual system** — dark theme tokens, Geist fonts, cyan accent, shadcn-aligned component library (Dialog + Sonner + ScrollArea primitives land this phase too)
2. **Top-bar refactor** — rename Build/Ops toggle → Plan/Build; add Memory + Metrics as global icon buttons; keep cost ticker (tokens-only, no USD — see §Cost ticker below)
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

### Component library primitives (ROADMAP Phase 3 line 56)

The following shadcn primitives MUST exist in `components/ui/` by the end of Phase 3:

Button, Card, Tabs, **Dialog**, Sheet, **Sonner (Toast)**, DropdownMenu, **ScrollArea**, Separator, Avatar, Badge, Input, Label, Table, Textarea.

Already present (from Phase 1+2): Button, Card, Tabs, Sheet, DropdownMenu, Separator, Avatar, Badge, Input, Label, Table, Textarea.

**Missing and must be added this phase:** Dialog, Sonner (Toast), ScrollArea.

Install via `pnpm dlx shadcn@latest add dialog sonner scroll-area`. Verify each generated file imports `cn` from `@/lib/utils` and uses CSS-variable based classes so Plan 01's dark-theme tokens apply automatically.

### Mode toggle rename (locked in UI-SPEC §S4.1)

- Old "Build" (Shift placeholder) → new **Plan** — routes `/plan/*`
- Old "Ops" (CAE dashboard) → new **Build** — routes `/build/*`
- Semantic: *Plan the work, then Build it*
- Segmented toggle in top-bar reads `[Plan | Build]`
- Active segment uses cyan accent underline/background

### Top-bar layout (locked in UI-SPEC §S4.2)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ CAE · [Plan|Build]  proj▾   48k tok today · est.   🧠  📊  ⌘K   🟢 live  avatar │
└──────────────────────────────────────────────────────────────────────────────┘
   40px height
```

- Left: CAE wordmark · Plan/Build segmented toggle · project selector (dropdown — Phase 4)
- Middle: token ticker ("48k tok today" + small-caps "est." label). **No dollar amount.** We use Anthropic OAuth subscription, not metered billing; USD estimates would be misleading.
- Right: Memory icon (🧠) → `/memory` · Metrics icon (📊) → `/metrics` · ⌘K palette trigger (Phase 12) · live-heartbeat dot (green=up, amber=degraded, red=halt) · avatar menu

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

### Shared /api/state polling hook

`CostTicker` and `HeartbeatDot` both poll `/api/state`. Rather than each running its own `setInterval`, they share a single poll via `lib/hooks/use-state-poll.ts`:

- Public API: `useStatePoll(projectPath?: string): { data: StateResponse | null, error: Error | null }`
- Internals: React context provider wraps the app; a single `setInterval(poll, 3000)` lives in the provider; consumers subscribe via `useContext`.
- OR: a singleton in-module cache with a subscriber set — same practical effect, no provider required.
- Planner may pick either shape. Outcome: **one network request per 3s serves every subscriber**, not N.

The provider (if used) is mounted in root layout alongside ExplainMode + DevMode so any client component in the tree can call `useStatePoll()`.

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

**Page-level headings must flip with devMode.** Server components cannot read React context, so each server page that renders a user-visible heading must extract that heading into a small client-island subcomponent (e.g. `BuildHomeHeading`, `PhaseDetailHeading`). The server page fetches data and passes it to the client-island as props; the island calls `useDevMode()` and picks the label via `labelFor(dev)`. Pattern documented in Plan 05.

### Emergency brake labeling

Existing Phase 2 has `Pause` / `Abort` as small icon buttons. Reframe calls for a visible "Pause this" button. **Deferred to Phase 4** (Build Home rewrite) where the cards are rebuilt — don't retrofit old card markup.

### Cost ticker "est." label (REVISED 2026-04-21 — tokens only, no USD)

We use Anthropic OAuth subscription billing, not metered per-call. Showing estimated USD would be misleading.

**CostTicker behavior:**
- Shows: `{input_tokens + output_tokens} tok today` (e.g. `48k tok today`)
- Small-caps `est.` label remains beside the number
- **No `$` symbol anywhere in the component.**
- **No hardcoded token rates anywhere in the codebase.** No `lib/cae-config.ts` rate entry. No `estimateUsd()` function. Nothing converts tokens → dollars.
- Tooltip on hover: `Token usage from local logs. OAuth subscription — not billed per call.`
- Top-bar slot shrinks to fit — `48k tok today · est.` is shorter than the old `$12.34 · 48k tok today · est.` so layout breathes.

### Claude's Discretion

- Exact cubic-bezier easing value for transitions (use Tailwind default `ease-out` or custom — planner picks)
- Component library file/folder structure (`components/ui/*` per shadcn convention)
- Whether to re-theme existing shadcn components in place or replace with custom (recommend: re-theme via CSS variables, not replacement)
- Shape of `use-state-poll` hook (context provider vs module singleton — planner picks)
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
- `app/layout.tsx` — root layout with auth + providers
- `app/ops/**` — all Phase 2 Ops routes (will move to `/build/*`)
- `app/build/**` — Phase 1 Shift placeholder routes (will move to `/plan/*`)
- `components/shell/*` — top-bar + mode toggle (will gain Memory/Metrics icons + rename labels)
- `middleware.ts` — auth + route protection (update matchers)
- `app/globals.css` — Tailwind v4 inline config (replace with dark theme)
- `.env.local` — GitHub OAuth creds (do not commit, do not modify)

### Shadcn + Tailwind setup
- Existing `components.json` — shadcn config
- Existing `components/ui/*` — shadcn components (audit, may need re-theming; add dialog / sonner / scroll-area)

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
2. `app/globals.css` uses Tailwind v4 `@theme inline { ... }` (no `tailwind.config.ts` file)
3. Existing shadcn components pick up new theme automatically via CSS variable changes
4. Only replace shadcn components if their markup fundamentally conflicts with spec density/layout

### Geist fonts

- Package: `next/font/google` Geist + Geist_Mono loaders already wired in `app/layout.tsx`
- Apply via CSS variables (`--font-geist-sans`, `--font-geist-mono`) referenced by Tailwind `@theme` block
- Plan 01 adds the `@theme inline` mappings (`--font-sans: var(--font-geist-sans)`, etc.)

### Middleware gotcha

Next.js 16 is deprecating `middleware` → `proxy` nomenclature. Keep existing `middleware.ts` filename for now (deprecation warning tolerable); the rename is a separate concern and out of Phase 3 scope.

### Route reorg migration

To avoid broken links:
- Move file contents, not copies (git mv)
- Hard-swap and accept broken bookmarks (this is pre-launch, no public users) — this is the chosen path
- No backward-compat redirects from old `/ops/*`

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
import { labelFor } from '@/lib/copy/labels'

function QueueColumnHeader({ column }) {
  const { dev } = useDevMode()
  const t = labelFor(dev)
  return <h3>{column === 'planned' ? t.queueInboxHeading : /* ... */}</h3>
}
```

### Server-page headings as client islands

Per §Founder-speak copy pass: server pages cannot flip with devMode. Extract headings into `"use client"` subcomponents:

```tsx
// app/build/page.tsx (server component — unchanged structure)
import { BuildHomeHeading } from '@/components/shell/build-home-heading'

export default async function BuildHomePage() {
  const project = await getCurrentProject()
  return (
    <main>
      <BuildHomeHeading projectName={project.name} />
      {/* rest of server-rendered list */}
    </main>
  )
}
```

```tsx
// components/shell/build-home-heading.tsx
"use client"
import { useDevMode } from '@/lib/providers/dev-mode'
import { labelFor } from '@/lib/copy/labels'
export function BuildHomeHeading({ projectName }: { projectName: string }) {
  const { dev } = useDevMode()
  return <h1>{labelFor(dev).buildHomeHeading(projectName)}</h1>
}
```

Four such islands required: `BuildHomeHeading`, `BuildQueueHeading`, `PhaseDetailHeading`, `PlanHomeHeading`.

### Founder-speak file targets (from Phase 1+2 grep)

- `components/shell/mode-toggle.tsx` — swap Build/Ops labels (done in Plan 03)
- `app/build/phases-list.tsx` — column headers
- `app/build/queue/page.tsx` — KANBAN column headers
- `app/build/breakers-panel.tsx` — "circuit breaker" → "CAE paused itself"
- Heading extraction into client-islands per §Server-page headings above

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
- **USD cost estimates** — never. OAuth subscription billing, not metered.

</deferred>

---

*Phase: 03-design-system-foundation*
*Context gathered: 2026-04-20 via PRD Express Path (UI-SPEC.md §S4 as PRD)*
*Revised: 2026-04-21 — tokens-only cost ticker, shadcn primitives, shared polling hook, heading client-islands*
