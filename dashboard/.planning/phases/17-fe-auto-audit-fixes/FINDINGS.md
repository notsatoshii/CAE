# Phase 17 — FE auto-audit findings (C5-session15 cycle)

**Generated**: 2026-04-24 by CAE screenshot-truth harness.
**No UAT performed.** Source: `dashboard/audit/reports/C5-session15-*`.
**Captures**: 408 cells (24 routes × 3 viewports × 6 personas, gated by persona access).

## Pillar rollup

| pillar | avg | score 1 | ≤2 | ≤3 | ≥4 |
|---|---|---|---|---|---|
| truth | 2.04 | 291 | 303 | 307 | 101 |
| depth | 3.53 | 98 | 130 | 130 | 221 |
| liveness | 2.01 | 172 | 242 | 398 | 10 |
| voice | 5.00 | 0 | 0 | 0 | 408 |
| craft | 3.00 | 0 | 0 | 408 | 0 |
| reliability | 3.75 | 12 | 22 | 128 | 280 |
| ia | 3.00 | 0 | 0 | 408 | 0 |

Truth moved from 1.00 (C4) → 2.04 (C5). Liveness regressed. Depth + reliability regressed.

## Top systemic errors (from console + page-error capture)

| rank | hits | pattern | routes affected |
|---|---|---|---|
| 1 | **251** | `Router action dispatched before initialization` (Next.js internal) | /build, /build/security/audit, /build/skills, /build/workflows/new, /floor/popout + more |
| 2 | **74** | `Base UI: MenuGroupRootContext is missing. Menu group parts must be used within <Menu.Group>` | /403, /build, /build/admin/roles, /build/agents, /build/changes, /memory, /build/workflows-new, /build/schedule |
| 3 | 28 | `Connection closed` (SSE) | /, /build/schedule/new, /build/skills/installed, /floor |
| 4 | 20 | `Hydration failed — server rendered text didn't match the client` | /, /build/security/audit, /build/workflows |
| 5 | 18 | `ERR_CONNECTION_REFUSED` on /metrics backend fetch | /metrics |
| 6 | 40+ | `page.goto timeout 20000ms` | /memory, /plan, /metrics, /build/skills, /build/skills/installed, /build/security, /build/queue, /signin |
| 7 | 6 | `ERR_INCOMPLETE_CHUNKED_ENCODING` | /build/skills/installed, /metrics |

## Per-route truth/depth/liveness (routes with coverage, low scores)

| route | truth | depth | liveness | issue |
|---|---|---|---|---|
| /build | 1.4 | 3.9 | 2.6 | mission-control truth keys miss on mobile/wide (B1 rollup-strip) |
| /build/queue | 1.0 | 3.4 | 2.0 | only 1/6 data-truth keys on laptop+wide; "count" key missing |
| /floor | 2.8 | 4.2 | 2.1 | partial match; pixel-agent scene empty (B2) |
| /floor/popout | 1.4 | 3.7 | 1.8 | popout page mostly broken |
| /build/skills/installed | 1.0 | 2.6 | 1.7 | page data missing, page.goto timeouts |
| /build/security | 1.0 | 1.5 | 1.2 | **page basically not loading data** — worst non-expected route |
| /chat | 4.3 | 5.0 | 1.9 | truth OK, liveness low (SSE not flipping in capture window) |
| /metrics | 4.1 | 3.8 | 1.8 | truth OK but ERR_CONNECTION_REFUSED on backend |

## Fixture coverage gaps (scorer limitation, not UI bugs)

Routes missing from `audit/score/pillars.ts` `ROUTE_TRUTH_PREFIXES`:
`build-agents`, `build-changes`, `build-security`, `build-security-audit`, `build-security-secrets`, `build-security-skills`, `build-workflows`, `build-workflows-new`, `floor-popout`, `root`, `signin`, `403`.

These score truth=1 because ALL 46 expected keys are compared (none apply). Fix: add prefixes + expected keys for each. Handled in W2 coverage plan.

## Known bugs from Session 14 (re-confirmed by audit)

- **B1**: rollup-strip on /build shows "shipped 0" despite API returning 22. Truth=1.4 confirms.
- **B2**: pixel agents empty scene on /floor. Truth=2.8 + liveness=2.1 confirms.

## Wave plan

- **W1 (parallel, 5 tasks)**: fix the 5 systemic error patterns (router-action-init, menu-group-context, hydration, metrics backend, page timeouts). Unblocks everything.
- **W2 (parallel, 4 tasks)**: data-layer bugs (rollup B1, pixel-agents B2, build-security page, audit coverage).
- **W3 (serial, 1 task)**: liveness markers SSE settle + capture gating.

Merge gate: re-run C6 audit. Each fixed pattern must drop ≥50% in hit-count. No new pillar regressions.
