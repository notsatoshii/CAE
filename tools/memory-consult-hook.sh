#!/usr/bin/env bash
# Phase 8 Wave 1 (D-03): Claude Code PostToolUse hook for the `Read` tool.
#
# Invoked by Claude Code after every successful `Read` tool call (see
# /home/cae/ctrl-alt-elite/.claude/settings.json hooks.PostToolUse).
# Reads ONE JSON object from stdin (the tool-invocation envelope),
# extracts tool_input.file_path, and if the path matches a CAE memory
# source, appends one JSON line to $PWD/.cae/metrics/memory-consult.jsonl.
#
# SAFETY CONTRACT (never break):
#   1. ALWAYS exit 0. A broken hook must NEVER fail the agent.
#   2. Self-bounded runtime. Uses `timeout` around jq + an internal
#      wall-clock check at each major phase.
#   3. Only append when path passes the memory-source allowlist.
#   4. Never create .cae/metrics/ — its presence is the opt-in signal.
#   5. flock the JSONL during write to prevent torn lines under parallel Reads.
#
# ENV:
#   CAE_TASK_ID        set by adapters/claude-code.sh; primary task id.
#   CLAUDE_SESSION_ID  set by Claude Code; secondary fallback.
#   PWD                inherited; determines which project's jsonl we write to.
#
# Stdin payload (from Claude Code, Read tool):
#   {
#     "session_id": "...",
#     "tool_name":  "Read",
#     "tool_input": { "file_path": "/abs/path/to/file.md", ... },
#     "tool_response": { ... }
#   }

# Swallow every error — the `|| :` idiom keeps exit code 0 regardless.
set +e
set -u
set +o pipefail

# F4 (Wave 1.5): diagnostic echo — captures EVERY invocation regardless of
# opt-in gate so we can determine whether the harness fires the hook at all.
# Records PWD (which decides opt-in), tool-detection env vars, and whether the
# opt-in directory exists. Does NOT touch stdin so the real hook flow below is
# untouched. Review /tmp/memory-consult-hook-debug.log after the next session.
echo "$(date -u +%FT%TZ 2>/dev/null) hook_called pwd=$PWD claude_tool=${CLAUDE_TOOL_NAME:-MISSING} session=${CLAUDE_SESSION_ID:-MISSING} cae_task=${CAE_TASK_ID:-MISSING} opt_in_dir=$([[ -d "$PWD/.cae/metrics" ]] && echo yes || echo no)" >> /tmp/memory-consult-hook-debug.log 2>/dev/null || :

# Hard cap wall time for defense-in-depth. If we blow past 2 seconds, abort
# silently. The outer Claude Code invocation may also wrap us in `timeout`,
# but we don't rely on it.
START_EPOCH=$(date +%s 2>/dev/null || echo 0)

_expired() {
  local now
  now=$(date +%s 2>/dev/null || echo 0)
  [[ $((now - START_EPOCH)) -gt 2 ]]
}

# Fast exit if cwd isn't a CAE project (opt-in signal).
CB_DIR="$PWD/.cae/metrics"
if [[ ! -d "$CB_DIR" ]]; then
  exit 0
fi

# Read stdin. Cap at 64KB to avoid weirdly-large payloads stalling us.
STDIN_JSON=$(head -c 65536 2>/dev/null || :)
if [[ -z "$STDIN_JSON" ]]; then
  exit 0
fi

_expired && exit 0

