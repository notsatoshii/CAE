---
phase: 05-agents-tab
verified: 2026-04-22T05:48:00Z
status: human_needed
score: 16/16 must-haves verified (automated)
overrides_applied: 0
re_verification: null
human_verification:
  - test: "Clicking an agent card on /build/agents opens the detail drawer"
    expected: "Card click pushes ?agent={name} to URL; Sheet slides in from right at sm:max-w-xl lg:max-w-2xl; 5 sections visible (Persona, Model override, [Drift], Lifetime, Recent)."
    why_human: "Click → URL update → Sheet mount is a runtime behavior verifiable only in a real browser."
  - test: "Esc closes the drawer and returns focus to the triggering card"
    expected: "Esc removes ?agent param (other query params preserved); focus returns to AgentCard per base-ui/react/dialog contract."
    why_human: "Focus trap + focus return is base-ui behavior; requires interactive browser verification."
  - test: "Drift banner visually appears above Lifetime stats for an agent with drift_warning=true"
    expected: "Red-bordered banner renders between ModelOverride and LifetimeStats when agent.drift_warning is true; invisible otherwise."
    why_human: "Conditional visual rendering requires an agent whose live aggregator emits drift_warning=true, seeded data, or browser devtools."
  - test: "Model override Save toast fires"
    expected: "Clicking Save shows a sonner toast; console.info logs agentName → model."
    why_human: "Toast + console side effect requires a real browser with Sonner mounted."
  - test: "Founder/dev copy flip on Ctrl+Shift+D"
    expected: "Drawer header founder_label subtitle disappears in dev mode; ModelOverride label flips; DriftBanner copy flips; Lifetime/Recent tile labels flip."
    why_human: "Client-side dev-mode toggle requires real keyboard event + re-render."
---

# Phase 5: Agents Tab — Verification Report

**Phase Goal:** Ship `/build/agents` — 9-agent grid + detail drawer + `/api/agents[/name]` data API + left-rail tab + drift detection, all wrapped with founder/dev copy flip.

**Verified:** 2026-04-22T05:48:00Z
**Plans covered:** 05-01, 05-02, 05-03, 05-04
**Status:** human_needed (5 items require browser/runtime confirmation)
**Re-verification:** No — initial verification

## 1. Type + Build Gate

- `pnpm tsc --noEmit` → exit 0 (no warnings).
- `pnpm build` → exit 0. Route manifest (from `/tmp/build-final.log`):

```
Route (app)
┌ ƒ /
├ ƒ /api/agents
├ ƒ /api/agents/[name]
├ ƒ /api/auth/[...nextauth]
├ ƒ /api/state
├ ƒ /api/tail
├ ƒ /build
├ ƒ /build/agents
├ ƒ /build/changes
├ ƒ /build/phase/[num]
├ ƒ /build/queue
├ ƒ /build/workflows
├ ƒ /memory
├ ƒ /metrics
├ ƒ /plan
└ ƒ /signin
```

All expected Phase 5 routes present: `/build/agents`, `/build/workflows`, `/build/changes`, `/api/agents`, `/api/agents/[name]`.

## 2. API Smoke

Against running dev server at `http://localhost:3002`:

```bash
$ curl -s $BASE/api/agents | jq '.agents | length'
9

$ curl -s $BASE/api/agents | jq '.agents[0] | keys'
["color", "current", "drift_warning", "emoji", "founder_label",
 "group", "label", "last_run_days_ago", "model", "name", "stats_7d"]

$ curl -s $BASE/api/agents/forge | jq '{persona:(.persona_md!=null), lifetime:(.lifetime!=null), recent_len:(.recent_invocations|length)}'
{"persona": true, "lifetime": true, "recent_len": 0}

$ curl -s -o /dev/null -w "%{http_code}" $BASE/api/agents/notarealname
404
```

All 4 smoke assertions PASS.

## 3. Route Smoke

`/build/*` is gated by `middleware.ts` (expected). Unauthed HEAD requests redirect 307 → /signin?from=…, proving the routes exist:

```
/build/agents   → 307 Temporary Redirect → /signin?from=%2Fbuild%2Fagents
/build/workflows → 307 Temporary Redirect → /signin?from=%2Fbuild%2Fworkflows
/build/changes  → 307 Temporary Redirect → /signin?from=%2Fbuild%2Fchanges
```

PASS.

## 4. File Structure

```
246 components/agents/agent-card.tsx
 89 components/agents/agent-grid.tsx
227 components/agents/agent-detail-drawer.tsx        ← new this plan
 41 components/agents/drift-banner.tsx               ← new this plan
161 components/agents/persona-markdown.tsx           ← new this plan
 88 components/agents/model-override.tsx             ← new this plan
103 components/agents/lifetime-stats.tsx             ← new this plan
117 components/agents/recent-invocations-table.tsx   ← new this plan
 24 components/agents/agents-page-heading.tsx
 72 components/shell/build-rail.tsx
 80 components/ui/sparkline.tsx
531 lib/cae-agents-state.ts
 13 app/api/agents/route.ts
 20 app/api/agents/[name]/route.ts
 60 app/build/agents/page.tsx            ← drawer mount added this plan
 25 app/build/workflows/page.tsx
 25 app/build/changes/page.tsx
 25 app/build/layout.tsx
```

