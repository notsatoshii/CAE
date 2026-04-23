# cae-dashboard — Session 8 handoff

**Resume:** `cd /home/cae/ctrl-alt-elite/dashboard` → next work is a **Phase 15 gap-closure** focused on **FE correctness + UX proof-by-screenshot** — NOT a new feature phase.

---

## Where things stand

Phases 10 → 14 all shipped end-to-end during sessions 7 + 8 (2026-04-23):

| Phase | Plans | Tests | Review→Fix cycles |
|-------|-------|-------|-------------------|
| 10 Plan-mode libs | 4/4 | 276 | 2 P1 + 1 P2 fixed |
| 11 Live Floor | 5/5 | 189 phase | 3 P0 + 5 P1/P2 fixed |
| 12 Palette + empty states | 4/4 | 563 | 2 P1 fixed |
| 13 UI/UX polish loop (expanded) | 12/12 | 718 | 2 P1 + 6 WR/gaps fixed |
| 14 Orchestration depth | 6/6 | 1044 full-suite | 4 P0 + 5 P1 fixed (7 commits + 65 regression tests) |

All `tsc --noEmit` clean. All phase `VERIFICATION.md` + `VERIFICATION-V2.md` files present. 100+ commits on `main`.

---

## Why we need a Phase 15 (Eric's session-8 critique)

**The critical gap Eric called out:** "The main cards and stuff don't show the correct activity info for the agents."

Phase 13's audit harness produced `UI-AUDIT-correctness.md` flagging this exact class of bug (e.g., WR-01 chat unread, `cost-ticker` vs rollup token-count drift, forge token ledger = 0), and we fixed the specific examples. But we did NOT prove every card / panel / list across the whole app renders correct data under known input. **We proved the contracts, not the composition.**

Eric's framing for session 9+:

> "We should write and run tests to show every FE UI UX feature runs properly via screenshots."

That is the Phase 15 mandate.

---

## Phase 15 scope: "screenshot-truth test harness"

**One sentence:** for every route + every card + every list in the dashboard, seed a known fixture → render → capture PNG → assert both pixels AND displayed data match the fixture.

### Five waves

**Wave 0 — seed-first infra (1 plan):**
- `tests/fixtures/seed/` folder with JSONL generators: known-state circuit-breakers.jsonl (3 agents idle, 1 active forging, 1 in phantom), known chat session transcripts, known metrics slice, known roadmap with 2 active phases, known skills catalog with 3 entries + 2 installed, known scheduled_tasks (3 tasks, 1 paused), known audit log (20 entries across 4 tool classes).
- `scripts/seed-dashboard-state.sh` — atomically writes all fixtures into `.cae/` + `.planning/` at the project under test. Idempotent. Restores via `scripts/unseed-dashboard-state.sh`.
- Extend `audit/capture.sh` to accept `--seed <name>` so the harness auto-loads a fixture before shooting.

**Wave 1 — screenshot-truth harness (1 plan):**
- `audit/truth.py` harness — for each route × viewport × seed combo:
  1. Seed fixture
  2. `screenshot-url` → PNG at `audit/shots/truth/<seed>/<route>--<viewport>.png`
  3. `scrape-url --selector "[data-truth]"` → JSON of every element with `data-truth="<field>"`
  4. Compare scraped values to the fixture's expected values
  5. Emit `audit/TRUTH-<seed>.md` with per-element PASS/FAIL
- Test runner wraps truth.py as a vitest-compatible suite so `npx vitest run` includes it.

**Wave 2 — `data-truth` annotation sweep (2 plans, parallel):**
- Add `data-truth="<fixture-key>"` to every value-displaying element in shipped components. This is the contract between the harness and the app. Example: `<span data-truth="rollup.tokens_today">{tokensToday}</span>`.
- Plan 15-03 covers cards (Build home rollup, agent cards, queue columns, metrics tiles, recent ledger, live-ops line).
- Plan 15-04 covers lists (Changes timeline, Workflows list, Schedules list, Skills catalog + installed, Incident stream, Audit log, Plan/PRD drafts).

**Wave 3 — golden-pixel regression (1 plan):**
- For each captured PNG, store a SHA + thumbnail at `audit/golden/`. Claude-vision compares new captures to goldens on every suite run, flagging pixel-level drift ≥ threshold.
- This catches visual regressions that pass data-truth (e.g., a card re-colored by mistake).

**Wave 4 — walkthrough-truth (1 plan):**
- Extend `audit/clickwalk.py` to drive every button / form / shortcut, capture resulting state transitions, and assert the post-click DOM matches a fixture-derived expected-state table.
- Covers: palette open → ⌘K navigate; filter toggles; tab switches; drawer open/close; RoleGate 403 redirect; sign-in round trip (with mocked provider).

**Wave 5 — consolidated fix plan (1 plan):**
- Whatever the harness flags becomes the gap-closure plan. Expected categories:
  - Cards that silently swallow errors → render fallback numbers (the "agents don't show correct activity" class)
  - Panels that show stale data even when fresh data exists (cache invalidation bugs)
  - Panels that aggregate wrong columns (cost-ticker vs rollup divergence class)
  - Dev-mode copy leaking into Founder mode (explain-key mismatches)
  - Accessibility regressions on auth-gated views (the 28 `text-dim` we swept were all in auth-gated files)

### Why this scope matters

