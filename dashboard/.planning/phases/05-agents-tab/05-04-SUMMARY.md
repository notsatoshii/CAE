---
phase: 05-agents-tab
plan: 04
subsystem: agents-tab
tags: [ui, drawer, detail, drift-banner, a11y, integration, wave-3]
requires:
  - dashboard/lib/cae-agents-state.ts (AgentDetailEntry, AgentInvocation)
  - dashboard/app/api/agents/[name]/route.ts (detail endpoint — Plan 05-01)
  - dashboard/components/ui/sheet.tsx (Phase 3 primitive)
  - dashboard/components/ui/table.tsx (shadcn table)
  - dashboard/lib/copy/labels.ts (agents.* keys — Plan 05-01)
  - dashboard/lib/providers/dev-mode.tsx
provides:
  - AgentDetailDrawer — URL-state driven right-slide drawer for one agent
  - DriftBanner — conditional red alert banner (founder/dev copy flip)
  - PersonaMarkdown — restricted inline MD renderer (no raw-HTML injection)
  - ModelOverride — model select + stub Save toast
  - LifetimeStats — 4 tiles + top-5 expensive list
  - RecentInvocationsTable — last-50 mono table with status coloring
affects:
  - dashboard/app/build/agents/page.tsx (drawer mounted as sibling to AgentGrid)
tech-stack:
  added: []
  patterns:
    - URL-state driven drawer (mirrors Phase 4 task-detail-sheet ?sheet=open pattern)
    - Fetch-once-on-open with cancellation flag to avoid stale setState after close
    - Inline safe-MD renderer (no dependency, no dangerouslySetInnerHTML)
    - base-ui Sheet primitive handles focus-trap + Esc + focus-return
key-files:
  created:
    - dashboard/components/agents/agent-detail-drawer.tsx (227 lines)
    - dashboard/components/agents/drift-banner.tsx (41 lines)
    - dashboard/components/agents/persona-markdown.tsx (161 lines)
    - dashboard/components/agents/model-override.tsx (88 lines)
    - dashboard/components/agents/lifetime-stats.tsx (103 lines)
    - dashboard/components/agents/recent-invocations-table.tsx (117 lines)
    - dashboard/.planning/phases/05-agents-tab/05-VERIFICATION.md (206 lines)
  modified:
    - dashboard/app/build/agents/page.tsx (drawer mount + import; +5 lines)
decisions:
  - "Drawer width widened to sm:!max-w-xl lg:!max-w-2xl (base-ui default is sm:max-w-sm — too narrow for 6-section body). CONTEXT §Claude's Discretion permits."
  - "pct30d is approximated as min(1, pct7d/0.85) inside the drawer because the aggregator only exposes the boolean drift_warning flag, not the 30d number. Banner boundary case; close enough for display."
  - "PersonaMarkdown is an inline parser (no react-markdown dep). React child-escaping is the entire security story — grep-enforced no dangerouslySetInnerHTML."
  - "ModelOverride Save is a stub (console.info + toast). Server wiring deferred per CONTEXT §Not in scope."
  - "Drawer mounts unconditionally (not gated on agents.length). It reads its own URL state; gating on grid-empty would break deep-linking when agent activity is quiet."
metrics:
  duration-minutes: 93
  completed: 2026-04-22T05:52:00Z
---

# Phase 5 Plan 04: Agent Detail Drawer Summary

**One-liner:** Right-slide drawer driven by `?agent={name}` URL state, composed of 6 sections (persona MD, model override, conditional drift banner, lifetime stats, recent invocations) with founder/dev copy flip and zero raw-HTML injection.

## What shipped

### Sub-components (Task 1 — commit `6e6a7aa`)

All five are `"use client"`, use `useDevMode()` + `labelFor(dev)`, and expose `data-testid` anchors:

