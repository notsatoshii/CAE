# UI Audit — Wave 6c: Memory / Metrics / Chat / Plan / Signin

**Scope:** 5 surfaces (memory browse+graph+drawers, metrics 3 panels + incident stream, chat, plan home, signin)
**Plan:** 13-11
**Date:** 2026-04-23
**Cross-reference:** audit/UI-AUDIT-visual-pillars.md (master audit from plan 13-09)

---

## Rubric (V2 §6 — 6 pillars, score 1–4)

| Pillar | 4 | 3 | 2 | 1 |
|--------|---|---|---|---|
| 1 Hierarchy | Single clear focus, ≤2 weights | Clear, minor confusion | Competing foci | No hierarchy |
| 2 Density | All 8pt, rows 32-40px | Mostly 8pt, 1-2 deviations | Arbitrary values | No grid |
| 3 Consistency | 100% same action=same visual, Lucide-only | 1-2 divergences | Systematic inconsistency | Random |
| 4 Motion | Full prefers-reduced-motion respect | Minor edge case | Pulse persists | Ignores |
| 5 Typography | All on scale {13,14,15,16,20,24,32}px | 1-2 off-scale | Arbitrary sizes | Wrong font |
| 6 Color | All WCAG AA | 1-2 non-body fails | Body copy fails | Multiple body fails |

---

## Surface Scores — Before → After (Plan 13-11)

| Surface | Hierarchy | Density | Consistency | Motion | Typography | Color | Worst |
|---------|-----------|---------|-------------|--------|------------|-------|-------|
| Memory browse | 3→3 | 3→3 | 3→3 | 4→4 | 3→3 | 2→3 | 2→3 |
| Memory graph | 3→3 | 3→3 | 3→3 | 4→4 | 3→3 | 3→3 | 3→3 |
| Memory why-drawer | 3→3 | 3→3 | 3→3 | 4→4 | 2→3 | 2→3 | 2→3 |
| Memory node-drawer | 3→3 | 3→3 | 3→3 | 4→4 | 3→3 | 2→3 | 2→3 |
| Metrics spending | 3→3 | 3→3 | 3→4 | 4→4 | 3→3 | 2→3 | 2→3 |
| Metrics reliability | 3→3 | 3→3 | 3→4 | 4→4 | 3→3 | 2→3 | 2→3 |
| Metrics speed | 3→3 | 3→3 | 3→4 | 4→4 | 3→3 | 3→3 | 3→4 |
| Incident stream | 3→3 | 3→3 | 3→4 | 4→4 | 2→3 | 2→3 | 2→3 |
| Chat rail | 3→3 | 3→3 | 3→3 | 4→4 | 3→3 | 3→3 | 3→3 |
| Chat panel | 3→3 | 3→3 | 3→4 | 4→4 | 3→3 | 2→3 | 2→3 |
| Chat messages | 2→3 | 3→3 | 2→3 | 4→4 | 2→3 | 2→3 | 2→3 |
| Plan home | 2→3 | 3→3 | 3→3 | 4→4 | 2→3 | 3→3 | 2→3 |
| Signin | 3→4 | 3→3 | 3→4 | 4→4 | 2→3 | 3→4 | 2→3 |

**All surfaces now score ≥3 on every pillar. Must-have truth satisfied.**

---

## Per-Surface Fix Inventory

### /memory — Browse (file-tree.tsx)

| Finding | Before | Fix | File |
|---------|--------|-----|------|
| Indent 12px/level too tight | Depth-2 nodes illegible | 16px/level (`depth * 16`) | `browse/file-tree.tsx` |
| File counts no tabular-nums | Layout shift on update | `font-mono tabular-nums shrink-0` | `browse/file-tree.tsx` |

### /memory — Graph (graph-pane.tsx, graph-filters.tsx)

| Finding | Before | Fix | File |
|---------|--------|-----|------|
| Loading state = plain text, indistinct from error | Same visual as error | Skeleton shimmer `animate-pulse motion-reduce:animate-none` + label | `graph/graph-pane.tsx` |
| Filter chip counts use text-dim | WCAG SC 1.4.3 fail | `text-muted` | `graph/graph-filters.tsx` |

