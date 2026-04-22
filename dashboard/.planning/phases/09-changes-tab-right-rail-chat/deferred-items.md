# Phase 9 — Deferred items (out of scope for this phase)

Tracks pre-existing issues surfaced during Phase 9 execution but NOT caused
by any Phase 9 plan. Per the GSD scope boundary rule: only auto-fix issues
directly caused by the current task's changes; log out-of-scope discoveries
here instead of attempting fixes inside Phase 9.

## Plan 09-01 (Wave 0)

### `pnpm lint` invocation broken (pre-existing)

- **Surfaced by:** Plan 09-01 verification sweep (2026-04-23).
- **Symptom:** `pnpm lint` fails with `Invalid project directory provided,
  no such directory: /home/cae/ctrl-alt-elite/dashboard/lint` — Next.js
  interprets the trailing `lint` arg as a target directory.
- **Root cause:** `package.json` script is `"lint": "next lint"`. With
  newer `next` + its current CLI, an extra arg is required or the `next`
  binary is mis-parsing argv. `lint-no-dollar.sh` still works.
- **ESLint direct invocation also fails:** `Cannot find package
  '@eslint/eslintrc' imported from eslint.config.mjs` — dev deps are
  missing the flat-config helper.
- **Verdict:** Pre-existing dashboard-level infra bug, not a Phase 9 regression.
  All Plan 09-01 files pass `pnpm tsc --noEmit`, pass all new vitest
  suites, and pass `./scripts/lint-no-dollar.sh`.
- **Next step:** Track as dashboard-level chore — fix the `lint` script
  (or install `@eslint/eslintrc`) in a separate plan.

### `pnpm build` NFT warning (pre-existing)

- **Surfaced by:** Plan 09-01 verification sweep.
- **Symptom:** Turbopack build warns "Encountered unexpected file in NFT
  list" with a trace pointing at `./next.config.ts`. The build still
  completes and renders the full route table.
- **Verdict:** Pre-existing — the warning refers to NFT (Next File
  Tracing) output and is produced whether or not Plan 09-01's new files
  are present. `next.config.ts` is on the modified list from before this
  plan started.
- **Next step:** Track as dashboard-level chore. No action required for
  Plan 09-01.
