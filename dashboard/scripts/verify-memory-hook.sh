#!/usr/bin/env bash
# Phase 8 verification — end-to-end memory-consult hook smoke test.
#
# Exercises the full PostToolUse hook chain shipped in plan 08-02:
#   1. Build a throwaway project with AGENTS.md + .cae/metrics/ opt-in dir.
#   2. Write a short task file whose prompt explicitly asks claude to Read
#      AGENTS.md in the cwd.
#   3. Invoke /home/cae/ctrl-alt-elite/adapters/claude-code.sh with that task.
#      The adapter exports CAE_TASK_ID=<basename task>.txt and spawns claude
#      inside tmux. Claude Code fires the PostToolUse hook at
#      /home/cae/ctrl-alt-elite/tools/memory-consult-hook.sh after every Read.
#      The hook appends one JSON line to <cwd>/.cae/metrics/memory-consult.jsonl
#      when the read path matches a memory source (AGENTS.md qualifies per D-10).
#   4. Assert the jsonl exists, has >=1 line, carries the expected task_id,
#      and references AGENTS.md.
#
# Exit codes:
#   0  PASS
#   0  SKIP (claude or tmux unavailable — still exits 0 so CI doesn't fail
#           in minimal environments; prints a SKIP banner that the
#           verification doc captures)
#   1  FAIL (hook chain didn't fire or produced the wrong row)
#
# Usage:
#   bash dashboard/scripts/verify-memory-hook.sh [--timeout-seconds N]
#
# NOTE ON EXIT CODE CONVENTION:
#   The plan's original skeleton proposed exit 0 on SKIP so the Phase-8
#   verification doc can record "SKIP — justification" without a failing
#   build. A separate marker file under /tmp/ makes it easy for the caller
#   to distinguish PASS vs SKIP when needed.

set -uo pipefail

ADAPTER="/home/cae/ctrl-alt-elite/adapters/claude-code.sh"
HOOK_SCRIPT="/home/cae/ctrl-alt-elite/tools/memory-consult-hook.sh"
SETTINGS_JSON="/home/cae/ctrl-alt-elite/.claude/settings.json"

# ─── Pre-flight ─────────────────────────────────────────────────────────
if [[ ! -x "$ADAPTER" ]]; then
  echo "FAIL: adapter not executable at $ADAPTER"
  exit 1
fi

if [[ ! -x "$HOOK_SCRIPT" ]]; then
  echo "FAIL: hook script missing or not executable at $HOOK_SCRIPT"
  exit 1
fi

if [[ ! -f "$SETTINGS_JSON" ]]; then
  echo "FAIL: claude settings.json not found at $SETTINGS_JSON"
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "SKIP: claude CLI not on PATH — end-to-end hook test can't run in this environment."
  echo "      Re-run this script on a machine with Claude Code installed."
  touch /tmp/verify-memory-hook.SKIP 2>/dev/null || true
  exit 0
fi

if ! command -v tmux >/dev/null 2>&1; then
  echo "SKIP: tmux not installed — adapter spawns claude inside tmux."
  touch /tmp/verify-memory-hook.SKIP 2>/dev/null || true
  exit 0
fi

# Confirm the hook is actually registered in settings.json. A well-formed
# claude run wouldn't fail without it, but the hook is load-bearing for
# this smoke so bail early with a useful message.
if ! grep -q 'memory-consult-hook.sh' "$SETTINGS_JSON"; then
  echo "FAIL: $SETTINGS_JSON does not register memory-consult-hook.sh"
  echo "      Hook chain can't fire without the PostToolUse registration."
  exit 1
fi

# ─── Build isolated test project ────────────────────────────────────────
WORK=$(mktemp -d -t phase8-verify-XXXXXX)
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/.cae/metrics"

# Project-scope settings.json inside the test WORK dir so Claude Code
# loads the PostToolUse Read hook when it resolves settings under $WORK
# (its cwd during adapter invocation). Without this, claude only sees
# user-scope /root/.claude/settings.json which doesn't register the hook,
# and the hook chain silently no-ops.
mkdir -p "$WORK/.claude"
# Minimal hook-only settings. permissions.defaultMode is deliberately
# omitted: "bypassPermissions" at this scope would try to add
# --dangerously-skip-permissions which is refused when claude runs as
# root. The Read tool doesn't need a permission gate, so the default
# "default" mode is fine for this smoke.
cat > "$WORK/.claude/settings.json" <<EOF
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          { "type": "command", "command": "$HOOK_SCRIPT" }
        ]
      }
    ]
  }
}
EOF

cat > "$WORK/AGENTS.md" <<'EOF'
# AGENTS.md (phase-8-verify fixture)

