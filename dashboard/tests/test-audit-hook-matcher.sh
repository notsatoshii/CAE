#!/usr/bin/env bash
# test-audit-hook-matcher.sh — Verify audit-hook.sh filters non-mutation tools.
# Tests that Read does NOT write to tool-calls.jsonl but Bash DOES.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$(cd "$SCRIPT_DIR/../tools" && pwd)"
FAKE=$(mktemp -d)

# Test 1: Read tool should NOT be logged
CAE_TASK_ID=t1 CLAUDE_TOOL_NAME=Read CAE_ROOT="$FAKE" bash "$TOOLS_DIR/audit-hook.sh"
if [[ -f "$FAKE/.cae/metrics/tool-calls.jsonl" ]]; then
  echo "FAIL: Read should not be logged but tool-calls.jsonl was created"
  rm -rf "$FAKE"
  exit 1
fi

# Test 2: Bash tool SHOULD be logged
CAE_TASK_ID=t1 CLAUDE_TOOL_NAME=Bash CAE_ROOT="$FAKE" bash "$TOOLS_DIR/audit-hook.sh"
if [[ ! -f "$FAKE/.cae/metrics/tool-calls.jsonl" ]]; then
  echo "FAIL: Bash should be logged but tool-calls.jsonl was NOT created"
  rm -rf "$FAKE"
  exit 1
fi

# Test 3: Write tool SHOULD be logged
CAE_TASK_ID=t1 CLAUDE_TOOL_NAME=Write CAE_ROOT="$FAKE" bash "$TOOLS_DIR/audit-hook.sh"

# Test 4: Edit tool SHOULD be logged
CAE_TASK_ID=t1 CLAUDE_TOOL_NAME=Edit CAE_ROOT="$FAKE" bash "$TOOLS_DIR/audit-hook.sh"

LINE_COUNT=$(wc -l < "$FAKE/.cae/metrics/tool-calls.jsonl")
if [[ "$LINE_COUNT" -ne 3 ]]; then
  echo "FAIL: Expected 3 entries (Bash + Write + Edit) but got $LINE_COUNT"
  cat "$FAKE/.cae/metrics/tool-calls.jsonl"
  rm -rf "$FAKE"
  exit 1
fi

# Validate JSON structure of first entry
FIRST=$(head -1 "$FAKE/.cae/metrics/tool-calls.jsonl")
if ! echo "$FIRST" | jq -e '.ts and .task and .tool and .cwd' >/dev/null 2>&1; then
  echo "FAIL: Entry missing required fields: $FIRST"
  rm -rf "$FAKE"
  exit 1
fi

rm -rf "$FAKE"
echo "matcher filter OK"
