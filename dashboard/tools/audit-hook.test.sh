#!/usr/bin/env bash
# audit-hook.test.sh — bash-level integration test for tools/audit-hook.sh
#
# Runs the hook against a temp directory and verifies the JSONL output contains
# expected task and tool fields.
#
# Exit 0 = PASS, Exit 1 = FAIL

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$SCRIPT_DIR/audit-hook.sh"

FAKE=$(mktemp -d)
trap 'rm -rf "$FAKE"' EXIT

# Run the hook with known env vars
CAE_TASK_ID=t1 CLAUDE_TOOL_NAME=Bash CAE_ROOT="$FAKE" bash "$HOOK"

JSONL="$FAKE/.cae/metrics/tool-calls.jsonl"

if [[ ! -f "$JSONL" ]]; then
  echo "FAIL: tool-calls.jsonl was not created at $JSONL"
  exit 1
fi

LINE=$(cat "$JSONL")

echo "$LINE" | grep -q '"task":"t1"' || { echo "FAIL: no task=t1 in: $LINE"; exit 1; }
echo "$LINE" | grep -q '"tool":"Bash"' || { echo "FAIL: no tool=Bash in: $LINE"; exit 1; }
echo "$LINE" | grep -q '"ts":"' || { echo "FAIL: no ts field in: $LINE"; exit 1; }
echo "$LINE" | grep -q '"cwd":"' || { echo "FAIL: no cwd field in: $LINE"; exit 1; }

echo "audit-hook.sh OK"