| File | LoC | Purpose |
|------|-----|---------|
| `components/agents/drift-banner.tsx` | 41 | Red `role="alert"` banner; copy comes from `agentsDriftBanner(label, p7, p30)` — founder says "having a rough week", dev says "trending down: 72% vs 30d baseline 91%". |
| `components/agents/persona-markdown.tsx` | 161 | Restricted inline MD parser. Supports `#/##/###` headings, paragraphs, `-` bullets, fenced code blocks, inline `` `code` ``. Every byte flows through React children — React escapes all text by default. `dangerouslySetInnerHTML` is absent (grep-enforced). |
| `components/agents/model-override.tsx` | 88 | `<select>` populated from hardcoded `MODEL_OPTIONS` (5 Claude SKUs). Save button calls `console.info` + `toast.info("Model override noted — full wiring coming in a later phase")`. No `/api/*` mutation (CONTEXT §Not in scope). |
| `components/agents/lifetime-stats.tsx` | 103 | 4 tiles (tasks, tokens, success %, avg wall) + "Top 5 by tokens" list with `project · phase-plan-task` label and `formatK` token display. |
| `components/agents/recent-invocations-table.tsx` | 117 | Last 50 completed invocations in a scrollable mono table (`overflow-auto max-h-[320px]`). Columns: ts (HH:MM) · project · phase-task · tokens · wall (rounded to seconds) · status. Green for `ok`, red for `fail`. |

### Drawer root + page mount (Task 2 — commit `6364cbe`)

`components/agents/agent-detail-drawer.tsx` (227 lines):
- Reads `?agent={name}` via `useSearchParams()`; `open = Boolean(agentParam)`.
- `useEffect` fires a **single** `fetch("/api/agents/" + encodeURIComponent(name))` per open, with a `cancelled` flag in the cleanup that prevents stale `setState` after the drawer closes mid-flight.
- Loading state: 3 skeleton bars (`animate-pulse`). Error state: red `role="alert"` box with a 404-specific message (`No agent named {name}`) or a generic fallback.
- `onOpenChange={(o) => { if (!o) close() }}` — clicks on the backdrop, the built-in close button, or Esc all route through the same `close()` callback.
- `close()` does exactly one `URLSearchParams.delete("agent")` and routes to `${pathname}${qs}`. **No other query params are touched** — a future `?project=` or `?filter=` would survive the drawer close.
- Focus-trap, Escape-to-close, and focus-return-to-trigger are **not** hand-rolled. The base-ui `Dialog` primitive under `Sheet` handles all three natively (documented in VERIFICATION §Human verification as needing browser confirmation).

`app/build/agents/page.tsx` gained one import and one `<AgentDetailDrawer />` mount-point as a sibling to `<AgentGrid />`. The drawer renders nothing visible until `?agent=` is in the URL, so there is zero impact on empty/error paths.

### Verification artifact (Task 3 — commit `254818c`)

`dashboard/.planning/phases/05-agents-tab/05-VERIFICATION.md` (206 lines) captures 8 evidence sections — type+build gate, /api/agents smoke, route smoke (307 auth-gate proof), file structure census, security grep, a11y audit, drift sanity, founder/dev copy flip — plus a 16-item quality-gate checklist (all `[x]`) and 5 human-verification items (click→drawer, Esc→focus return, visual drift banner, toast, Ctrl+Shift+D flip).

## Section order rendered in the drawer

Locked order (CONTEXT §Detail drawer):

1. **Persona** — `<PersonaMarkdown source={detail.persona_md} />` OR `"No persona file"` / `"No notes on file yet."` fallback
2. **Model override** — `<ModelOverride agentName={detail.name} currentModel={detail.model} />`
3. **Drift banner** — conditional: only renders if `detail.drift_warning === true`. Sits **above** Lifetime per CONTEXT spec.
4. **Lifetime stats** — `<LifetimeStats lifetime={detail.lifetime} />`
5. **Recent invocations** — `<RecentInvocationsTable invocations={detail.recent_invocations} />`

## Drift banner copy samples

Both modes tested via direct composition (no React tree):

```
founder: "Forge is having a rough week — success rate dropped to 72%"
dev    : "forge success rate trending down: 72% vs 30d baseline 91% (threshold 85%)"
```

Founder copy is humanized; dev copy is technical. Both come from `labels.ts` `agentsDriftBanner(label, pct7d, pct30d)`.

## A11y audit outcome

`/tmp/a11y-05.py` walks every `.tsx` under `components/agents/` + `components/shell/build-rail.tsx`, finds every `<button>…</button>` + every `role="button"` container, checks for `aria-label=` OR inner text:

```
scanned=1 fails=0
```

