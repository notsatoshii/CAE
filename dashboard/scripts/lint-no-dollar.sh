#!/usr/bin/env bash
# USD-guard: Phase 7 locks metrics copy to tokens-only (D-07).
# This script exits 1 if any literal `$` appears in metrics-owned files,
# excluding template-expression uses (`${...}`).
#
# Scope (explicit — expand carefully):
#   - app/metrics/**
#   - components/metrics/**
#   - lib/copy/labels.ts (metrics.* keys only)
#
# Out-of-scope (allowed to contain $ — not metrics copy):
#   - Everything else in the repo.
#
# Rationale: CONTEXT D-07 + D-12 — COST IS TOKENS ONLY, no currency anywhere
# in the metrics surface. The `est.` disclaimer is about token-to-cost
# *estimation*, NOT a dollar sign. This script runs in Wave 4 verification
# and is intended to be hooked into CI later.
#
# Usage:
#   cd dashboard && ./scripts/lint-no-dollar.sh
#
# Exit codes:
#   0 — PASS (no literal `$` found in metrics copy)
#   1 — FAIL (literal `$` found; offending files printed to stderr)
set -euo pipefail

cd "$(dirname "$0")/.."

FOUND=0

# Negative-lookbehind `(?<!\\)` keeps escaped `\$` out of the match; the
# negative-lookahead `(?!\{)` keeps template expressions `${…}` out.
# -P = Perl regex (required for lookaround).
# Include only .ts / .tsx / .md files.
check() {
  local target="$1"
  if [[ -e "$target" ]]; then
    if grep -rnP --include='*.ts' --include='*.tsx' --include='*.md' '(?<!\\)\$(?!\{)' "$target" 2>/dev/null; then
      echo "FAIL: literal \$ found in $target (D-07: metrics copy is tokens-only)" >&2
      FOUND=1
    fi
  fi
}

check app/metrics
check components/metrics

# For labels.ts, restrict the scan to the Phase 7 Metrics block only
# (other phases may legitimately use `$` in cost-related copy).
if [[ -f lib/copy/labels.ts ]]; then
  # Use awk to extract the block between the two Phase 7 markers
  # (the `// === Phase 7: Metrics ===` comments flank the metrics.* keys).
  METRICS_BLOCK=$(awk '
    /=== Phase 7: Metrics ===/ { inblock = !inblock; next }
    inblock { print }
  ' lib/copy/labels.ts)
  if echo "$METRICS_BLOCK" | grep -nP '(?<!\\)\$(?!\{)' >/dev/null 2>&1; then
    echo "FAIL: literal \$ found in Phase 7 metrics.* block in lib/copy/labels.ts (D-07)" >&2
    echo "$METRICS_BLOCK" | grep -nP '(?<!\\)\$(?!\{)' >&2 || true
    FOUND=1
  fi
fi

if [[ $FOUND -eq 0 ]]; then
  echo "lint-no-dollar: PASS (no literal \$ in metrics copy)"
fi

exit $FOUND