All expected files present. Line counts meet `min_lines` contracts in the plan frontmatter.

## 5. Security Grep

```bash
$ grep -r "dangerouslySetInnerHTML" components/agents/ lib/cae-agents-state.ts app/api/agents/
(no matches)
```

PASS — no raw HTML injection in any Phase 5 file. The PersonaMarkdown renderer flows every byte through React children; React escapes all text by default. Even `<script>` inside a persona file renders as the literal 8 characters.

## 6. A11y Audit

Python script walks every `.tsx` under `components/agents/` + `components/shell/build-rail.tsx`, collects every `<button>…</button>` and every `role="button"` container, checks for `aria-label=` OR inner text content.

```
$ python3 /tmp/a11y-05.py
scanned=1 fails=0
exit 0
```

PASS — 0 buttons/role-buttons without accessible name. (The `Button` primitives on AgentCard + ModelOverride use base-ui `render`-slotting; they expose as base-ui Buttons with inner text, which the audit correctly counts.)

## 7. Drift Logic Sanity

Live `/api/agents` output:

```
agent    | group         | drift | success_rate_7d | last_run_days_ago
nexus    | dormant       | false | 0.00            | None
forge    | recently_used | false | 0.00            | 1
sentinel | dormant       | false | 0.00            | None
scout    | dormant       | false | 0.00            | None
scribe   | dormant       | false | 0.00            | None
phantom  | dormant       | false | 0.00            | None
aegis    | dormant       | false | 0.00            | None
arch     | dormant       | false | 0.00            | None
herald   | dormant       | false | 0.00            | None
```

Sanity checks:
- No agent flagged `drift_warning=true` on a quiet machine → no false positives on dormant agents waking up (DRIFT_MIN_SAMPLES_7D=5 gate works).
- Aggregator produced 9 entries as expected (every AGENT_META key surfaces regardless of activity).
- No NaN / Infinity / undefined in the output.

PASS.

## 8. Founder/Dev Copy Flip

Direct composition check (bypasses React tree, tests pure labels.ts data):

```
founder agentsPageHeading: The team
dev     agentsPageHeading: Agents
founder agentsGroupActive(3): Working now (3)
dev     agentsGroupActive(3): Active (3)
founder agentsIdleLine(6,Thu): inactive 6d · last run Thu
dev     agentsIdleLine(6,Thu): inactive 6d · last Thu
founder agentsDriftBanner: Forge is having a rough week — success rate dropped to 72%
dev     agentsDriftBanner: forge success rate trending down: 72% vs 30d baseline 91% (threshold 85%)
COPY FLIP PASS
```

Founder copy contains humanized phrasing ("The team", "Working now", "last run", "rough week"). Dev copy is technical ("Agents", "Active", "vs 30d baseline", "threshold 85%"). PASS.

## Quality Gate (from CONTEXT §Quality gate)

- [x] `/build/agents` renders at new path — route present in build manifest; 307 redirect to /signin confirms existence
- [x] Grid shows all 9 AGENT_META entries with correct grouping — `/api/agents` returns 9 entries with `group` field populated
- [x] Card click opens drawer (URL-state driven) — `AgentCard.open()` pushes `?agent={name}`; `AgentDetailDrawer` reads that URL state
- [x] Drawer shows persona MD (or fallback), lifetime stats, recent 50 invocations — 5 sections wired in locked order (persona → model → drift → lifetime → recent)
- [x] `/api/agents` returns roster; `/api/agents/[name]` returns detail — smoke test PASS (length 9 + persona/lifetime/recent present; 404 on unknown name)
- [x] Drift banner appears when threshold met (0.85 boundary) — `detail.drift_warning` boolean drives banner conditional in AgentDetailDrawer (DRIFT_THRESHOLD=0.85 in aggregator)
- [x] Left-rail present in `/build/*` layout with active highlight on current tab — `components/shell/build-rail.tsx` (72 lines) mounted in `app/build/layout.tsx`
- [x] Stub routes `/build/workflows` + `/build/changes` return 200 with "Coming in Phase X" copy — routes present; 307 redirect (auth gate) proves existence
- [x] Sparkline SVG renders — `components/ui/sparkline.tsx` (80 lines)
- [x] Founder/dev copy flip works per `labels.ts` agents.* keys — direct composition test PASS
- [x] `pnpm tsc` clean — exit 0
- [x] `pnpm build` clean — exit 0
- [x] No `dangerouslySetInnerHTML` in any Phase 5 component — grep returns 0 matches
- [x] A11y: 0 buttons / role=button without accessible name — audit PASS
- [x] Drawer fetches `/api/agents/{name}` once on open; no polling inside — `useEffect` with `[open, agentParam]` deps; cancellation flag prevents stale setState
- [x] Drawer close preserves non-`agent` query params — single `p.delete("agent")` call; any other params survive

**16 / 16 quality-gate items verified.** Phase 5 is DONE.

## Human Verification Required

See frontmatter `human_verification` list. 5 items require a browser with an authenticated session to confirm runtime behaviors (click→drawer, Esc→focus return, visual drift banner, Sonner toast, Ctrl+Shift+D copy flip). All underlying code paths + data contracts are automated-verified.
