#!/usr/bin/env bash
# audit-hook.sh — PostToolUse hook that appends a JSONL line to .cae/metrics/tool-calls.jsonl
#
# Required env vars (injected by Claude's PostToolUse hook mechanism):
#   CAE_TASK_ID      — current CAE task ID (e.g. "t-abc123"); default "unknown"
#   CLAUDE_TOOL_NAME — name of the tool that just fired (e.g. "Bash", "Write")
#   CAE_ROOT         — absolute path to the repo root; default /home/cae/ctrl-alt-elite
#
# T-14-01-02: jq uses --arg for typed argument passing (no shell interpolation).
# WR-04: printf fallback now hand-escapes PWD before embedding in JSON string
#         to prevent malformed JSONL from paths containing `"`, `\`, or newlines.
#
# NOTE: This script is designed to be sourced or executed as a PostToolUse hook.
# Registration in ~/.claude/settings.json happens in Plan 14-05 (Security wave).
# Do NOT modify that file here — see plan notes for cross-wave hook collision policy.

set -euo pipefail

# Plan 14-05: double-gate filter — only log mutation tools.
# The settings.json matcher is the primary filter; this is defense-in-depth
# so accidental matcher removal doesn't flood the log with Read events.
case "${CLAUDE_TOOL_NAME:-}" in
  Bash|Write|Edit|MultiEdit|Agent|Task) ;;
  *) exit 0 ;;
esac

: "${CAE_TASK_ID:=unknown}"
: "${CAE_ROOT:=/home/cae/ctrl-alt-elite}"
TOOL="${CLAUDE_TOOL_NAME:-unknown}"
TS=$(date -u +%FT%TZ)
AUDIT="${CAE_ROOT}/.cae/metrics/tool-calls.jsonl"

mkdir -p "$(dirname "$AUDIT")"

if command -v jq >/dev/null 2>&1; then
  # T-14-01-02: typed --arg prevents injection even if values contain quotes/backslashes
  jq -nc \
    --arg ts   "$TS" \
    --arg task "$CAE_TASK_ID" \
    --arg tool "$TOOL" \
    --arg cwd  "$PWD" \
    '{ts:$ts,task:$task,tool:$tool,cwd:$cwd}' >> "$AUDIT"
else
  # WR-04: jq is unavailable — hand-escape PWD before embedding in JSON.
  # Linux paths may legally contain `"`, `\`, or even newlines, any of which
  # would produce malformed JSONL that the downstream parser silently drops.
  #
  # Escape sequence:
  #   1. Replace every `\` with `\\`  (must come first to avoid double-escaping)
  #   2. Replace every `"` with `\"`
  #   3. Refuse to log if PWD contains a literal newline (cannot safely embed)
  esc_cwd="${PWD//\\/\\\\}"
  esc_cwd="${esc_cwd//\"/\\\"}"
  # Bail out silently if PWD contains a newline — better to lose one log entry
  # than to write a malformed JSONL line that corrupts the audit stream.
  case "$esc_cwd" in
    *$'\n'*) exit 0 ;;
  esac
  # shellcheck disable=SC2059
  printf '{"ts":"%s","task":"%s","tool":"%s","cwd":"%s"}\n' \
    "$TS" "$CAE_TASK_ID" "$TOOL" "$esc_cwd" >> "$AUDIT"
fi

exit 0
