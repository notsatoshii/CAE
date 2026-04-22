#!/usr/bin/env bash
# audit-hook.sh — PostToolUse hook that appends a JSONL line to .cae/metrics/tool-calls.jsonl
#
# Required env vars (injected by Claude's PostToolUse hook mechanism):
#   CAE_TASK_ID      — current CAE task ID (e.g. "t-abc123"); default "unknown"
#   CLAUDE_TOOL_NAME — name of the tool that just fired (e.g. "Bash", "Write")
#   CAE_ROOT         — absolute path to the repo root; default /home/cae/ctrl-alt-elite
#
# T-14-01-02: jq uses --arg for typed argument passing (no shell interpolation).
# printf fallback uses %s format specifiers only — safe for filesystem paths.
#
# NOTE: This script is designed to be sourced or executed as a PostToolUse hook.
# Registration in ~/.claude/settings.json happens in Plan 14-05 (Security wave).
# Do NOT modify that file here — see plan notes for cross-wave hook collision policy.

set -euo pipefail

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
  # Fallback: hand-written JSON. PWD is always a filesystem path (no special chars expected).
  # shellcheck disable=SC2059
  printf '{"ts":"%s","task":"%s","tool":"%s","cwd":"%s"}\n' \
    "$TS" "$CAE_TASK_ID" "$TOOL" "$PWD" >> "$AUDIT"
fi

exit 0
