## SUMMARY — p17-plW1-metrics-backend-t1-91d39b

### Status: COMPLETE (carried forward from prior attempt 144f4b0 + 6d59f96)

### Changed
- `app/api/incidents/route.ts` — stream handler: enqueue wrapped in try/catch (client-disconnect mid-frame), `onClose` path closes controller, catch block calls `controller.error(err)` so stream terminates cleanly (no ERR_INCOMPLETE_CHUNKED_ENCODING)
- `components/shell/incident-stream.tsx` — SSE consumer: exponential backoff (1s → 10s cap, MAX_RETRIES=5), `connState` state machine (`connecting → open → lost`), "Connection lost. Refresh to retry." placeholder card when retries exhausted, `data-testid="incident-stream-lost"` for Playwright assertions
- `lib/hooks/use-metrics-poll.tsx` — `loading` state added; first poll attempt clears `loading` in `finally` regardless of success/error so panels distinguish "in-flight" from "genuinely empty"
- `components/metrics/metrics-backend-resilience.test.tsx` (new) — vitest integration: `fetch = vi.fn().mockRejectedValue(Error("ERR_CONNECTION_REFUSED"))` → each of SpendingPanel/ReliabilityPanel/SpeedPanel renders `*-panel-error` placeholder, not blank
- `components/shell/incident-stream.test.tsx` — SSE resilience tests added

All three panels (spending/reliability/speed) already had `testId="*-panel-error"` error states.

### Tests
**1705 / 1705 passed** — `pnpm vitest run` (188 test files, all green)

### Notes for Sentinel
- No external backend fetches exist on /metrics — `use-metrics-poll.tsx` only calls `/api/metrics` (internal Next.js route), so the "external service unreachable" scenario manifests as the API route failing, which is handled by the try/catch + fallback JSON shape in route.ts.
- The 5s AbortController timeout was already present before this branch; no change needed there.
- `/api/incidents` stream closes cleanly on both client-disconnect and unexpected tailJsonl failure — both paths verified to avoid ERR_INCOMPLETE_CHUNKED_ENCODING.
- No new files outside the plan's `<files>` section were modified.
