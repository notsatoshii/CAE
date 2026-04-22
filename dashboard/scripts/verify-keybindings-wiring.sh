#!/usr/bin/env bash
# Phase 12 (SHO-01 enforcement): no hardcoded key literals in the providers.
# Allow-list: lib/keybindings.ts itself + test files + comments.
set -euo pipefail
cd "$(dirname "$0")/.."

# Any line in the 5 migrated files that hardcodes a key comparison is a
# regression. Providers MUST go through matchesKeydown. Note: lib/providers/
# is scoped to explain-mode + dev-mode only (chat-rail has a pre-existing Esc
# guard that is out of scope for this migration).
OFFENDERS=$(rg -n --pcre2 \
  'e\.key(?:\.toLowerCase\(\))?\s*===\s*"(?:e|k|d|\?|Escape|\.)"' \
  lib/providers/explain-mode.tsx lib/providers/dev-mode.tsx \
  lib/hooks/use-sheet-keys.ts \
  lib/hooks/use-command-palette.tsx lib/hooks/use-shortcut-overlay.tsx \
  || true)

if [[ -n "$OFFENDERS" ]]; then
  echo "FAIL — hardcoded key comparisons still present:"
  echo "$OFFENDERS"
  exit 1
fi

# Also require each provider imports from lib/keybindings.
for f in lib/providers/explain-mode.tsx lib/providers/dev-mode.tsx \
         lib/hooks/use-sheet-keys.ts \
         lib/hooks/use-command-palette.tsx lib/hooks/use-shortcut-overlay.tsx; do
  if ! rg -q 'from "@/lib/keybindings"' "$f"; then
    echo "FAIL — $f does not import from @/lib/keybindings"
    exit 1
  fi
done

echo "PASS — all providers route through KEYBINDINGS."
