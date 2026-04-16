#!/usr/bin/env bash
# CAE Claude Code adapter
# Spawns a tmux pane running `claude --print`, captures output to files.
#
# Usage:
#   adapters/claude-code.sh <task_file> <model> <session_id> [options]
#
# Options:
#   --agent <name>            Invoke claude with --agent <name> (wrap mode)
#   --system-prompt-file <f>  Invoke claude with --append-system-prompt-file <f> (direct-prompt mode)
#   --effort <level>          Claude effort level (default: max)
#   --permission-mode <m>     Claude permission mode (default: plan for wrapped checkers, default for direct-prompt)
#   --timeout <secs>          Kill the tmux session if command runs this long (default: 1800)
#
# Exit codes:
#   0  = success (output file has content)
#   1  = claude returned non-zero
#   2  = timeout
#   3  = bad arguments
#
# Output files:
#   <task_file>.output  = stdout from claude
#   <task_file>.error   = stderr from claude
#   <task_file>.meta    = metadata (session_id, exit_code, duration, model, invocation)

set -uo pipefail

die() { echo "error: $*" >&2; exit 3; }

# ─── Parse args ─────────────────────────────────────────────────────────
TASK_FILE="${1:-}"
MODEL="${2:-}"
SESSION_ID="${3:-}"
[[ -z "$TASK_FILE" || -z "$MODEL" || -z "$SESSION_ID" ]] && die "usage: claude-code.sh <task_file> <model> <session_id> [options]"
shift 3

AGENT=""
SYSTEM_PROMPT_FILE=""
EFFORT="max"
PERM_MODE=""
TIMEOUT_SECS=1800

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent) AGENT="$2"; shift 2 ;;
    --system-prompt-file) SYSTEM_PROMPT_FILE="$2"; shift 2 ;;
    --effort) EFFORT="$2"; shift 2 ;;
    --permission-mode) PERM_MODE="$2"; shift 2 ;;
    --timeout) TIMEOUT_SECS="$2"; shift 2 ;;
    *) die "unknown arg: $1" ;;
  esac
done

[[ ! -f "$TASK_FILE" ]] && die "task file not found: $TASK_FILE"
[[ -n "$AGENT" && -n "$SYSTEM_PROMPT_FILE" ]] && die "--agent and --system-prompt-file are mutually exclusive"
[[ -z "$AGENT" && -z "$SYSTEM_PROMPT_FILE" ]] && die "must specify --agent or --system-prompt-file"

command -v claude >/dev/null 2>&1 || die "claude CLI not on PATH"
command -v tmux >/dev/null 2>&1 || die "tmux not installed"

# ─── Build claude invocation ────────────────────────────────────────────
TMUX_SESSION="cae-${SESSION_ID}"
OUT_FILE="${TASK_FILE}.output"
ERR_FILE="${TASK_FILE}.error"
META_FILE="${TASK_FILE}.meta"

# Clean prior artifacts for this task
: > "$OUT_FILE"
: > "$ERR_FILE"

CLAUDE_ARGS=(--print --effort "$EFFORT" --model "$MODEL")
if [[ -n "$AGENT" ]]; then
  CLAUDE_ARGS+=(--agent "$AGENT")
  INVOCATION_DESC="wrap:$AGENT"
fi
if [[ -n "$SYSTEM_PROMPT_FILE" ]]; then
  [[ ! -f "$SYSTEM_PROMPT_FILE" ]] && die "system prompt file not found: $SYSTEM_PROMPT_FILE"
  CLAUDE_ARGS+=(--append-system-prompt-file "$SYSTEM_PROMPT_FILE")
  INVOCATION_DESC="direct:$(basename "$SYSTEM_PROMPT_FILE")"
fi
if [[ -n "$PERM_MODE" ]]; then
  CLAUDE_ARGS+=(--permission-mode "$PERM_MODE")
fi

# ─── Spawn tmux session running the command ─────────────────────────────
START_TS=$(date +%s)
CWD="$(pwd)"  # Inherit invoker's cwd into tmux session (matters for plan mode)

# Kill any stale session with the same name
tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true

# Build the command that runs inside the tmux pane.
# - cd to invoker's cwd (claude plan mode is cwd-sensitive)
# - Redirect stdin from task file, stdout to output file, stderr to error file
# - Write exit code to meta file atomically (tmp + mv) so the waiting loop can detect completion
INNER_CMD="cd $(printf '%q' "$CWD") && claude $(printf '%q ' "${CLAUDE_ARGS[@]}") < $(printf '%q' "$TASK_FILE") > $(printf '%q' "$OUT_FILE") 2> $(printf '%q' "$ERR_FILE"); echo \"exit_code=\$?\" > $(printf '%q' "${META_FILE}.tmp") && mv $(printf '%q' "${META_FILE}.tmp") $(printf '%q' "${META_FILE}.done")"

tmux new-session -d -s "$TMUX_SESSION" "$INNER_CMD"

# ─── Wait for completion or timeout ─────────────────────────────────────
DONE_MARKER="${META_FILE}.done"
ELAPSED=0
POLL_INTERVAL=2

while [[ $ELAPSED -lt $TIMEOUT_SECS ]]; do
  if [[ -f "$DONE_MARKER" ]]; then
    break
  fi
  # Also break if tmux session is gone but marker missing (crash)
  if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    sleep 1  # let any final file writes flush
    break
  fi
  sleep $POLL_INTERVAL
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

END_TS=$(date +%s)
DURATION=$((END_TS - START_TS))

# ─── Resolve exit code ──────────────────────────────────────────────────
if [[ -f "$DONE_MARKER" ]]; then
  EXIT_CODE=$(grep -oE 'exit_code=[0-9]+' "$DONE_MARKER" | cut -d= -f2)
  EXIT_CODE="${EXIT_CODE:-1}"
  rm -f "$DONE_MARKER"
elif [[ $ELAPSED -ge $TIMEOUT_SECS ]]; then
  # Timeout — kill session, mark as timeout
  tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
  EXIT_CODE=2
  echo "TIMEOUT after ${TIMEOUT_SECS}s" >> "$ERR_FILE"
else
  # Session died without writing marker — crash
  EXIT_CODE=1
  echo "CRASH: tmux session exited without completion marker" >> "$ERR_FILE"
fi

# Clean up session (if still present)
tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true

# ─── Write metadata ─────────────────────────────────────────────────────
cat > "$META_FILE" <<META_EOF
{
  "session_id": "$SESSION_ID",
  "tmux_session": "$TMUX_SESSION",
  "exit_code": $EXIT_CODE,
  "duration_seconds": $DURATION,
  "model": "$MODEL",
  "invocation": "$INVOCATION_DESC",
  "effort": "$EFFORT",
  "permission_mode": "${PERM_MODE:-default}",
  "output_bytes": $(wc -c < "$OUT_FILE"),
  "error_bytes": $(wc -c < "$ERR_FILE"),
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
META_EOF

exit "$EXIT_CODE"
