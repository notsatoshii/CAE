#!/usr/bin/env bash
# Phase 12 (EQA-01): every <ExplainTooltip text={L.KEY}> must reference a KEY
# present in BOTH the FOUNDER and DEV blocks of lib/copy/labels.ts. Fails fast
# on any hit that can't be resolved.

set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Grep every ExplainTooltip call site and pull the key after `L.` in text={L.xxx}.
# Captures both `text={L.foo}` and `text={L.foo("arg")}` forms.
mapfile -t keys < <(
  rg -INoP 'ExplainTooltip[\s\S]*?text=\{L\.(\w+)' \
    --multiline --multiline-dotall \
    components app \
  | rg -oP 'text=\{L\.\K\w+' \
  | sort -u
)

if [[ ${#keys[@]} -eq 0 ]]; then
  echo "No ExplainTooltip text={L.*} sites found — either grep is wrong or every site was removed."
  exit 1
fi

# 2. For each key, check both FOUNDER and DEV blocks contain it.
labels="lib/copy/labels.ts"
missing_founder=()
missing_dev=()

for k in "${keys[@]}"; do
  # Search for `k:` within 500 lines after `const FOUNDER: Labels = {` and
  # within 500 lines after `const DEV: Labels = {`.
  if ! awk -v key="$k" '
    /^const FOUNDER: Labels = \{/ { inF = 1; next }
    /^const DEV: Labels = \{/    { inF = 0 }
    inF && $0 ~ ("^[[:space:]]+" key "[[:space:]]*:") { found = 1; exit }
    END { exit found ? 0 : 1 }
  ' "$labels"; then
    missing_founder+=("$k")
  fi
  if ! awk -v key="$k" '
    /^const DEV: Labels = \{/ { inF = 1; next }
    /^const FOUNDER: Labels = \{/ { inF = 0 }
    inF && $0 ~ ("^[[:space:]]+" key "[[:space:]]*:") { found = 1; exit }
    END { exit found ? 0 : 1 }
  ' "$labels"; then
    missing_dev+=("$k")
  fi
done

status=0
if [[ ${#missing_founder[@]} -gt 0 ]]; then
  echo "MISSING in FOUNDER block: ${missing_founder[*]}"
  status=1
fi
if [[ ${#missing_dev[@]} -gt 0 ]]; then
  echo "MISSING in DEV block: ${missing_dev[*]}"
  status=1
fi

if [[ $status -eq 0 ]]; then
  echo "PASS — ${#keys[@]} keys, all present in both FOUNDER and DEV."
fi
exit $status
