# UI-AUDIT-logging.md — Plan 13-05 Structured Logging Audit

**Audited:** 2026-04-23
**Plan:** 13-05 (pino structured logging rollout)
**Auditor:** Sonnet 4.6 (execution agent)

---

## Before State

35 `console.*` calls scattered across server-side API routes, lib aggregators, client
components, and hooks — with no correlation IDs, no scope tags, no structured fields,
no log file sink. Per the V2 §4 research baseline:

| Severity | Count | Locations |
|----------|-------|-----------|
| `console.error` | 26 | app/api/* (15), lib/cae-*.ts (8), lib/hooks/* (3) |
| `console.warn` | 7 | lib/cae-workflows.ts (3), lib/palette/* (2), lib/hooks/use-floor-events.tsx (1), lib/palette/actions.ts (1) |
| `console.info` | 3 | components/agents/model-override.tsx (1), components/build-home/task-detail-sheet.tsx (2) |

**Impact:** Zero correlation between related log lines. Zero structured fields. Zero
log file sink for plan 13-08 Incident Stream. Eric's "logs suck" critique fully justified.

---

## After State

Post-plan grep:
```
grep -rE 'console\.(error|warn|info)\(' app/api/ lib/cae-*.ts | grep -v .test. | wc -l
```
Result: **0** — all server-side console.* calls converted.

Remaining client-side calls (justified below): **12**

---

## Conversion Table — All 35 Original Call Sites

### Server-side API routes (15 console.error → scoped logger)

| File | Line | Before | After |
|------|------|--------|-------|
| `app/api/state/route.ts` | 41 | `console.error("[/api/state] getHomeState failed:", err)` | `l.error({ err }, "getHomeState failed")` |
| `app/api/agents/route.ts` | 10 | `console.error("[/api/agents] failed:", err)` | `l.error({ err }, "roster aggregator failed")` |
| `app/api/agents/[name]/route.ts` | 17 | `console.error("[/api/agents/"+name+"] failed:", err)` | `l.error({ err, agentName: name }, "agent detail aggregator failed")` |
| `app/api/metrics/route.ts` | 18 | `console.error("[/api/metrics] failed:", err)` | `l.error({ err }, "aggregator failed")` |
| `app/api/changes/route.ts` | 37 | `console.error("[/api/changes] failed:", err)` | `l.error({ err }, "changes aggregator failed")` |
| `app/api/queue/route.ts` | 10 | `console.error("[/api/queue] failed:", err)` | `l.error({ err }, "queue state aggregator failed")` |
| `app/api/tail/route.ts` | 25 | `console.error("[/api/tail] listProjects() failed...", err)` | `l.error({ err }, "listProjects() failed, falling back to static roots")` |
| `app/api/memory/tree/route.ts` | 24 | `console.error("/api/memory/tree failed", err)` | `l.error({ err }, "memory tree build failed")` |
| `app/api/memory/graph/route.ts` | 38 | `console.error("/api/memory/graph failed", err)` | `l.error({ err }, "memory graph load failed")` |
| `app/api/memory/consult/[task_id]/route.ts` | 47 | `console.error("/api/memory/consult error", err)` | `l.error({ err }, "memory consult lookup failed")` |
| `app/api/memory/diff/route.ts` | 56 | `console.error("/api/memory/diff failed", err)` | `l.error({ err }, "git diff failed")` |
| `app/api/memory/file/[...path]/route.ts` | 56 | `console.error("/api/memory/file failed", err)` | `l.error({ err }, "memory file read failed")` |
| `app/api/memory/git-log/[...path]/route.ts` | 52 | `console.error("/api/memory/git-log failed", err)` | `l.error({ err }, "git log for file failed")` |
| `app/api/memory/search/route.ts` | 45 | `console.error("/api/memory/search failed", err)` | `l.error({ err }, "memory search failed")` |
| `app/api/memory/regenerate/route.ts` | 44 | `console.error("/api/memory/regenerate failed", err)` | `l.error({ err }, "memory graph regeneration failed")` |

### Server-side lib aggregators (11 console.* → scoped logger)

| File | Line | Before | After |
|------|------|--------|-------|
| `lib/cae-metrics-state.ts` | 234 | `console.error("[cae-metrics-state] cb read failed for ${p.name}:", err)` | `lMetrics.error({ err, project: p.name }, "cb read failed")` |
| `lib/cae-metrics-state.ts` | 255 | `console.error("[cae-metrics-state] listInbox failed:", err)` | `lMetrics.error({ err }, "listInbox failed")` |
| `lib/cae-metrics-state.ts` | 259 | `console.error("[cae-metrics-state] listOutbox failed:", err)` | `lMetrics.error({ err }, "listOutbox failed")` |
| `lib/cae-agents-state.ts` | 196 | `console.error("[cae-agents-state] failed reading "+cbPath+":", err)` | `lAgents.error({ err, cbPath }, "failed reading cb events")` |
| `lib/cae-changes-state.ts` | 401 | `console.error("[changes] ${p.name} failed:", err)` | `lChanges.error({ err, project: p.name }, "project changes aggregation failed")` |
| `lib/cae-graph-state.ts` | 258 | `console.error("[cae-graph-state] read failed", abs, err)` | `lGraph.error({ err, abs }, "file read failed")` |
| `lib/cae-graph-state.ts` | 346 | `console.error("[cae-graph-state] walk failed", err)` | `lGraph.error({ err }, "memory walk failed")` |
| `lib/cae-graph-state.ts` | 370 | `console.error("[cae-graph-state] write failed", err)` | `lGraph.error({ err }, "graph.json write failed")` |
| `lib/cae-memory-git.ts` | 124 | `console.error("[cae-memory-git] gitLogForFile failed", err)` | `lGit.error({ err }, "gitLogForFile failed")` |
| `lib/cae-memory-git.ts` | 156 | `console.error("[cae-memory-git] gitDiff failed", err)` | `lGit.error({ err }, "gitDiff failed")` |
| `lib/cae-workflows.ts` | 91 | `console.warn("[cae-workflows] Skipping malformed workflow...")` | `lWorkflows.warn({ name, errors }, "skipping malformed workflow")` |
| `lib/cae-workflows.ts` | 106 | `console.warn("[cae-workflows] Failed to read ${name}: ${message}")` | `lWorkflows.warn({ name, message }, "failed to read workflow file")` |
| `lib/cae-workflows.ts` | 126 | `console.warn("[cae-workflows] getWorkflow(...) malformed: ...")` | `lWorkflows.warn({ slug, errors }, "getWorkflow: workflow file is malformed")` |

### Client-side survivors (justified — pending plan 13-08)

The following 12 calls are in client components or client-only hooks. They cannot use
the server-side `log()` because pino requires Node.js (AsyncLocalStorage is not
available in browsers). A client-side log bridge (`lib/client-log.ts`) is deferred to
plan 13-08 (Incident Stream panel), which will also add a debug-mode breadcrumb panel.

| File | Line | Call | Justification |
|------|------|------|---------------|
| `app/build/agents/page.tsx` | 38 | `console.error("[/build/agents] aggregator failed:", err)` | Client component — server fetch error visible to dev; pending 13-08 |
| `components/agents/model-override.tsx` | 47 | `console.info(...)` | Dev-intent debug — model override selection trace; pending 13-08 |
| `components/build-home/task-detail-sheet.tsx` | 63 | `console.info("[sheet] pause", ...)` | Dev-intent debug — action trace; pending 13-08 |
| `components/build-home/task-detail-sheet.tsx` | 71 | `console.info("[sheet] abort", ...)` | Dev-intent debug — action trace; pending 13-08 |
| `lib/palette/build-index.ts` | 55 | `console.warn("[palette] source failed:", ...)` | Runs client-side; palette degrades gracefully; pending 13-08 |
| `lib/palette/actions.ts` | 100 | `console.warn(msg)` | Client action warning — keybinding misconfiguration; pending 13-08 |
| `lib/hooks/use-floor-events.tsx` | 166 | `console.warn("[useFloorEvents] SSE error...")` | Client SSE hook — already visible in DevTools; pending 13-08 |
| `lib/hooks/use-shortcut-overlay.tsx` | 36 | `console.error("[shortcuts] KEYBINDINGS missing...")` | Dev-only misconfiguration warning; pending 13-08 |
| `lib/hooks/use-command-palette.tsx` | 36 | `console.error("[palette] KEYBINDINGS missing...")` | Dev-only misconfiguration warning; pending 13-08 |
| `lib/hooks/use-command-palette.tsx` | 51 | `console.error("[palette] palette.open has no keys...")` | Dev-only misconfiguration warning; pending 13-08 |

---

## Routes NOT Wrapped With withLog

| Route | Reason |
|-------|--------|
| `app/api/auth/[...nextauth]/route.ts` | NextAuth-provided handler — not our code; wrapping would intercept NextAuth internals. Auth errors are logged by NextAuth itself. Documented as exception. |

All other 22 routes are wrapped with `withLog(handler, "/api/route-path")`.

---

## Redact Audit

The following fields are covered by `pino.redact.paths` in `lib/log.ts`:

| Field Pattern | Covers | Test |
|---------------|--------|------|
| `*.authorization` | Any nested `authorization` field | lib/log.test.ts: "redacts authorization headers" |
| `*.cookie` | Any nested `cookie` field | lib/log.test.ts: "redacts cookie headers" |
| `*.session-token` | NextAuth session token field | Structural — covered by pattern |
| `*.password` | Password fields if ever logged | Structural |
| `*.headers.authorization` | Explicit request header path | Structural |
| `*.headers.cookie` | Explicit request header path | Structural |
| `*.authjs\.session-token` | NextAuth v5 cookie name | Structural |
| `*.*.authorization` | Two-level nesting | Structural |
| `*.*.cookie` | Two-level nesting | Structural |

**PII risk scan:** The only user-facing data in current log calls is:
- `agentName` (from URL param) — not PII
- `project` (project path/name) — internal; not PII
- `clientUrl` in telemetry route — the user's own browser URL on their own machine; acceptable
- `userAgent` in telemetry route — own device; acceptable

No email, name, token, or credential fields appear in log calls after this plan.

---

## New Infrastructure Added

| Artifact | Purpose |
|----------|---------|
| `lib/log.ts` | pino instance + `log(scope)` factory + `reqCtx` AsyncLocalStorage + redact config |
| `lib/with-log.ts` | `withLog(handler, route)` HOF — req.begin/req.end/req.fail + x-correlation-id |
| `app/api/telemetry/client-error/route.ts` | POST endpoint for window.onerror bridge → pino |
| `components/root-error-boundary.tsx` | ClientErrorBridge (window.onerror + unhandledrejection) + RootErrorBoundary |
| `.cae/logs/dashboard.log.jsonl` | Rolling JSONL log file (gitignored; directory tracked via .gitkeep) |

---

## Scope Tags Used

| Scope | Files |
|-------|-------|
| `http` | withLog HOF (all routes) |
| `api.state` | app/api/state/route.ts |
| `api.agents` | app/api/agents/route.ts |
| `api.agents.detail` | app/api/agents/[name]/route.ts |
| `api.metrics` | app/api/metrics/route.ts |
| `api.changes` | app/api/changes/route.ts |
| `api.queue` | app/api/queue/route.ts |
| `api.tail` | app/api/tail/route.ts |
| `api.memory.tree` | app/api/memory/tree/route.ts |
| `api.memory.graph` | app/api/memory/graph/route.ts |
| `api.memory.consult` | app/api/memory/consult/[task_id]/route.ts |
| `api.memory.diff` | app/api/memory/diff/route.ts |
| `api.memory.file` | app/api/memory/file/[...path]/route.ts |
| `api.memory.git-log` | app/api/memory/git-log/[...path]/route.ts |
| `api.memory.search` | app/api/memory/search/route.ts |
| `api.memory.regenerate` | app/api/memory/regenerate/route.ts |
| `api.workflows` | app/api/workflows/route.ts |
| `cae-metrics-state` | lib/cae-metrics-state.ts |
| `cae-agents-state` | lib/cae-agents-state.ts |
| `cae-changes-state` | lib/cae-changes-state.ts |
| `cae-graph-state` | lib/cae-graph-state.ts |
| `cae-memory-git` | lib/cae-memory-git.ts |
| `cae-workflows` | lib/cae-workflows.ts |
| `client.error` | app/api/telemetry/client-error/route.ts |

---

## Next Steps (Plan 13-08)

- Surface `.cae/logs/dashboard.log.jsonl` as the Incident Stream panel in the dashboard
- Add `lib/client-log.ts` bridge for client-side hook/component calls (replaces remaining 10 console.* survivors)
- Add debug-mode breadcrumb panel (per 13-RESEARCH-V2.md §4)
- Wire `x-correlation-id` from client fetch calls to server logs for full request tracing
