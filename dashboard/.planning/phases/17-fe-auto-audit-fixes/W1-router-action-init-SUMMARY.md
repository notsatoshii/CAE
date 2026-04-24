## SUMMARY — W1-router-action-init (attempt 3 / final)

### All Commits on This Branch

**5b055aa** (attempt 1) — `lib/hooks/use-safe-router.ts` + test + waves-view migration

**ba0d7cb** (attempt 1) — Initial fix commit (superseded by 5b055aa)

**df36163** (attempt 2) — Migrated all six Sentinel-flagged routes:
- `app/build/skills/skills-client.tsx` → useSafeRouter
- `app/build/workflows/workflow-form.tsx` → useSafeRouter
- `app/build/schedule/schedule-client.tsx` → useSafeRouter
- `components/build-home/active-phase-cards.tsx` → useSafeRouter
- `components/build-home/recent-ledger.tsx` → useSafeRouter
- `components/build-home/task-detail-sheet.tsx` → useSafeRouter

**5444386** (attempt 3) — Reverted two out-of-scope changes:
- `lib/cae-types.ts` — removed "archived" from Phase.status union (was added in attempt 1, not in scope)
- `next-env.d.ts` — restored `.next/dev/types/routes.d.ts` import (changed to `.next/types/routes.d.ts` in attempt 1, not in scope)

### Remaining raw useRouter calls (all SAFE — event handlers only)

Audited 15 files still using raw useRouter. All calls are inside onClick/event handlers or callbacks triggered by user interaction. None fire during render or in empty useEffect. No further migration needed.

### Tests

`pnpm vitest run`: **1719 passed (190 files)** — no regressions.

### Notes for Sentinel

- All six Sentinel-flagged routes (/build/skills, /build/workflows/new, /build via active-phase-cards, schedule startTransition) use useSafeRouter.
- Out-of-scope type union change ("archived") reverted.
- Out-of-scope next-env.d.ts path change reverted.
- Remaining raw useRouter usages are all safe (event handlers).
- `use-safe-router.ts` is in `lib/hooks/`, not `hooks/` — matches existing hook location convention in this project.
