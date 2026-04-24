#!/usr/bin/env bash
# install-scheduler-cron.sh — Idempotent user-crontab installer for CAE scheduler
# watcher AND the F3 (Wave 1.5) synthetic-heartbeat emitter.
#
# Adds a marked crontab block with three lines so re-running is safe. The
# previous version bailed whenever the marker was present, which let partial
# blocks linger forever — if the watcher line was installed but the two
# heartbeat lines weren't, re-running the installer silently noop'd and the
# Floor canvas stayed dead (Class 8 pixel-agents root cause, 2026-04-24).
#
# The guard is now per-line: if all three expected lines are present we
# skip; otherwise we strip any existing managed block and rebuild from
# scratch. Safe to re-run at any time.
#
# Usage: bash scripts/install-scheduler-cron.sh
# Remove: crontab -e → delete every line in the marker block manually
#
# Log output:
#   /tmp/cae-scheduler.log    — scheduler watcher stdout/stderr
#   /tmp/cae-heartbeat.log    — heartbeat emitter stdout/stderr
# Structured events:
#   $CAE_ROOT/.cae/metrics/scheduler.jsonl  — scheduler dispatch events
#   $CAE_ROOT/.cae/metrics/heartbeat.jsonl  — synthetic heartbeat events
#   $CAE_ROOT/.cae/metrics/circuit-breakers.jsonl — heartbeat is also appended
#                                                   here so Floor SSE picks it up

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WATCHER="$SCRIPT_DIR/cae-scheduler-watcher.sh"
HEARTBEAT="$SCRIPT_DIR/heartbeat-emitter.sh"
MARKER="# CAE_SCHEDULER_WATCHER (managed by CAE dashboard Phase 14)"

if [[ ! -f "$WATCHER" ]]; then
  echo "ERROR: watcher script not found at $WATCHER"
  exit 1
fi
if [[ ! -f "$HEARTBEAT" ]]; then
  echo "ERROR: heartbeat emitter not found at $HEARTBEAT"
  exit 1
fi

# Ensure both scripts are executable (defensive — git can drop perms on some OSes).
chmod +x "$WATCHER" "$HEARTBEAT" 2>/dev/null || true

# Cron is minute-grained. To get a 30-second heartbeat we register two emitter
# lines: one fires at HH:MM:00, the second sleeps 30s then fires — cron's
# subshell handles it non-blockingly so the next tick isn't delayed.
WATCHER_LINE="* * * * * \"$WATCHER\" >> /tmp/cae-scheduler.log 2>&1"
HEARTBEAT_LINE_A="* * * * * \"$HEARTBEAT\" >> /tmp/cae-heartbeat.log 2>&1"
HEARTBEAT_LINE_B="* * * * * sleep 30 && \"$HEARTBEAT\" >> /tmp/cae-heartbeat.log 2>&1"

# Per-line idempotency: verify all three expected lines are present; if any
# are missing we rebuild the managed block from scratch. This is the fix
# for the Class 8 pixel-agents bug.
CURRENT_CRON="$(crontab -l 2>/dev/null || true)"
all_present=true
for needle in "$WATCHER_LINE" "$HEARTBEAT_LINE_A" "$HEARTBEAT_LINE_B"; do
  if ! printf '%s\n' "$CURRENT_CRON" | grep -qF -- "$needle"; then
    all_present=false
    break
  fi
done

if [[ "$all_present" == "true" ]]; then
  echo "scheduler watcher + heartbeat emitter already fully installed — skipping (idempotent)"
  exit 0
fi

# Strip any existing managed block (marker line + following non-blank lines
# until the next blank line or EOF). awk keeps cross-platform semantics.
CLEANED_CRON="$(printf '%s\n' "$CURRENT_CRON" | awk -v marker="$MARKER" '
  BEGIN { in_block = 0 }
  {
    if (index($0, marker) == 1) { in_block = 1; next }
    if (in_block) {
      if ($0 ~ /^[[:space:]]*$/) { in_block = 0; next }
      next
    }
    print
  }
')"

# Append marker + three lines to the cleaned crontab (preserves unrelated entries).
{
  printf '%s\n' "$CLEANED_CRON"
  echo ""
  echo "$MARKER"
  echo "$WATCHER_LINE"
  echo "$HEARTBEAT_LINE_A"
  echo "$HEARTBEAT_LINE_B"
} | crontab -

echo "scheduler watcher + heartbeat emitter installed:"
echo "  $WATCHER_LINE"
echo "  $HEARTBEAT_LINE_A"
echo "  $HEARTBEAT_LINE_B"
echo ""
echo "To remove: crontab -e → delete lines starting with '$MARKER'"
echo "Log: /tmp/cae-scheduler.log + /tmp/cae-heartbeat.log"
echo "Events: \${CAE_ROOT:-/home/cae/ctrl-alt-elite}/.cae/metrics/{scheduler,heartbeat}.jsonl"