**Pillar 4 (Motion) — Memory graph reducedMotion behavior:**
- Loading skeleton: uses `motion-reduce:animate-none` inline to suppress shimmer. Full `@media (prefers-reduced-motion: reduce)` coverage from globals.css safety net also applies.
- Empty/cooldown/loading states are now visually distinct: skeleton = animate-pulse shapes + text label; empty = EmptyState icon+heading+CTA; error = danger-colored text.

### /memory — Why Drawer (why-drawer.tsx)

| Finding | Before | Fix | File |
|---------|--------|-----|------|
| h2 text-sm font-medium | Off-scale (14px), too light | `text-[15px] font-semibold` | `why-drawer.tsx` |
| Drawer padding p-4 | Below UI-SPEC §13 minimum | `p-6` (24px) | `why-drawer.tsx` |
| Timestamps text-dim at 10px | WCAG fail (2.7:1) | `text-muted` + `font-mono` | `why-drawer.tsx` |
| Dev note italic text-dim | WCAG fail at 10px | `text-muted` | `why-drawer.tsx` |

### /memory — Node Drawer (node-drawer.tsx)

| Finding | Before | Fix | File |
|---------|--------|-----|------|
| Back-link empty "—" text-dim | Low contrast | `text-muted` | `graph/node-drawer.tsx` |
| Forward-ref empty "—" text-dim | Low contrast | `text-muted` | `graph/node-drawer.tsx` |
| Relation labels text-dim | Low contrast on supplementary text | `text-muted` | `graph/node-drawer.tsx` |

### /metrics — All Panels (spending, reliability, speed)

| Finding | Before | Fix | File |
|---------|--------|-----|------|
| Each panel had unique chrome | Pillar 3 violation | Shared `<Panel>` wrapper (rounded-lg border bg-surface p-6, h2 15px semibold) | `ui/panel.tsx` |
| h2 text-lg (18px) | Off design-scale | `text-[15px] font-semibold` via Panel | `ui/panel.tsx` |
| Golden signals subtitle text-dim 11px | P2-06 finding | `text-muted` + `12px` | `metrics/golden-signals-subtitles.tsx` |

### /metrics — Incident Stream (incident-stream.tsx)

| Finding | Before | Fix | File |
|---------|--------|-----|------|
| "Gateway healthy." text-dim (P1-09) | WCAG fail | `text-muted` | `shell/incident-stream.tsx` |
| Timestamp text-dim on event rows | WCAG fail | `text-muted` | `shell/incident-stream.tsx` |
| Event count text-dim | WCAG fail | Moved to Panel subtitle (text-muted) | `shell/incident-stream.tsx` |
| No shared panel chrome | Pillar 3 divergence | Wrapped in `<Panel>` | `shell/incident-stream.tsx` |

### /chat — Messages (message.tsx)

| Finding | Before | Fix | File |
|---------|--------|-----|------|
| User/assistant same visual treatment | Pillar 3 fail | User: right-aligned, accent/10 bg + border; assistant: left-aligned bg-elev | `chat/message.tsx` |
| No max-width on bubbles | Long lines unconstrained | `max-w-[65ch]` | `chat/message.tsx` |
| No padding in bubble | Pillar 2 fail | `p-3 rounded-lg` | `chat/message.tsx` |
| Role label + timestamp at text-dim | WCAG fail | `text-muted` throughout | `chat/message.tsx` |
| No avatar on assistant | Pillar 3 inconsistency | Emoji avatar outside bubble, left side | `chat/message.tsx` |
| Streaming caret no reduced-motion | P1 motion | `motion-reduce:animate-none` | `chat/message.tsx` |

### /chat — Panel (chat-panel.tsx)

| Finding | Before | Fix | File |
|---------|--------|-----|------|
| Empty state single-line muted text | Indistinct from loading | Centered heading + sub-copy | `chat/chat-panel.tsx` |
| Textarea placeholder text-dim | WCAG fail | `text-muted` | `chat/chat-panel.tsx` |
| Textarea text-sm | Off-scale (14px) | `text-[15px]` | `chat/chat-panel.tsx` |

### /plan — Home (app/plan/page.tsx)