## Patterns
- Pattern A: be explicit in all task descriptions.
- Pattern B: avoid implicit state in long-running agents.

## Verify marker
SMOKE_VERIFY_MARKER_9f2c4a7b
EOF

# Task id will derive from basename without extension: "p8-verify"
TASK_BASENAME="p8-verify"
TASK_FILE="$WORK/${TASK_BASENAME}.txt"

# The adapter requires --agent OR --system-prompt-file.
# - TASK_FILE goes in as STDIN (claude's user message).
# - SYSTEM_PROMPT is a separate terse file; if we put the full instruction
#   in the system prompt, claude sees AGENTS.md content inline and answers
#   without ever invoking the Read tool — which means the PostToolUse hook
#   never fires.
# The user prompt must explicitly require reading a file by path, and the
# file's content MUST include a unique marker that's demonstrably NOT in
# the system prompt, so the model has to open the file to respond accurately.
cat > "$TASK_FILE" <<'EOF'
In the current working directory there is a file named exactly `AGENTS.md`.
You MUST use the Read tool to open `AGENTS.md` at its absolute path under
the current working directory. After reading the file, report the exact
"Verify marker" token from the ## Verify marker section of that file and
stop. Do not guess. Do not skip the Read tool call. Do not use any other
tool besides Read.
EOF

# Minimal system prompt — deliberately generic so the Read tool call is
# the only way the model can produce the expected answer.
SYSTEM_PROMPT_FILE="$WORK/system.md"
cat > "$SYSTEM_PROMPT_FILE" <<'EOF'
You are a file-inspection assistant. You ALWAYS use the Read tool on the
file path the user names. You never guess file contents. You never respond
before Read completes.
EOF

echo "> verify-memory-hook: work dir = $WORK"
echo "> verify-memory-hook: invoking adapter..."

SESSION_ID="verify-$(date +%s)-$$"

# Must run adapter from $WORK so the hook's $PWD check sees the project dir
# and the memory-consult.jsonl lands in $WORK/.cae/metrics/.
pushd "$WORK" >/dev/null
set +e
"$ADAPTER" \
  "$TASK_FILE" \
  "claude-sonnet-4-6" \
  "$SESSION_ID" \
  --system-prompt-file "$SYSTEM_PROMPT_FILE" \
  --timeout 120
RC=$?
set -e
popd >/dev/null

echo "> adapter exit code: $RC"

if [[ $RC -ne 0 ]]; then
  echo "FAIL: adapter returned $RC"
  echo "--- adapter output ---"
  [[ -f "${TASK_FILE}.output" ]] && head -40 "${TASK_FILE}.output"
  echo "--- adapter stderr ---"
  [[ -f "${TASK_FILE}.error" ]] && head -40 "${TASK_FILE}.error"
  exit 1
fi

# ─── Assertions on the jsonl ────────────────────────────────────────────
JSONL="$WORK/.cae/metrics/memory-consult.jsonl"

if [[ ! -f "$JSONL" ]]; then
  echo "FAIL: $JSONL was not created — hook did not run, or path mismatch."
  echo "  Possible causes:"
  echo "    - settings.json hook registration broken"
  echo "    - hook script not executable or exited before append"
  echo "    - CAE_TASK_ID not exported from adapter into claude subprocess"
  echo "    - claude did not actually Read AGENTS.md (model may have declined)"
  echo "  adapter output (first 40 lines):"
  [[ -f "${TASK_FILE}.output" ]] && head -40 "${TASK_FILE}.output"
  exit 1
fi

LINES=$(wc -l < "$JSONL" | tr -d ' ')
if [[ "$LINES" -lt 1 ]]; then
  echo "FAIL: $JSONL exists but is empty."
  exit 1
fi

if ! grep -q "\"task_id\": \"$TASK_BASENAME\"" "$JSONL"; then
  echo "FAIL: no row has task_id=\"$TASK_BASENAME\" — CAE_TASK_ID export may be broken."
  echo "--- captured ---"
  cat "$JSONL"
  exit 1
fi

if ! grep -q '"event": "memory_consult"' "$JSONL"; then
  echo "FAIL: no memory_consult events in $JSONL"
  echo "--- captured ---"
  cat "$JSONL"
  exit 1
fi

if ! grep -q "AGENTS.md" "$JSONL"; then
  echo "FAIL: no AGENTS.md reference in $JSONL — allowlist mismatch?"
  echo "--- captured ---"
  cat "$JSONL"
  exit 1
fi

echo "PASS: $LINES line(s) captured, task_id=$TASK_BASENAME, AGENTS.md hit."
echo "--- sample row ---"
head -1 "$JSONL"
exit 0
