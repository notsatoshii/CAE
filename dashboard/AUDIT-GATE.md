# Dashboard FE merge gate — CAE auto-audit (UAT is gone)

**Binding as of 2026-04-24 session 15.** This document supersedes any prior rule requiring Eric UAT walkthrough before merging FE phases.

## The rule

FE phases merge when — and only when — **CAE's own screenshot-truth harness** signs off. Eric walkthrough is not required; Eric approval is not required. The harness output is the gate.

## Procedure (per FE phase)

1. **Capture**. Seed healthy fixture. Drive `audit/playwright.config.ts` across every route × viewport × persona. Produces `audit/shots/healthy/<persona>/<slug>--<viewport>.{png,truth.json,console.json}`.
2. **Score**. `npx tsx audit/score-run.ts C<N> --fixture healthy --prior C<N-1>`. Produces `audit/reports/C<N>-{SCORES,FINDINGS,SUMMARY,DELTA}.{md,json}`.
3. **Cluster**. Parse SUMMARY.json + console.json sidecars. Group findings by root cause. Write `.planning/phases/<N>-…/W<wave>-<slug>-PLAN.md` files.
4. **Fix**. `cae execute-phase <N>`. Parallel forge agents. Sentinel review gate per task.
5. **Re-audit**. Steps 1–2 as C<N+1>. Compare DELTA.
6. **Merge-gate**. All three must hold:
   - Every systemic console-error pattern count drops ≥50%.
   - No pillar regresses ≥2 levels on any cell.
   - No route scores truth=1 except those marked N/A in `ROUTE_TRUTH_PREFIXES` (signin, 403 only).
7. **Push**. On green, merge forge branches into main, push, close phase.

## What the harness catches that a human UAT wouldn't

- **251+ Router action dispatched before initialization** (internal Next.js errors invisible on the rendered page).
- **Base UI MenuGroupRootContext missing** (silent in devtools until dropdown interaction).
- **Hydration mismatches** (SSR/CSR drift) — flashes too fast for a human to register.
- **ERR_INCOMPLETE_CHUNKED_ENCODING** on SSE endpoints.
- **Per-route data-truth key drift** (DOM says 0, API says 22) — the B1 bug class.

A human walking the app catches glaring visuals. The harness catches systemic correctness regressions a human never sees.

## What the harness does NOT catch (where Eric judgment is still relevant)

- **New-feature scope judgments** (should this tab even exist? is the IA right?). Ask Eric BEFORE planning, not as a merge gate.
- **Aesthetic direction** (colors, iconography, spacing preferences). Set direction in design-system phases; harness doesn't grade taste.
- **Craft pillar** currently placeholder-3 (`audit/score/llm-vision.ts` needed). Run vision when substantive visual changes ship; until then craft is an open slot.

## Binding behavior for Claude sessions

- Do NOT create HANDOFF documents that say "UAT required" or "Eric walkthrough pending".
- Do NOT block merges on Eric approval of screenshots.
- Do NOT ask Eric to click through tiles.
- DO run the audit, parse the output, write plans, execute CAE, merge when the gate passes.
- If the user asks for their input, tell them what the audit found and ask a scoped question — don't punt the whole merge decision.

## Session 15 dogfood

This phase (17-fe-auto-audit-fixes) is the first full run of this protocol. If the C6 delta shows the 6 W1/W2 systemic patterns dropping by the expected margins, the gate is validated. If it doesn't, revise the gate criteria here, not the protocol.