| Finding | Before | Fix | File |
|---------|--------|-----|------|
| p-8 max-w-3xl only, no hierarchy below heading | Pillar 1 fail | Added 15px sub-copy + coming-soon tabs preview strip | `app/plan/page.tsx` |
| No contextual information about what Plan mode is | Confusion | Value copy: "Projects, PRDs, Roadmaps, UAT" | `app/plan/page.tsx` |

### /signin (app/signin/page.tsx, github-sign-in-button.tsx)

| Finding | Before | Fix | File |
|---------|--------|-----|------|
| Default `bg-card` / `text-muted-foreground` shadcn tokens | Inconsistent with CSS var palette | `bg-[color:var(--surface)]`, `text-[color:var(--text-muted)]` | `app/signin/page.tsx` |
| No background treatment | Feels like default Next.js | Radial gradient `--accent/5 blur-3xl` | `app/signin/page.tsx` |
| h1 "CAE" text-3xl (30px) | Off design-scale | `text-[32px] font-semibold` | `app/signin/page.tsx` |
| Value prop text-sm (14px) | Off-scale | `text-[15px] leading-relaxed` | `app/signin/page.tsx` |
| Sign-in button `bg-primary` shadcn token, no icon | Generic, low contrast | `bg-accent text-black` (10:1+), Lucide `<Github>` icon, `py-3 w-full` | `github-sign-in-button.tsx` |
| No footer | Empty bottom of card | `© {year} Ctrl+Alt+Elite` at 11px text-muted | `app/signin/page.tsx` |

**WCAG AA on GitHub button (T-13-11-01 mitigate):**
- Text: `text-black` (#0a0a0a) on `--accent` (#00d4ff) → ~10.8:1 (exceeds 4.5:1 WCAG SC 1.4.3 ✓)
- Border: `border-[color:var(--accent)]` on `--surface` (#111113) → 3:1+ for UI components (WCAG SC 1.4.11 ✓)
- Min touch target: `py-3 w-full` → ≥48px height on standard viewport (WCAG 2.5.8 ✓)
- Auth flow: `signIn("github")` call preserved unchanged — no functional change (T-13-11-01 ✓)

---

## Shared Panel Component — Adoption Summary

`components/ui/panel.tsx` adopted by 4 components:

| Component | Panel usage |
|-----------|-------------|
| `spending-panel.tsx` | 4 states (error, loading, empty, loaded) |
| `reliability-panel.tsx` | 4 states |
| `speed-panel.tsx` | 4 states |
| `incident-stream.tsx` | Single always-visible panel |

Panel provides: `rounded-lg border border-[--border] bg-[--surface] p-6`, h2 at `text-[15px] font-semibold`, optional subtitle at `text-[12px] text-muted`, `aria-labelledby` wired automatically.

---

## Wave 7 Regression Risks

1. **Chat bubble max-width on narrow mobile:** `max-w-[65ch]` ≈ 650px — clips gracefully on 375px viewport since bubbles are in a constrained pane. Monitor on real mobile viewport (flagged for 13-12 regression check).
2. **Signin radial gradient on low-power devices:** `blur-3xl` on a 600px div can be GPU-intensive on old mobile. Mitigated by `pointer-events-none` (no interaction cost) and `overflow-hidden` on parent. No `@media (prefers-reduced-motion)` needed (CSS filter, not animation).
3. **Plan home tab preview misleading:** The greyed tab row (`opacity-40`) could confuse users who try to click them. They are `aria-hidden="true"` so screen readers skip them, and they have no click handler. Acceptable as visual preview; real tabs will replace in Phase 10.
4. **incident-stream Panel subtitle dynamic text:** The subtitle updates each time an event arrives (event count string). This is a live region update not wrapped in `aria-live`. Low severity — the panel heading is the primary landmark; count is supplementary. Flag for 13-12.

---

*Cross-reference: UI-AUDIT-visual-pillars.md — appended as Post-fix Update (13-11) per document version note.*

## Post-fix Update (13-11)

All surfaces assigned to plan 13-11 now score ≥3 on every pillar. P0-01 text-dim violations in all 13-11 scope files resolved. P1-09, P1-10, P2-06, P2-07 findings closed.
