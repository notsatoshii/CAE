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
