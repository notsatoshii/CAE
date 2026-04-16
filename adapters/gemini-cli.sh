#!/usr/bin/env bash
# CAE Gemini CLI adapter
# Mirrors adapters/claude-code.sh interface — tmux-spawned subprocess wrapping
# `gemini --print`, captures stdout/stderr/meta to files.
#
# Usage:
#   adapters/gemini-cli.sh <task_file> <model> <session_id> [options]
#
# Options:
#   --system-prompt-file <f>  Prepend this file's content to the task as system context
#   --format json             Require JSON output; validate + fail loudly if malformed
#   --timeout <secs>          Kill the tmux session after this long (default: 600)
#
# Exit codes:
#   0  = success (output file has valid content)
#   1  = gemini returned non-zero
#   2  = timeout
#   3  = bad arguments
#   4  = JSON validation failed (when --format json)
#
# Output files:
#   <task_file>.output  = stdout from gemini
#   <task_file>.error   = stderr from gemini
#   <task_file>.meta    = metadata JSON
#
# UNTESTED until T1 (Gemini CLI install + OAuth) completes. The interface is
# stable; when T1 lands, this adapter should work without code changes.

set -uo pipefail

die() { echo "error: $*" >&2; exit 3; }

TASK_FILE="${1:-}"
MODEL="${2:-}"
SESSION_ID="${3:-}"
[[ -z "$TASK_FILE" || -z "$MODEL" || -z "$SESSION_ID" ]] && die "usage: gemini-cli.sh <task_file> <model> <session_id> [options]"
shift 3

SYSTEM_PROMPT_FILE=""
FORMAT=""
TIMEOUT_SECS=600

while [[ $# -gt 0 ]]; do
  case "$1" in
    --system-prompt-file) SYSTEM_PROMPT_FILE="$2"; shift 2 ;;
    --format) FORMAT="$2"; shift 2 ;;
    --timeout) TIMEOUT_SECS="$2"; shift 2 ;;
    *) die "unknown arg: $1" ;;
  esac
done

[[ ! -f "$TASK_FILE" ]] && die "task file not found: $TASK_FILE"
command -v gemini >/dev/null 2>&1 || die "gemini CLI not on PATH — run T1 (install Gemini CLI + OAuth) first"
command -v tmux >/dev/null 2>&1 || die "tmux not installed"

# ─── Compose the input file ─────────────────────────────────────────────
# Gemini CLI doesn't have a --system-prompt-file equivalent, so we prepend
# the system prompt inline to the task content and pipe the composed result.
COMPOSED_INPUT="$TASK_FILE"
if [[ -n "$SYSTEM_PROMPT_FILE" ]]; then
  [[ ! -f "$SYSTEM_PROMPT_FILE" ]] && die "system prompt file not found: $SYSTEM_PROMPT_FILE"
  COMPOSED_INPUT=$(mktemp "/tmp/gemini-input.XXXXXX.md")
  {
    echo "# System instructions"
    cat "$SYSTEM_PROMPT_FILE"
    echo ""
    echo "---"
    echo ""
    echo "# Task"
    cat "$TASK_FILE"
  } > "$COMPOSED_INPUT"
fi

# ─── Build gemini invocation ────────────────────────────────────────────
TMUX_SESSION="cae-${SESSION_ID}"
OUT_FILE="${TASK_FILE}.output"
ERR_FILE="${TASK_FILE}.error"
META_FILE="${TASK_FILE}.meta"

: > "$OUT_FILE"
: > "$ERR_FILE"

# Gemini CLI accepts --model and reads prompt from stdin in non-interactive mode.
# Reference: `gemini --help` — adjust flags if the CLI changed since T6 written.
GEMINI_ARGS=(--model "$MODEL")
if [[ "$FORMAT" == "json" ]]; then
  # Some versions of gemini-cli support --response-format or similar.
  # If the installed CLI doesn't, we just validate JSON after the fact.
  # Left commented because flag stability is unconfirmed:
  # GEMINI_ARGS+=(--response-format json)
  :
fi

INVOCATION_DESC="gemini:${MODEL}"
[[ -n "$SYSTEM_PROMPT_FILE" ]] && INVOCATION_DESC="$INVOCATION_DESC+$(basename "$SYSTEM_PROMPT_FILE")"

# ─── Spawn tmux session ─────────────────────────────────────────────────
START_TS=$(date +%s)
CWD="$(pwd)"

tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true

INNER_CMD="cd $(printf '%q' "$CWD") && gemini $(printf '%q ' "${GEMINI_ARGS[@]}") < $(printf '%q' "$COMPOSED_INPUT") > $(printf '%q' "$OUT_FILE") 2> $(printf '%q' "$ERR_FILE"); echo \"exit_code=\$?\" > $(printf '%q' "${META_FILE}.tmp") && mv $(printf '%q' "${META_FILE}.tmp") $(printf '%q' "${META_FILE}.done")"

tmux new-session -d -s "$TMUX_SESSION" "$INNER_CMD"

# ─── Wait for completion or timeout ─────────────────────────────────────
DONE_MARKER="${META_FILE}.done"
ELAPSED=0
POLL_INTERVAL=2

while [[ $ELAPSED -lt $TIMEOUT_SECS ]]; do
  if [[ -f "$DONE_MARKER" ]]; then
    break
  fi
  if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    sleep 1
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
  tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
  EXIT_CODE=2
  echo "TIMEOUT after ${TIMEOUT_SECS}s" >> "$ERR_FILE"
else
  EXIT_CODE=1
  echo "CRASH: tmux session exited without completion marker" >> "$ERR_FILE"
fi

tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true

# ─── JSON validation (when requested) ───────────────────────────────────
JSON_VALID=""
if [[ "$FORMAT" == "json" && "$EXIT_CODE" == "0" ]]; then
  # Some Gemini outputs wrap JSON in ```json fences — try to extract.
  CANDIDATE=$(sed -n '/^```json$/,/^```$/p' "$OUT_FILE" | grep -v '^```' || true)
  if [[ -z "$CANDIDATE" ]]; then
    CANDIDATE=$(cat "$OUT_FILE")
  fi
  if echo "$CANDIDATE" | python3 -c 'import sys, json; json.loads(sys.stdin.read())' 2>/dev/null; then
    JSON_VALID=true
    echo "$CANDIDATE" > "${OUT_FILE}.json"
  else
    JSON_VALID=false
    EXIT_CODE=4
    echo "JSON validation failed — raw output kept in $OUT_FILE" >> "$ERR_FILE"
  fi
fi

# ─── Write metadata ─────────────────────────────────────────────────────
cat > "$META_FILE" <<META_EOF
{
  "session_id": "$SESSION_ID",
  "tmux_session": "$TMUX_SESSION",
  "provider": "gemini-cli",
  "exit_code": $EXIT_CODE,
  "duration_seconds": $DURATION,
  "model": "$MODEL",
  "invocation": "$INVOCATION_DESC",
  "format": "${FORMAT:-text}",
  "json_valid": ${JSON_VALID:-null},
  "output_bytes": $(wc -c < "$OUT_FILE"),
  "error_bytes": $(wc -c < "$ERR_FILE"),
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
META_EOF

# Clean up composed input if we created it
if [[ -n "$SYSTEM_PROMPT_FILE" && "$COMPOSED_INPUT" != "$TASK_FILE" ]]; then
  rm -f "$COMPOSED_INPUT"
fi

exit "$EXIT_CODE"
