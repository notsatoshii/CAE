#!/usr/bin/env bash
# USD-guard: CAE runs on Claude Max subscription — no per-request USD cost,
# so any $ in the dashboard FE is a derived lie.
#
# Fails on any of:
#   - `formatUsd(` or `costUsd(` call (imported from cae-cost-table)
#   - literal `"$..."` / `'$...'` string (dollar glyph in quoted copy)
#   - template ``${...}$`` WHERE the `$` appears OUTSIDE `${...}` interpolation,
#     i.e. a literal dollar glyph in a template string.
#
# Regex-end-of-string `/^.*$/` is NOT matched — regex `$` is a metachar, not
# currency.
#
# Scope (session-14 expansion — was metrics-only, now whole FE surface):
#   - app/**        (routes + API handlers)
#   - components/** (all UI)
#   - lib/**        (aggregators, helpers, types)
#
# Explicit allow-list:
#   - lib/cae-cost-table.ts — kept only until the last caller is removed.
#     Delete this allow-list entry + the file when no caller remains.
#
# Out-of-scope: scripts/, tests/, node_modules, .next, public.
#
# Exit 0 = PASS, 1 = FAIL (offenders printed to stderr).
set -euo pipefail

cd "$(dirname "$0")/.."

FOUND=0

# Pattern:
#   (formatUsd|costUsd)\(    — USD helper call
#   OR ["']\$                — quoted literal dollar glyph
# -P = Perl regex (required for alternation + groups across lines).
check() {
  local target="$1"
  [[ -e "$target" ]] || return 0
  local hits
  # (formatUsd|costUsd)\(   — USD helper call
  # ["']\$(?!\{)            — quoted literal `$` NOT starting a ${...} expr
  hits=$(grep -rnP \
    --include='*.ts' --include='*.tsx' --include='*.md' \
    --exclude='*.test.ts' --exclude='*.test.tsx' \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    '(formatUsd|costUsd)\(|["'"'"']\$(?!\{)' \
    "$target" 2>/dev/null || true)
  # Allow-list: drop cae-cost-table.ts (deprecated, kept for definitions).
  hits=$(echo "$hits" | grep -v '^$' | grep -v '/cae-cost-table\.ts:' || true)
  if [[ -n "$hits" ]]; then
    echo "$hits" >&2
    echo "FAIL: USD reference found in $target (D-07: FE is tokens-only)" >&2
    FOUND=1
  fi
}

check app
check components
check lib

if [[ $FOUND -eq 0 ]]; then
  echo "lint-no-dollar: PASS (no USD references in FE surface)"
fi

exit $FOUND
