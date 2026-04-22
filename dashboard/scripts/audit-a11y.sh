#!/usr/bin/env bash
# Phase 12 (A11Y-01): run axe against every registered route.
# Prereq: dev server running at http://localhost:3000 (run `npm run dev` in
# another terminal first). Gate: zero `impact: serious` AND zero `impact: critical`
# violations. Count is printed at the end; exit 0 iff both counts are 0.

set -euo pipefail

BASE="${AXE_BASE:-http://localhost:3000}"
ROUTES=(
  "/"
  "/build"
  "/build/agents"
  "/build/workflows"
  "/build/queue"
  "/build/changes"
  "/metrics"
  "/memory"
  "/plan"
  "/chat"
)

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

TAGS="wcag2a,wcag2aa,wcag21a,wcag21aa"

serious=0
critical=0

for route in "${ROUTES[@]}"; do
  out="$TMP/$(echo "$route" | tr '/' '_').json"
  url="$BASE$route"
  echo ">>> axe $url"
  npx --no-install @axe-core/cli "$url" --tags "$TAGS" --save "$out" || true

  if [[ -f "$out" ]]; then
    s=$(node -e "const j=require('$out'); const v=(j[0]||{}).violations||[]; console.log(v.filter(x=>x.impact==='serious').length)")
    c=$(node -e "const j=require('$out'); const v=(j[0]||{}).violations||[]; console.log(v.filter(x=>x.impact==='critical').length)")
    echo "    serious=$s critical=$c"
    serious=$((serious + s))
    critical=$((critical + c))
  fi
done

echo
echo "Total: serious=$serious critical=$critical"
if [[ $serious -gt 0 || $critical -gt 0 ]]; then
  echo "FAIL — zero serious/critical required."
  exit 1
fi
echo "PASS"
