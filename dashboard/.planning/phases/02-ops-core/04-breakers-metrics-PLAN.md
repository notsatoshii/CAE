---
phase: 2
plan: A
wave: 5
name: Wave 4 — circuit-breaker panel + metrics viewer
---

# Wave 4 — Breakers + metrics

**Depends on:** Waves 1–3.

<task id="1">
<name>Circuit-breaker panel + metrics tables on /ops</name>
<files>/home/cae/ctrl-alt-elite/dashboard/app/ops/page.tsx, /home/cae/ctrl-alt-elite/dashboard/app/ops/breakers-panel.tsx, /home/cae/ctrl-alt-elite/dashboard/app/ops/metrics-tabs.tsx</files>
<action>
1. `breakers-panel.tsx` — client component. Fetches `/api/state?project=<path>` (new endpoint — add to route handler) every 3s. Renders stat cards: Active Forge count, Total input tokens today, Output tokens today, Retry count, Phantom escalations, Halted? (red badge if true). Use shadcn Card.

2. `app/api/state/route.ts` — GET handler returning `{ breakers, phases, inbox, outbox }` JSON for the selected project. Calls lib/cae-state helpers.

3. `metrics-tabs.tsx` — client component with shadcn Tabs: `Breakers | Sentinel | Compaction | Approvals`. Each tab shows a shadcn Table with last 50 events from corresponding `.cae/metrics/<name>.jsonl`. Columns adapt per stream (timestamp always first). Auto-refresh 5s.

4. Update `app/ops/page.tsx` to render BreakersPanel ABOVE PhasesList, then PhasesList, then MetricsTabs at bottom.

5. `pnpm build` must pass.

6. Commit: `feat(ops): circuit-breaker stat cards + metrics tabbed tables`.
</action>
<verify>
cd /home/cae/ctrl-alt-elite/dashboard && test -f app/ops/breakers-panel.tsx && test -f app/ops/metrics-tabs.tsx && test -f app/api/state/route.ts && pnpm build 2>&1 | grep Compiled | head -1
</verify>
</task>
