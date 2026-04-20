#!/usr/bin/env bash
# Integration test for Timmy bridge (Phase 3).
#
# Verifies the file-mediated contract end-to-end:
#   1. Writing a buildplan to /home/cae/inbox/<id>/ works
#   2. `cae execute-buildplan --dry-run` reads it correctly
#   3. A fixture DONE.md in /home/cae/outbox/<id>/ is picked up by watcher.sh
#   4. watcher.sh TEST_MODE=1 prints the notification and marks .processed
#
# Does NOT spawn real Forge (that would cost LLM tokens and take minutes).
# To test actual Forge execution: drop a real buildplan, run `cae execute-buildplan`
# manually, observe DONE.md written by CAE.
#
# Usage: bash scripts/test-timmy-bridge.sh

set -u
set -o pipefail

PASS=0
FAIL=0
FAILED_TESTS=()

pass() { PASS=$((PASS+1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL+1)); FAILED_TESTS+=("$1"); echo "  FAIL: $1"; }

echo "━━ Timmy bridge integration test ━━"
echo

# ─── Test 1: inbox/outbox CONTRACT.md files exist ─────────────────────
echo "Test 1: inbox/outbox contract docs exist"
if [[ -f /home/cae/inbox/CONTRACT.md ]]; then
  pass "inbox/CONTRACT.md present"
else
  fail "inbox/CONTRACT.md missing"
fi
if [[ -f /home/cae/outbox/CONTRACT.md ]]; then
  pass "outbox/CONTRACT.md present"
else
  fail "outbox/CONTRACT.md missing"
fi
echo

# ─── Test 2: directories are group-writable by timmy ──────────────────
echo "Test 2: inbox/outbox writable by timmy group"
for d in /home/cae/inbox /home/cae/outbox; do
  if [[ "$(stat -c '%G' "$d")" == "timmy" ]] && [[ -w "$d" || "$(stat -c '%a' "$d")" -ge 775 ]]; then
    pass "$d group=timmy, mode permits group write"
  else
    fail "$d permissions wrong (group=$(stat -c '%G' "$d"), mode=$(stat -c '%a' "$d"))"
  fi
done
echo

# ─── Test 3: cae execute-buildplan --help works ───────────────────────
echo "Test 3: cae execute-buildplan usage"
usage_output="$(cae execute-buildplan 2>&1 || true)"
if echo "$usage_output" | grep -q "usage: cae execute-buildplan"; then
  pass "missing arg triggers usage message"
else
  fail "usage message missing; got: $usage_output"
fi
echo

# ─── Test 4: fixture inbox task → dry-run succeeds ────────────────────
echo "Test 4: dry-run on fixture inbox task"
TASK_ID="tb-test-$(date +%s)"
INBOX_DIR="/home/cae/inbox/$TASK_ID"
mkdir -p "$INBOX_DIR"
cat > "$INBOX_DIR/BUILDPLAN.md" << 'EOF'
# Test buildplan

## Objective
Verify Timmy bridge inbox contract.

## Requirements
1. This is a dry-run fixture — CAE should read and describe but not execute.
EOF
cat > "$INBOX_DIR/META.yaml" << 'EOF'
target_repo: /tmp/nonexistent-for-dry-run
branch_base: main
constraints:
  - "this is a test"
priority: normal
EOF

dry_output="$(cae execute-buildplan "$TASK_ID" --dry-run 2>&1 || true)"
if echo "$dry_output" | grep -q "DRY RUN"; then
  pass "dry-run parses buildplan + META.yaml"
else
  fail "dry-run failed; got: $dry_output"
fi
if echo "$dry_output" | grep -q "target_repo: /tmp/nonexistent-for-dry-run"; then
  pass "META.yaml target_repo honored"
else
  fail "META.yaml target_repo not picked up"
fi
echo

# ─── Test 5: fixture outbox DONE.md → watcher picks it up ─────────────
echo "Test 5: outbox watcher processes DONE.md"
OUTBOX_DIR="/home/cae/outbox/$TASK_ID"
mkdir -p "$OUTBOX_DIR"
cat > "$OUTBOX_DIR/DONE.md" << EOF
---
task_id: $TASK_ID
status: success
started_at: 2026-04-17T18:00:00Z
finished_at: 2026-04-17T18:05:00Z
repo: /home/cae/ctrl-alt-elite
branch: buildplan/$TASK_ID
commits:
  - abcdef1234567890
  - 1234567890abcdef
summary: Test completion sentinel for integration test
---

# Integration test DONE

Dummy completion report.
EOF

# Ensure .processed flag absent
rm -f "$OUTBOX_DIR/.processed"

watcher_output="$(TEST_MODE=1 bash /home/timmy/.hermes/skills/timmy-delegate/watcher.sh 2>&1 || true)"
if echo "$watcher_output" | grep -q "Would send Telegram"; then
  pass "watcher detected DONE.md and would send notification"
else
  fail "watcher did not detect DONE.md; got: $watcher_output"
fi

if echo "$watcher_output" | grep -q "$TASK_ID"; then
  pass "notification mentions task id"
else
  fail "notification missing task id"
fi

if echo "$watcher_output" | grep -q "success"; then
  pass "notification includes status"
else
  fail "notification missing status"
fi

if [[ -f "$OUTBOX_DIR/.processed" ]]; then
  pass ".processed flag created"
else
  fail ".processed flag not created after TEST_MODE send"
fi
echo

# ─── Test 6: re-run watcher → skips already-processed ─────────────────
echo "Test 6: watcher skips already-.processed tasks"
watcher_output2="$(TEST_MODE=1 bash /home/timmy/.hermes/skills/timmy-delegate/watcher.sh 2>&1 || true)"
if echo "$watcher_output2" | grep -q "Would send Telegram.*$TASK_ID"; then
  fail "watcher re-notified for already-processed task"
else
  pass "watcher correctly skipped .processed task"
fi
echo

# ─── Cleanup ──────────────────────────────────────────────────────────
# Keep the fixture task dirs for inspection; cleanup is manual.
echo "Test fixtures left at:"
echo "  $INBOX_DIR"
echo "  $OUTBOX_DIR"
echo "(delete manually when done)"
echo

# ─── Summary ──────────────────────────────────────────────────────────
echo "━━ Summary ━━"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  echo "  Failed tests:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  exit 1
fi
echo "  All checks green — Timmy bridge contract verified."
exit 0
