---
phase: 17
plan: W1-metrics-backend
wave: 1
name: Fix /metrics ERR_CONNECTION_REFUSED + incomplete-chunked-encoding — 18+6 errors
---

# W1 — /metrics backend unreachable

## Context

Auto-audit hit #5. Console errors on /metrics:

```
Failed to load resource: net::ERR_CONNECTION_REFUSED    (18 hits on /metrics)
Failed to load resource: net::ERR_INCOMPLETE_CHUNKED_ENCODING  (6 hits on /metrics + /build/skills/installed)
page.goto: Timeout 20000ms exceeded  (8 hits on /metrics)
```

Either (a) /metrics calls a backend service that isn't running in the audit env (Prometheus, vigil, etc.) or (b) an SSE stream endpoint drops its connection mid-flight, or (c) the page hangs past the 20s Playwright ceiling waiting for a never-completing fetch.

## Task

<task>
<name>Make /metrics resilient to missing backends + fix SSE drop patterns</name>

<files>
app/metrics/page.tsx
app/api/metrics/**/*.ts
app/api/metrics/stream/**/*.ts
lib/metrics/**/*.ts
components/metrics/**/*.tsx
hooks/use-metrics-*.ts
</files>

<action>
1. `rg -n "fetch\\(|EventSource\\(|ReadableStream" app/metrics app/api/metrics components/metrics lib/metrics`.
2. Identify every outbound network call on /metrics. Which one refuses connection?
   - Likely a `fetch("http://localhost:<someport>/...")` to a non-dashboard service.
3. For each external-service fetch:
   - Wrap in `try/catch` with typed failure state.
   - Render a "service unreachable" placeholder card, not a blank screen + stuck spinner.
   - Add a 5s AbortController timeout so Playwright never hits the 20s ceiling.
4. For SSE endpoints (`/api/tail`, `/api/metrics/stream`, etc.) that throw "Connection closed" on disconnect:
   - Wrap the EventSource consumer so the close event is handled as "end of stream", not an uncaught error.
   - Auto-reconnect with exponential backoff (1s → 10s cap, ≤5 attempts), then render a "connection lost, refresh to retry" state.
5. For `ERR_INCOMPLETE_CHUNKED_ENCODING`: the server writer likely closes the stream mid-write. Audit the Node streaming route handler — ensure `res.end()` (or equivalent NextResponse stream close) is always called, even on error paths.
6. Add vitest tests: `fetch = vi.fn().mockRejectedValue(Error("refused"))` → component renders placeholder, not crashes.
</action>

<verify>
1. `pnpm vitest run` — all green.
2. Re-run audit capture. `/metrics` must navigate within 20s across all viewports × personas.
3. Console errors on /metrics: zero ERR_CONNECTION_REFUSED, zero ERR_INCOMPLETE_CHUNKED_ENCODING.
4. Page renders placeholder cards where backend is down — not blank.
</verify>
</task>
