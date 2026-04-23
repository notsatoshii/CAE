#!/usr/bin/env bash
# install-audit-hook.sh — Idempotently register audit-hook.sh in ~/.claude/settings.json
#
# Plan 14-05: Adds a PostToolUse hook entry for mutation tool auditing.
# CRITICAL: Existing Phase 8 memory-consult-hook.sh entry is PRESERVED.
# Running this script twice leaves exactly ONE audit-hook.sh entry.
#
# Usage: bash scripts/install-audit-hook.sh
# Manual step — do NOT run automatically from tests (would modify real settings).

set -euo pipefail

SETTINGS="$HOME/.claude/settings.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$(cd "$SCRIPT_DIR/../tools" && pwd)"
HOOK_CMD="bash ${TOOLS_DIR}/audit-hook.sh"

# Require jq
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required but not found. Install with: apt-get install jq" >&2
  exit 1
fi

# Create settings.json with minimal shape if missing
if [[ ! -f "$SETTINGS" ]]; then
  mkdir -p "$(dirname "$SETTINGS")"
  echo '{"hooks":{"PostToolUse":[]}}' > "$SETTINGS"
  echo "Created $SETTINGS"
fi

# Check if our hook command is already registered anywhere in PostToolUse
if jq -e --arg cmd "$HOOK_CMD" \
  '[.hooks.PostToolUse[]?.hooks[]?] | map(select(.command == $cmd)) | length > 0' \
  "$SETTINGS" >/dev/null 2>&1; then
  ALREADY=$(jq --arg cmd "$HOOK_CMD" \
    '[.hooks.PostToolUse[]?.hooks[]?] | map(select(.command == $cmd)) | length' \
    "$SETTINGS")
  if [[ "$ALREADY" -gt 0 ]]; then
    echo "audit-hook already registered — nothing to do"
    exit 0
  fi
fi

# Append a new PostToolUse entry for the audit hook
tmp=$(mktemp)
jq --arg cmd "$HOOK_CMD" '
  .hooks.PostToolUse = ((.hooks.PostToolUse // []) + [{
    "matcher": "Bash|Write|Edit|MultiEdit|Agent|Task",
    "hooks": [{"type": "command", "command": $cmd, "timeout": 3}]
  }])
' "$SETTINGS" > "$tmp"

mv "$tmp" "$SETTINGS"
echo "audit-hook registered in $SETTINGS"
echo "Verify with: jq '.hooks.PostToolUse | length' $SETTINGS"