# Extract tool_name + tool_input.file_path. Prefer jq; fall back to grep.
TOOL_NAME=""
FILE_PATH=""
if command -v jq >/dev/null 2>&1; then
  TOOL_NAME=$(printf '%s' "$STDIN_JSON" | timeout 1 jq -r '.tool_name // empty' 2>/dev/null || echo "")
  FILE_PATH=$(printf '%s' "$STDIN_JSON" | timeout 1 jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")
fi
# Fallback regex (only activates if jq unavailable or produced empty). Grabs
# the first "file_path":"..." occurrence; fine because PostToolUse JSON has
# at most one tool_input block.
if [[ -z "$FILE_PATH" ]]; then
  FILE_PATH=$(printf '%s' "$STDIN_JSON" \
    | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]+"' \
    | head -1 \
    | sed -E 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' \
    || echo "")
fi
if [[ -z "$TOOL_NAME" ]]; then
  TOOL_NAME=$(printf '%s' "$STDIN_JSON" \
    | grep -oE '"tool_name"[[:space:]]*:[[:space:]]*"[^"]+"' \
    | head -1 \
    | sed -E 's/.*"tool_name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' \
    || echo "")
fi

# Only act on Read. The matcher in settings.json already filters, but belt+suspenders.
if [[ "$TOOL_NAME" != "Read" ]]; then
  exit 0
fi
if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi
# Absolute path required. Claude Code always passes absolute for Read, but verify.
if [[ "$FILE_PATH" != /* ]]; then
  exit 0
fi

_expired && exit 0

# ─── Allowlist: is this a CAE memory source? ────────────────────────────
# Match the glob set from D-10. We use shell globbing via case patterns — no
# dependency on bash extglob beyond what's in Ubuntu's default bash.
is_memory_source() {
  local p="$1"
  # AGENTS.md at any project root
  case "$p" in */AGENTS.md) return 0 ;; esac
  # KNOWLEDGE/** *.md at any project
  case "$p" in */KNOWLEDGE/*.md | */KNOWLEDGE/*/*.md | */KNOWLEDGE/*/*/*.md) return 0 ;; esac
  # .claude/agents/*.md
  case "$p" in */.claude/agents/*.md) return 0 ;; esac
  # agents/cae-*.md
  case "$p" in */agents/cae-*.md) return 0 ;; esac
  # .planning/phases/*/*.md  (e.g. .planning/phases/08-foo/08-CONTEXT.md)
  case "$p" in */.planning/phases/*/*.md) return 0 ;; esac
  return 1
}

if ! is_memory_source "$FILE_PATH"; then
  exit 0
fi

_expired && exit 0

# ─── Derive task_id ────────────────────────────────────────────────────
TASK_ID="${CAE_TASK_ID:-}"
if [[ -z "$TASK_ID" ]]; then
  TASK_ID="${CLAUDE_SESSION_ID:-}"
fi
if [[ -z "$TASK_ID" ]]; then
  TASK_ID="unknown"
fi

# ─── Write one JSON line under flock ───────────────────────────────────
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "")
if [[ -z "$TS" ]]; then
  exit 0
fi

JSONL="$CB_DIR/memory-consult.jsonl"

# JSON-escape the file path and task_id (handle embedded quotes/backslashes
# defensively; paths containing these are rare but possible).
_escape() {
  # Escape backslash and double-quote for safe embedding in a JSON string.
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}
FP_ESC=$(_escape "$FILE_PATH")
TID_ESC=$(_escape "$TASK_ID")

# Build the payload WITHOUT a trailing newline — bash command substitution
# `x=$(printf '...\n')` strips trailing LFs. The LF is appended at WRITE
# time via `%s\n` so every JSONL record ends in exactly one LF and
# line-oriented tools (`wc -l`, `tailJsonl`) count every row correctly.
LINE=$(printf '{"ts": "%s", "event": "memory_consult", "source_path": "%s", "task_id": "%s"}' \
  "$TS" "$FP_ESC" "$TID_ESC")

if command -v flock >/dev/null 2>&1; then
  # flock the jsonl to serialize concurrent writes. The 200 file descriptor
  # is a conventional free FD; if it's taken upstream we fall through
  # silently (the `|| :` below keeps us at exit 0).
  ( flock 200; printf '%s\n' "$LINE" >> "$JSONL" ) 200>>"$JSONL" 2>/dev/null || :
else
  # Plain append. On Linux ext4, single-line writes ≤ PIPE_BUF are atomic
  # under O_APPEND — tolerable fallback.
  printf '%s\n' "$LINE" >> "$JSONL" 2>/dev/null || :
fi

exit 0
