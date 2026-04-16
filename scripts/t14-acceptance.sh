#!/usr/bin/env bash
# T14 — Phase 1 Acceptance Gate
#
# Runs CAE end-to-end on a realistic toy workload and verifies every
# component that can be exercised WITHOUT T1 (Gemini CLI).
#
# Sections:
#   PART A (runnable now)  — Claude-only paths, stubs for Gemini-dependent.
#   PART B (needs T1)      — Gemini Sentinel, Scribe Gemini, full cross-provider adversarial review.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAE_ROOT="$(dirname "$SCRIPT_DIR")"

PASS=0
FAIL=0
SKIP=0
FAILURES=()

check() {
  local name="$1"; local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "  ✓ $name"
    ((PASS++))
  else
    echo "  ✗ $name"
    FAILURES+=("$name: cmd=\"$cmd\"")
    ((FAIL++))
  fi
}

skip() {
  echo "  ⊘ $1 (needs T1)"
  ((SKIP++))
}

TESTDIR="/tmp/cae-t14-$(date +%s)"
echo ""
echo "━━ T14 Acceptance Test — $TESTDIR"
echo ""

rm -rf "$TESTDIR"
mkdir -p "$TESTDIR"
cd "$TESTDIR"

git init -q
git branch -m main 2>/dev/null || true
git config user.email t14@cae.test
git config user.name "T14 Runner"
git config --local --add safe.directory "$TESTDIR"
echo "# T14 acceptance project" > README.md
git add README.md
git commit -qm "init"

mkdir -p .planning/phases/01-calc
cat > .planning/config.json << 'EOF'
{"cae_config_version": 1}
EOF
cat > .planning/PROJECT.md << 'EOF'
# T14 Test: tiny arithmetic CLI
Build a Python script that adds two numbers from argv and prints the result.
EOF
cat > .planning/STATE.md << 'EOF'
---
current_phase: 1
---
EOF
cat > .planning/phases/01-calc/01-PLAN.md << 'EOF'
---
phase: 1
plan: 01
type: execute
wave: 1
---
<objective>Create calc.py: reads two integers from argv[1] and argv[2], prints their sum.</objective>
<tasks>
<task type="auto">
  <name>Write calc.py</name>
  <files>calc.py</files>
  <action>Create calc.py that reads argv[1] and argv[2] as ints and prints their sum.</action>
  <verify>python3 calc.py 2 3 outputs 5</verify>
</task>
</tasks>
EOF

echo "━━ PART A: Claude-only paths (runnable now)"
echo ""

echo "A1. Install + config"
bash "$CAE_ROOT/scripts/cae-init.sh" . >/tmp/t14-init.log 2>&1
check "cae-init runs cleanly" "grep -q 'Config written' /tmp/t14-init.log"
check "agent-skills in config.json" "grep -q cae-forge .planning/config.json"
check "model_overrides present" "grep -q claude-sonnet .planning/config.json"
check "AGENTS.md template created" "[ -f AGENTS.md ]"

echo ""
echo "A2. Orchestrator dry-run"
"$CAE_ROOT/bin/cae" execute-phase 1 --dry-run >/tmp/t14-dryrun.log 2>&1
check "dry-run succeeds" "grep -q 'Total: 1 tasks' /tmp/t14-dryrun.log"
check "dry-run shows Forge routing" "grep -q 'role=forge' /tmp/t14-dryrun.log || grep -q 'claude-sonnet' /tmp/t14-dryrun.log"

echo ""
echo "A3. Real execution — Forge path + Sentinel stub + merge"
"$CAE_ROOT/bin/cae" execute-phase 1 >/tmp/t14-run.log 2>&1
RUN_EXIT=$?
check "execute-phase exits 0" "[ $RUN_EXIT -eq 0 ]"
check "calc.py created" "[ -f calc.py ]"
check "calc.py works (2+3=5)" "[ \"\$(python3 calc.py 2 3 2>/dev/null)\" = '5' ]"
check "task ran on forge branch (merge commit)" "git log --oneline | grep -q 'Merge forge/'"
check "forge branch cleaned up" "[ -z \"\$(git branch --list 'forge/*')\" ]"

echo ""
echo "A4. Metrics logs"
check ".cae/metrics/ created" "[ -d .cae/metrics ]"
check "circuit-breakers.jsonl populated" "[ -s .cae/metrics/circuit-breakers.jsonl ]"
check "compaction.jsonl populated" "[ -s .cae/metrics/compaction.jsonl ]"
check "compactor fired at least layer a" "grep -q 'a_tool_budgets' .cae/metrics/compaction.jsonl"
check "sentinel logged verdict" "[ -s .cae/metrics/sentinel.jsonl ] && grep -q 'verdict_ok' .cae/metrics/sentinel.jsonl"

