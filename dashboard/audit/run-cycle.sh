#!/usr/bin/env bash
# audit/run-cycle.sh — Phase 15 Cap.7.
#
# One-command cycle driver. Seeds a fixture, mints session cookies,
# health-checks the dev server, runs Playwright, scores the output.
#
# Usage:
#   audit/run-cycle.sh <cycle-label> [fixture] [--vision] [--prior <label>]
#
# Env:
#   AUTH_SECRET          — required (or NEXTAUTH_SECRET for v4 compat).
#   AUDIT_BASE_URL       — default http://localhost:3002
#   AUDIT_CLICKWALK      — default 0 (pass-through to Playwright).
#   CAE_ROOT             — default ./audit/.cae-run (fixture scratch dir).
#
# The dev server is NOT booted by this script. You run `pnpm dev` in a
# separate terminal; we probe /api/auth/session and exit fast if it's
# not reachable. This avoids stale dev processes + port fights.

set -euo pipefail

# Relocate to dashboard/ regardless of caller cwd so `audit/...` paths
# resolve consistently from npx/tsx/playwright.
cd "$(dirname "$0")/.."

LABEL="${1:-}"
FIXTURE="${2:-healthy}"
shift 2 || true

VISION=""
PRIOR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --vision) VISION="--vision"; shift ;;
    --prior) PRIOR="--prior $2"; shift 2 ;;
    *) echo "[cycle] unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "${LABEL}" ]]; then
  echo "Usage: audit/run-cycle.sh <cycle-label> [fixture] [--vision] [--prior <label>]" >&2
  exit 2
fi

# Allow either AUTH_SECRET or NEXTAUTH_SECRET — mirror runner.spec.ts.
if [[ -z "${AUTH_SECRET:-}" && -z "${NEXTAUTH_SECRET:-}" ]]; then
  echo "[cycle] AUTH_SECRET (or NEXTAUTH_SECRET) is required." >&2
  echo "       export AUTH_SECRET=\$(openssl rand -base64 32)" >&2
  exit 2
fi

BASE_URL="${AUDIT_BASE_URL:-http://localhost:3002}"
CLICKWALK="${AUDIT_CLICKWALK:-0}"

echo "[cycle] STEP 1/7 — seed fixture ${FIXTURE}"
npx tsx audit/seed-fixture.ts "${FIXTURE}"

echo "[cycle] STEP 2/7 — mint session cookie"
npx tsx audit/auth/mint-session-cli.ts

echo "[cycle] STEP 3/7 — health-check dev server (${BASE_URL})"
if ! curl -sSf -o /dev/null --max-time 5 "${BASE_URL}/api/auth/session"; then
  echo "[cycle] dev server not reachable at ${BASE_URL}." >&2
  echo "[cycle] Run in another terminal: pnpm dev" >&2
  echo "[cycle] Or set AUDIT_BASE_URL to a live preview URL." >&2
  exit 3
fi

echo "[cycle] STEP 4/7 — run playwright (fixture=${FIXTURE} clickwalk=${CLICKWALK})"
FIXTURE="${FIXTURE}" AUDIT_CLICKWALK="${CLICKWALK}" AUDIT_BASE_URL="${BASE_URL}" \
  npx playwright test -c audit/playwright.config.ts

echo "[cycle] STEP 5/7 — score run ${LABEL}"
# shellcheck disable=SC2086 # intentional word-splitting for optional flags
npx tsx audit/score-run.ts "${LABEL}" --fixture "${FIXTURE}" ${VISION} ${PRIOR}

echo "[cycle] STEP 6/7 — reports written:"
for f in "audit/reports/${LABEL}-SCORES.md" \
         "audit/reports/${LABEL}-FINDINGS.md" \
         "audit/reports/${LABEL}-SUMMARY.json" \
         "audit/reports/${LABEL}-DELTA.md"; do
  [[ -f "$f" ]] && echo "[cycle]   $f"
done

echo "[cycle] STEP 7/7 — cycle complete: ${LABEL} (${FIXTURE})"