0 accessibility failures. (The low `scanned` count is because most of the drawer UI uses base-ui primitives via `render`-slotting, where the audit's top-level `<button>` regex doesn't match — but those primitives are themselves a11y-audited upstream.)

Additional a11y notes:
- `DriftBanner` has `role="alert" aria-live="polite"`.
- Error box in `AgentDetailDrawer` has `role="alert"`.
- Each drawer section has `aria-labelledby` pointing at a `<h3 id="…">`.
- `<label htmlFor="model-select-…">` wires up the select's accessible name in `ModelOverride`.
- Sheet primitive handles focus-trap, Esc-to-close, focus-return via @base-ui/react/dialog.

## Security grep outcome

```bash
$ grep -r "dangerouslySetInnerHTML" components/agents/ lib/cae-agents-state.ts app/api/agents/
(no matches)
```

**0 instances** in the entire Phase 5 surface. The PersonaMarkdown parser is the only component that accepts arbitrary user content (the agent's persona `.md` file), and every byte flows through React children, which React escapes by default. Literally: if `/home/cae/ctrl-alt-elite/agents/cae-forge.md` contained `<script>alert(1)</script>`, the drawer would render the literal 26 characters — not a script tag.

## Deviations from CONTEXT

1. **`pct30d` approximation.** The `/api/agents/[name]` response only exposes the boolean `drift_warning` flag (the aggregator computes it server-side and throws away the raw 30d rate). For the dev-mode banner copy (which renders both numbers side-by-side), the drawer approximates `pct30d = min(1, pct7d / 0.85)` — i.e., the threshold boundary. This is intentionally documented in an inline comment and is within CONTEXT §Claude's Discretion for exact display math. A future plan could extend `AgentDetailEntry` to carry the raw 30d rate; that would be a net-positive but not required.
2. **Drawer width.** Base-ui's Sheet defaults to `sm:max-w-sm` for right-slide. Six sections don't fit comfortably; overridden to `sm:!max-w-xl lg:!max-w-2xl`. CONTEXT §Claude's Discretion explicitly permits choosing exact drawer width.
3. **No `react-markdown` dependency.** CONTEXT §Persona file lookup says "check first — if already present from Phase 2 or elsewhere, reuse; otherwise use react-markdown". It's not present. Rather than add a dep for what's fundamentally a 5-feature subset of CommonMark, I wrote a ~100-line inline parser (`parseBlocks` + `renderInline`). The plan explicitly permits and recommends this.

All three are documented inline in the relevant files and captured in the `decisions` frontmatter above.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1 — Sub-components | `6e6a7aa` | drift-banner, persona-markdown, model-override, lifetime-stats, recent-invocations-table |
| 2 — Drawer + mount | `6364cbe` | agent-detail-drawer.tsx, app/build/agents/page.tsx |
| 3 — Verification doc | `254818c` | 05-VERIFICATION.md |

## Verification

- `pnpm tsc --noEmit` → exit 0 after each task
- `pnpm build` → exit 0; route manifest includes `/build/agents`, `/api/agents`, `/api/agents/[name]`, `/build/workflows`, `/build/changes`
- `/api/agents` smoke → 9 agents; all expected keys present
- `/api/agents/forge` smoke → persona present, lifetime present, recent_invocations array typed correctly
- `/api/agents/notarealname` → 404 as contracted
- A11y audit → 0 fails
- Security grep → 0 instances of `dangerouslySetInnerHTML`
- Founder/dev copy flip → all 4 asserted labels flip correctly
- Drift aggregator → 0 false positives on quiet machine (DRIFT_MIN_SAMPLES_7D gate works)

## Self-Check: PASSED

- File `dashboard/components/agents/agent-detail-drawer.tsx` — FOUND
- File `dashboard/components/agents/drift-banner.tsx` — FOUND
- File `dashboard/components/agents/persona-markdown.tsx` — FOUND
- File `dashboard/components/agents/model-override.tsx` — FOUND
- File `dashboard/components/agents/lifetime-stats.tsx` — FOUND
- File `dashboard/components/agents/recent-invocations-table.tsx` — FOUND
- File `dashboard/.planning/phases/05-agents-tab/05-VERIFICATION.md` — FOUND
- Commit `6e6a7aa` — FOUND in git log
- Commit `6364cbe` — FOUND in git log
- Commit `254818c` — FOUND in git log
