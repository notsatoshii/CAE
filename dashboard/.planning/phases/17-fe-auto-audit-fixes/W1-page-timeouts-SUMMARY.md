---
plan: W1-page-timeouts
status: complete
commit: b226146
tests: 1713 passed
---

# W1-page-timeouts SUMMARY

## Root cause

The `/build/skills` page did 4 blocking `await` calls at the top level including
two external HTTP fetches to `skills.sh` and `clawhub.ai` with NO abort signal.
In the audit environment (no internet) these hang indefinitely, keeping the HTTP
response stream open. Because Next.js streaming doesn't close the response until
all Suspense boundaries resolve, `DOMContentLoaded` never fires → 20s Playwright
timeout. The load on the dev server also caused collateral timeouts on lighter
pages (`/plan`, `/signin`, redirects).

## Changes

| File | Change |
|---|---|
| `lib/cae-skills-scrape-shsh.ts` | `AbortSignal.timeout(8_000)` on fetch |
| `lib/cae-skills-scrape-clawhub.ts` | Same |
| `lib/skills/last-updated.ts` | `timeout: 5_000` on all `execFileP` git calls |
| `app/build/skills/page.tsx` | Non-async shell + `<Suspense>` around `SkillsContent` with loading skeleton |
| `app/build/queue/page.tsx` | Same Suspense pattern for `QueueContent` |
| `app/memory/memory-client.tsx` | `next/dynamic` lazy-load of `GraphPane` (defers `@xyflow/react` bundle) |
| `lib/cae-skills-scrape.test.ts` | 4 new tests: AbortError handling + signal-pass verification |
| `tests/page-load-time.test.tsx` | 4 per-route load-time tests (skills, queue, plan, signin) |

## Tests: 1713 passed (0 failed)

## Notes for Sentinel

- The Suspense boundary in skills page renders a 6-card skeleton with
  `data-truth="build-skills.loading"=yes` while data loads. After resolution
  `SkillsClient` sets `data-truth="build-skills.loading"=no`.
- Queue page shell renders heading + `<NewJobModal />` immediately; kanban loads
  asynchronously. Loading skeleton has `data-truth="build-queue.loading"=yes`.
- `GraphPane` lazy-load uses `ssr: false` — react-flow requires browser APIs;
  this also prevents SSR serialisation errors from `@xyflow/react`.
- AbortSignal.timeout is a Node.js 17+ / browser native API; verified present
  in the Next.js 15 / Node 20 runtime this project uses.
- The root-owned git object dirs required alternate-object-dir workaround for
  commit; pack file `pack-pagefix-6a1b...` contains all new objects.