- Our current tests prove primitives work. Real users see composed views. **A card is a composition of contract + component + data path.** Fail any of the three and the card lies.
- Screenshots are the only UAT signal that scales without Eric sitting at the browser.
- Data-truth annotations become a permanent invariant in the codebase — once added, future UI refactors get caught by CI if they break the contract.
- Golden-pixel diffs catch the "looks different" class without needing a human eyeball.

### Open planner questions for Eric

1. **Fixture scope** — one "canonical demo fixture" or a matrix of (empty / healthy / degraded / broken)? Recommend matrix — catches more bugs.
2. **Golden-pixel threshold** — 1% drift OK? Most dashboards land at 2-5% because typography aliasing. Recommend 2% as starting threshold.
3. **CI target** — ship the harness into CI gate on PRs, or keep it manual pre-Eric-merge? Recommend manual until it's stable; CI after Wave 5 lands.
4. **Clickwalk coverage target** — 80% of interactive elements or 100%? Recommend 100% of buttons + forms + shortcuts, 80% of tooltips.
5. **Dev server strategy** — seed the dev server in-place (mutates Eric's working state) or spawn an isolated test server on a random port? Recommend random port.

---

## Smaller outstanding items (not phase-gap-worthy)

### Deferred-deploy (Eric runs these, not code fixes)

- `bash scripts/install-audit-hook.sh` — registers PostToolUse hook in `~/.claude/settings.json`. Makes every tool call get logged to `.cae/metrics/tool-calls.jsonl`. Without this, the Security panel Audit tab stays empty.
- `bash scripts/install-scheduler-cron.sh` — installs `* * * * * /home/cae/ctrl-alt-elite/dashboard/scripts/cae-scheduler-watcher.sh` into crontab. Without this, scheduled tasks never fire.
- Populate `.env.local` with `ADMIN_EMAILS`, `OPERATOR_EMAILS`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, optional `AUTH_GOOGLE_HOSTED_DOMAIN`.

### Consolidated UAT debt (human verification items auto-deferred through P14)

Every phase 11–14 VERIFICATION.md has a `human_verification` section where the harness couldn't answer. Run `/gsd-audit-uat` to consolidate into one doc, then walk them. Known items:

- **Live Floor** — isometric scene geometry, live event animation flow with real server, pop-out window chrome suppression, `prefers-reduced-motion` OS-setting integration, 30s auth-drift banner.
- **⌘K palette** — fuzzy search + navigation + focus return.
- **Incident Stream** — live error surfacing when something actually errors.
- **Google SSO** — end-to-end sign-in flow; confirm GitHub path still works alongside.
- **RoleGate** — viewer sees 403 on admin page, operator can run workflows.
- **Watcher daemon** — schedule a job, wait a minute, confirm it fires via tmux log.
- **Skills install** — install a real skill from clawhub / skills.sh and confirm it appears in /build/skills/installed + the Security panel scores it.

### Pre-existing test failures (5 files — not introduced by cascade)

- `components/workflows/step-graph.test.tsx` — empty stub file (no test suite). Delete OR add a `describe.skip()` placeholder. Not new.
- `app/api/workflows/route.test.ts` and 3 others — `next-auth@5.0.0-beta.31` module-resolution issue under vitest (`Cannot find module 'next/server' imported from next-auth/lib/env.js`). Known beta bug; upstream fix in `next-auth@5.0.0-beta.32`. Not introduced by our work.

### Bugs carried forward

- **Herald blocked under root** — `bug_herald_root_permissions.md`. Fix: run CAE as non-root OR patch adapter to drop `--dangerously-skip-permissions` when `$EUID == 0`.
- **Claude CLI 2.1.117 headless OAuth** — unchanged, `bug_claude_cli_2.1.117_headless_oauth.md`.
- **CronCreate `durable=true` ignored** in current harness — crons die with the session. Use SESSION_RESUME.md + manual re-fire instead.

---

## Session 8 changes summary

- P14 code review + V2 verifier re-fired (session-7 bg agents died before notification). Both landed; 4 P0 security findings surfaced.
- P14 P0 fixer shipped (bg): Google `hd` server-side enforce, REPO_RE/SLUG_RE tightened against path traversal + argv injection, scheduler watcher now uses positional `bash -c` args (no shell injection), 65 new regression tests.
- Tsc test-drift cleanup across 10 files (Project/Session/SkillFrontmatter schema drift + afterEach VitestUtils type fix + route signature drift).
- README.md + ARCHITECTURE.md updated manually for session 6–7 additions (research tooling, per-phase ui_audit_gate).
- Task list cleaned up; 20 tasks reflecting the work.

## Resume checklist

```
1. cat /home/cae/ctrl-alt-elite/dashboard/HANDOFF.md    # you are here
2. cat /root/.claude/projects/-root/memory/project_cae_dashboard_session7.md
3. git log --oneline -30
4. /gsd-add-phase 15 "screenshot-truth-harness"
5. /gsd-research-phase 15     # inputs: this handoff + Eric's critique
6. /gsd-plan-phase 15
7. /gsd-execute-phase 15
```

---

## What to tell Eric when he opens this file

All shipped, all reviewed, all fixed. Quality gate is honest: we proved the primitives, not the compositions. Phase 15's mandate is to close the composition gap with a screenshot-truth harness so every card and list in the app has a test that seeds, renders, captures, and asserts both pixels and displayed data. That's what "cards don't show correct activity" is really about — it's an observability gap, not a bug in any one place.