echo ""
echo "A5. Git branch guard"
check "branch-guard hook installed" "[ -x .git/hooks/pre-push ] && grep -q cae-branch-guard .git/hooks/pre-push"
echo "  (full push-block test requires a remote; covered by T9 unit test)"

echo ""
echo "A6. Telegram gate — pattern matching (stub mode)"
python3 <<PYEOF >/tmp/t14-gate.log 2>&1
import sys
sys.path.insert(0, "$CAE_ROOT/bin")
from telegram_gate import TelegramGate
gate = TelegramGate("$TESTDIR")
fired = []
for cmd, name in [
    ("forge script X --broadcast", "broadcast_transaction"),
    ("git push origin main", "git_push_main"),
    ("rm -rf /tmp/x", "delete_files_recursive"),
]:
    p = gate.match(cmd)
    if p and p.name == name:
        fired.append(name)
print("FIRED:", fired)
for cmd in ["git status", "ls -la", "python3 --version"]:
    p = gate.match(cmd)
    if p:
        print(f"FALSE POSITIVE: {cmd}")
        sys.exit(1)
PYEOF
check "3 dangerous patterns match" "grep -q broadcast_transaction /tmp/t14-gate.log && grep -q git_push_main /tmp/t14-gate.log && grep -q delete_files_recursive /tmp/t14-gate.log"
check "no false positives on benign commands" "! grep -q 'FALSE POSITIVE' /tmp/t14-gate.log"

echo ""
echo "A7. Scribe logic (dry — no Gemini call)"
python3 <<PYEOF >/tmp/t14-scribe.log 2>&1
import sys
sys.path.insert(0, "$CAE_ROOT/bin")
from scribe import Scribe
from pathlib import Path
s = Scribe("$TESTDIR")
Path("$TESTDIR/AGENTS.md").write_text("# AGENTS.md — Team Knowledge Base\n\n## Project Conventions\n## Patterns That Work\n## Gotchas\n## Library/API Notes\n")
result = {
    "agents_md_additions": [{"section": "Gotchas", "entry": "test gotcha", "attribution": "T14"}],
    "knowledge_topic_updates": [{"topic": "t14-sample", "content": "sample content", "tags": ["t14"]}],
    "stale_entries_to_remove": [],
}
applied = s._apply(result)
print("APPLIED:", applied)
assert applied["agents_md_added"] == 1
assert applied["knowledge_topics_updated"] == 1
PYEOF
check "scribe merge logic OK" "grep -q \"'agents_md_added': 1\" /tmp/t14-scribe.log"
check "scribe wrote AGENTS.md entry" "grep -q 'test gotcha' AGENTS.md"
check "scribe wrote KNOWLEDGE topic" "[ -f KNOWLEDGE/t14-sample.md ]"

echo ""
echo "A8. Phantom integration (structure — no live escalation)"
python3 <<PYEOF >/tmp/t14-phantom.log 2>&1
import sys
sys.path.insert(0, "$CAE_ROOT/bin")
from phantom import Phantom
ph = Phantom("$TESTDIR")
sample = "preamble chatter\n\n## ROOT CAUSE FOUND\n\n**Root cause:** the thing was wrong\n\nFix: change X to Y"
r = ph._parse_output(sample)
print("KIND:", r.kind)
print("ROOT:", r.root_cause[:40] if r.root_cause else None)
assert r.kind == "fix"
PYEOF
check "Phantom parses ROOT CAUSE FOUND → fix" "grep -q 'KIND: fix' /tmp/t14-phantom.log"

echo ""
echo "━━ PART B: Gemini-dependent paths (skip unless T1 done)"
echo ""
if command -v gemini >/dev/null 2>&1; then
  echo "B. T1 is complete — would run Gemini paths here (TODO: populate)"
else
  skip "B1 — Sentinel (Gemini 2.5 Pro) cross-provider review"
  skip "B2 — Scribe (Gemini Flash) automated AGENTS.md update after phase"
  skip "B3 — Compactor layers (b) file summaries and (e) hard summarize via Haiku"
  skip "B4 — Full end-to-end cross-provider adversarial diversity verified"
fi

echo ""
echo "━━ Summary"
echo "  Passed:  $PASS"
echo "  Failed:  $FAIL"
echo "  Skipped: $SKIP (needs T1)"
echo ""
if [ ${#FAILURES[@]} -gt 0 ]; then
  echo "Failures:"
  for f in "${FAILURES[@]}"; do
    echo "  - $f"
  done
  exit 1
fi

if [ $FAIL -eq 0 ]; then
  echo "✓ PART A passes. Claude-only pipeline verified end-to-end."
  if [ $SKIP -gt 0 ]; then
    echo "  PART B skipped: $SKIP check(s) need T1 (Gemini OAuth) to complete."
    echo "  Phase 1 acceptance is PARTIAL until T1 runs."
  fi
  exit 0
fi
exit 1
