# audit/ — screenshot-truth harness

Phase 15 capture pipeline. Walks every ROUTES × VIEWPORTS × PERSONAS
cell against a seeded `.cae/metrics/` fixture, writing a full-page PNG,
a `data-truth` DOM extract, and a console-error sidecar per cell.

## One-time setup

```bash
# 1. Generate a secret and put it in .env.local
export AUTH_SECRET=$(openssl rand -base64 32)

# 2. Mint the baseline admin session cookie
AUTH_SECRET=$AUTH_SECRET npx tsx audit/auth/mint-session.ts
# → writes audit/auth/storage-state.json (gitignored)
```

## Run the capture

```bash
# dev server must already be running on :3002 (or set AUDIT_BASE_URL)
AUDIT_BASE_URL=http://localhost:3002 \
  FIXTURE=healthy \
  AUTH_SECRET=$AUTH_SECRET \
  npx playwright test -c audit/playwright.config.ts
```

Fixtures: `empty`, `healthy`, `degraded`, `broken`. One per `.cae/`
state family; see `audit/fixtures/*.ts` for event shapes.

## Output layout

```
audit/shots/<fixture>/<persona>/<slug>--<viewport>.png
audit/shots/<fixture>/<persona>/<slug>--<viewport>.truth.json
audit/shots/<fixture>/<persona>/<slug>--<viewport>.console.json
```

Everything under `audit/shots/` is gitignored. Only `SCORES.md` +
`FINDINGS.md` (under `audit/reports/`) are tracked.

## Unit tests

```bash
AUTH_SECRET=test-secret-not-for-prod-1234567890 npx vitest run audit/
```

Vitest runs the `*.test.ts` files only. The Playwright spec
`runner.spec.ts` is driven by `npx playwright test`.

## Scoring

Seven pillars per `audit/score/rubric.ts`: truth / depth / liveness /
voice / craft / reliability / IA. The heuristic scorer lives in
`audit/score/pillars.ts` — no network, no LLM. Feed it a `CaptureCell`
(see the interface) and it returns per-pillar `{score 1-5, evidence,
recommendations}`. `scoreCell()` runs all pillars.

`craft` is a placeholder-3 until Cap.5 is wired; `ia` is placeholder-3
unless a `<slug>--ia.json` sidecar exists from clickwalk.

## LLM-vision (manual, costs money)

`audit/score/llm-vision.ts` calls Anthropic `/v1/messages` directly with
the PNG + pillar rubric. **Default is dry-run** — tests and CI never
hit the network. To actually score:

```bash
export ANTHROPIC_API_KEY=sk-...
AUDIT_VISION_BUDGET_USD=5 AUDIT_VISION_MODEL=claude-opus-4-7 \
  # then call scoreWithVision(cell, "craft") from a small driver script
```

Results are SHA256-cached under `audit/score/.cache/` (gitignored).
Budget guard aborts before the network call if projected cumulative
USD would exceed the cap. Pricing constants in `llm-vision.ts` are
placeholders — verify against current Anthropic pricing before batch
runs.

## Clickwalk

`audit/scrape/clickwalk.ts` drives every interactive element on a route
and diffs the `[data-truth]` map before/after. Cap 30 elements, skips
destructive + logout + external links. Enable alongside capture:

```bash
AUDIT_CLICKWALK=1 FIXTURE=healthy AUTH_SECRET=... \
  npx playwright test -c audit/playwright.config.ts
```

Output sidecar: `audit/shots/<fixture>/<persona>/<slug>--clickwalk.json`.
