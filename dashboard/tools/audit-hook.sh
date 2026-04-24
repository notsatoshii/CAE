#!/usr/bin/env bash
# audit-hook.sh — PostToolUse hook that appends a JSONL line to
# .cae/metrics/tool-calls.jsonl.
#
# Claude Code hook I/O (current API, session-14 fix):
#   - Tool metadata arrives on STDIN as a single JSON object, not env vars.
#   - Relevant fields: `tool_name`, `session_id`, `cwd`.
#   - Old API used CLAUDE_TOOL_NAME env; that is no longer populated.
#
# Other env vars still used:
#   CAE_TASK_ID — current CAE task ID (e.g. "t-abc123"); default "unknown"
#   CAE_ROOT    — absolute path to repo root; default /home/cae/ctrl-alt-elite
#
# Registered in ~/.claude/settings.json as PostToolUse matcher
#   "Bash|Write|Edit|MultiEdit|Agent|Task".

set -euo pipefail

# Read stdin (JSON payload) once, non-blocking-ish via `cat` inside subshell.
# Claude Code writes the payload and closes stdin so cat returns immediately.
STDIN_JSON="$(cat 2>/dev/null || true)"

# Extract tool_name from stdin JSON. Fall back to legacy env for forward-compat
# if Anthropic ever restores env-var injection.
if command -v jq >/dev/null 2>&1 && [ -n "$STDIN_JSON" ]; then
  TOOL="$(printf '%s' "$STDIN_JSON" | jq -r '.tool_name // empty' 2>/dev/null || true)"
  STDIN_CWD="$(printf '%s' "$STDIN_JSON" | jq -r '.cwd // empty' 2>/dev/null || true)"
else
  TOOL=""
  STDIN_CWD=""
fi
[ -z "$TOOL" ] && TOOL="${CLAUDE_TOOL_NAME:-}"

# Diagnostic — retained at low cost; rotate /tmp/audit-hook-debug.log manually.
echo "$(date -u +%FT%TZ) hook_called tool=${TOOL:-MISSING} src=$([ -n "$STDIN_JSON" ] && echo stdin || echo env)" >> /tmp/audit-hook-debug.log 2>/dev/null || true

# Double-gate filter — only log mutation tools. The settings.json matcher is
# the primary filter; this is defense-in-depth.
case "$TOOL" in
  Bash|Write|Edit|MultiEdit|Agent|Task) ;;
  *) exit 0 ;;
esac

: "${CAE_TASK_ID:=unknown}"
: "${CAE_ROOT:=/home/cae/ctrl-alt-elite}"
TS=$(date -u +%FT%TZ)
AUDIT="${CAE_ROOT}/.cae/metrics/tool-calls.jsonl"
CWD="${STDIN_CWD:-$PWD}"

mkdir -p "$(dirname "$AUDIT")"

if command -v jq >/dev/null 2>&1; then
  # T-14-01-02: typed --arg prevents injection even if values contain quotes/backslashes
  jq -nc \
    --arg ts   "$TS" \
    --arg task "$CAE_TASK_ID" \
    --arg tool "$TOOL" \
    --arg cwd  "$CWD" \
    '{ts:$ts,task:$task,tool:$tool,cwd:$cwd}' >> "$AUDIT"
else
  # WR-04: jq is unavailable — hand-escape CWD before embedding in JSON.
  # Linux paths may legally contain `"`, `\`, or even newlines, any of which
  # would produce malformed JSONL that the downstream parser silently drops.
  esc_cwd="${CWD//\\/\\\\}"
  esc_cwd="${esc_cwd//\"/\\\"}"
  case "$esc_cwd" in
    *$'\n'*) exit 0 ;;
  esac
  # shellcheck disable=SC2059
  printf '{"ts":"%s","task":"%s","tool":"%s","cwd":"%s"}\n' \
    "$TS" "$CAE_TASK_ID" "$TOOL" "$esc_cwd" >> "$AUDIT"
fi

exit 0
