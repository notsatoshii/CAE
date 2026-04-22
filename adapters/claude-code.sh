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
#
# Side-effect files (written when invoker's cwd is a CAE project i.e.
# `<cwd>/.cae/metrics/` already exists):
#   <cwd>/.cae/metrics/circuit-breakers.jsonl   (Phase 7 Wave 0)
#     Appended with a `token_usage` event per successful run, when claude
#     was invoked with `--output-format json` (added automatically unless the
#     caller already specified a format) and the usage envelope parses.
#     Logging failure is swallowed — never breaks the caller.
#   <cwd>/.cae/metrics/memory-consult.jsonl     (Phase 8 Wave 1, D-03)
#     Appended with one `memory_consult` event per `Read` tool call into a
#     CAE memory source, by the Claude Code PostToolUse hook at
#     /home/cae/ctrl-alt-elite/tools/memory-consult-hook.sh. The adapter
#     exports CAE_TASK_ID before tmux spawn so hook rows group by task.

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
# Phase 7 Wave 0 (D-01): Adapter auto-adds `--output-format json` so that
# claude's usage envelope (input_tokens/output_tokens) lands in OUT_FILE and
# we can append a `token_usage` event to .cae/metrics/circuit-breakers.jsonl.
# If a caller ever needs to override the format they can add a `--output-format`
# flag; today no caller passes one so we don't plumb it through the while-loop.
CALLER_SET_OUTPUT_FORMAT=0

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

# Phase 8 Wave 1 (D-03): compute+set CAE_TASK_ID in the env so the Claude Code
# PostToolUse hook at /home/cae/ctrl-alt-elite/tools/memory-consult-hook.sh
# (registered in /home/cae/ctrl-alt-elite/.claude/settings.json) can group
# Read-tool events by task. Same TASK_ID computation as the post-run
# token_usage block further down; lifted early so the env is set BEFORE the
# tmux subprocess — and therefore the spawned claude + the hook — inherit
# it. The late TASK_ID assignment in the token_usage block now reuses this
# same value so both emit paths (token_usage writes + hook-captured
# memory_consult rows) share a single identifier for Wave-5 Why-drawer
# correlation.
CAE_TASK_ID=$(basename "$TASK_FILE" | sed -E 's/\.(txt|md)$//')
export CAE_TASK_ID

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
# Phase 7 Wave 0 (D-01): request JSON envelope so usage tokens are parseable.
# `--output-format json` makes claude emit a single JSON document on stdout
# containing .usage.input_tokens and .usage.output_tokens at exit.
if [[ $CALLER_SET_OUTPUT_FORMAT -eq 0 ]]; then
  CLAUDE_ARGS+=(--output-format json)
fi
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

# Phase 8 Wave 6 (08-08 verification): when a pre-existing tmux server is
# already running, `tmux new-session` hands the request to that server,
# which spawns the pane from its own captive environment — NOT the
# caller's. The `export CAE_TASK_ID` above therefore does not propagate
# into the claude subprocess, and the memory-consult-hook sees task_id
# as "unknown" instead of the real basename. Explicitly injecting the
# var with `-e K=V` survives the server boundary regardless of whether
# tmux reused a running server or started a fresh one.
tmux new-session -d -e "CAE_TASK_ID=$CAE_TASK_ID" -s "$TMUX_SESSION" "$INNER_CMD"

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

# ─── Phase 7 Wave 0: emit token_usage event to circuit-breakers.jsonl ───
# (D-01) Extract input_tokens/output_tokens from the claude --output-format
# json envelope sitting in OUT_FILE and append a line to the invoker's
# `.cae/metrics/circuit-breakers.jsonl`. Silent no-op when:
#   - run was not successful (EXIT_CODE != 0)
#   - invoker's cwd has no `.cae/metrics/` dir (not a CAE project)
#   - neither input_tokens nor output_tokens could be parsed
# ALL errors in this block are swallowed (|| true / 2>/dev/null) so a broken
# metrics path can never crash the adapter. Do NOT create the metrics dir —
# its presence is the signal for "this project opted in".
if [[ "$EXIT_CODE" -eq 0 && -s "$OUT_FILE" ]]; then
  CB_JSONL="$CWD/.cae/metrics/circuit-breakers.jsonl"
  CB_DIR="$(dirname "$CB_JSONL")"
  if [[ -d "$CB_DIR" ]]; then
    # Extract input_tokens / output_tokens. Prefer jq if available.
    INPUT_TOKENS=0
    OUTPUT_TOKENS=0
    if command -v jq >/dev/null 2>&1; then
      # `// 0` coerces null/missing to 0; `-r` avoids JSON-quoting the number.
      INPUT_TOKENS=$(jq -r '.usage.input_tokens // 0' "$OUT_FILE" 2>/dev/null || echo 0)
      OUTPUT_TOKENS=$(jq -r '.usage.output_tokens // 0' "$OUT_FILE" 2>/dev/null || echo 0)
    fi
    # Fallback (or recover from a non-numeric jq result) via regex on the raw file.
    if ! [[ "$INPUT_TOKENS" =~ ^[0-9]+$ ]]; then
      INPUT_TOKENS=$(grep -oE '"input_tokens"[[:space:]]*:[[:space:]]*[0-9]+' "$OUT_FILE" 2>/dev/null \
        | head -1 | grep -oE '[0-9]+' || echo 0)
      [[ -z "$INPUT_TOKENS" ]] && INPUT_TOKENS=0
    fi
    if ! [[ "$OUTPUT_TOKENS" =~ ^[0-9]+$ ]]; then
      OUTPUT_TOKENS=$(grep -oE '"output_tokens"[[:space:]]*:[[:space:]]*[0-9]+' "$OUT_FILE" 2>/dev/null \
        | head -1 | grep -oE '[0-9]+' || echo 0)
      [[ -z "$OUTPUT_TOKENS" ]] && OUTPUT_TOKENS=0
    fi

    # Only write if at least one count is > 0 (otherwise the event would be noise).
    if [[ "$INPUT_TOKENS" -gt 0 || "$OUTPUT_TOKENS" -gt 0 ]]; then
      # Phase 8 Wave 1 (D-03): reuse the CAE_TASK_ID exported earlier for the
      # memory-consult hook so token_usage rows + memory_consult rows share
      # a single identifier. Keeps wave-5 Why-drawer correlation tight.
      TASK_ID="$CAE_TASK_ID"

      # agent label mirrors INVOCATION_DESC: wrap:X → X; direct:* → "direct"; fallback forge.
      if [[ "$INVOCATION_DESC" == wrap:* ]]; then
        AGENT_FOR_LOG="${INVOCATION_DESC#wrap:}"
      elif [[ "$INVOCATION_DESC" == direct:* ]]; then
        AGENT_FOR_LOG="direct"
      else
        AGENT_FOR_LOG="forge"
      fi

      TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
      # Field order matches bin/circuit_breakers.py _log(): ts, event, then alphabetical.
      printf '{"ts": "%s", "event": "token_usage", "agent": "%s", "input_tokens": %d, "model": "%s", "output_tokens": %d, "task_id": "%s"}\n' \
        "$TS" "$AGENT_FOR_LOG" "$INPUT_TOKENS" "$MODEL" "$OUTPUT_TOKENS" "$TASK_ID" \
        >> "$CB_JSONL" 2>/dev/null || true
    fi
  fi
fi

exit "$EXIT_CODE"
