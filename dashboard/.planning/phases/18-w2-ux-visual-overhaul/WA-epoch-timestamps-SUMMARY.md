---
task: WA-epoch-timestamps
status: complete
commit: c4b872b
---

# SUMMARY

## What was done

Created `lib/date.ts` with a single `formatRelativeTime(ts)` export that:
- Detects epoch seconds vs milliseconds by magnitude (> 1e12 = ms, else seconds × 1000)
- Returns `"—"` for null, undefined, zero, or unparseable inputs — prevents "20,567 days ago" when `birthtime` is unavailable on Linux (the root cause)
- Delegates rendering to the existing canonical `formatRelative` from `components/ui/timestamp.tsx`

Replaced duplicate local `relativeTime()` functions in:
- `app/build/queue/queue-card.tsx`
- `app/build/workflows/workflows-list-client.tsx`

Fixed pre-existing TypeScript build blocker: `Phase.status` in `lib/cae-types.ts` was missing `"archived"` from its union type, causing a comparison error in `lib/cae-home-state.ts:460`.

Added 11 unit tests in `lib/date.test.ts`.

## Root cause of "20,567 days ago"

`InboxTask.createdAt` is populated from `dirStat.birthtime` (a Node.js `Date`). On Linux ext4, `birthtime` is unsupported and returns epoch 0. After `.getTime()`, `card.ts = 0`. The old `relativeTime(0)` computed `diff = Date.now() - 0 ≈ 1.74e12 ms ≈ 20,100+ days`.

The new `formatRelativeTime(0)` returns `"—"` since 0 is treated as a placeholder.

## Tests

- `pnpm vitest run` — 1724/1724 passed (190 test files)
- `pnpm build` — clean (1 unrelated Turbopack warning on `/api/telemetry/client-error`)

## Notes for Sentinel

- `formatRelativeAgo` in `mission-control-hero.tsx` was intentionally NOT replaced — it formats durations, not timestamps (outputs "1s", "45m" without "ago")
- The `Phase.status = "archived"` fix is a type-only change; no runtime behavior changed
- The `next-env.d.ts` modification is a Next.js build artifact, not staged in commit
