#!/usr/bin/env bash
# install-scheduler-cron.sh — Idempotent user-crontab installer for CAE scheduler
# watcher AND the F3 (Wave 1.5) synthetic-heartbeat emitter.
#
# Adds a marked crontab block with three lines so re-running is safe. Does NOT
# touch the crontab if the marker is already present.
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

# Idempotency check: bail if marker already in crontab.
if crontab -l 2>/dev/null | grep -qF "$MARKER"; then
  echo "scheduler watcher already in crontab — skipping (idempotent)"
  echo "  (re-installing? remove the existing block first via 'crontab -e')"
  exit 0
fi

# Cron is minute-grained. To get a 30-second heartbeat we register two emitter
# lines: one fires at HH:MM:00, the second sleeps 30s then fires — cron's
# subshell handles it non-blockingly so the next tick isn't delayed.
WATCHER_LINE="* * * * * \"$WATCHER\" >> /tmp/cae-scheduler.log 2>&1"
HEARTBEAT_LINE_A="* * * * * \"$HEARTBEAT\" >> /tmp/cae-heartbeat.log 2>&1"
HEARTBEAT_LINE_B="* * * * * sleep 30 && \"$HEARTBEAT\" >> /tmp/cae-heartbeat.log 2>&1"

# Append marker + lines to current crontab (preserve existing entries).
(
  crontab -l 2>/dev/null || true
  echo ""
  echo "$MARKER"
  echo "$WATCHER_LINE"
  echo "$HEARTBEAT_LINE_A"
  echo "$HEARTBEAT_LINE_B"
) | crontab -

echo "scheduler watcher + heartbeat emitter installed:"
echo "  $WATCHER_LINE"
echo "  $HEARTBEAT_LINE_A"
echo "  $HEARTBEAT_LINE_B"
echo ""
echo "To remove: crontab -e → delete lines starting with '$MARKER'"
echo "Log: /tmp/cae-scheduler.log + /tmp/cae-heartbeat.log"
echo "Events: \${CAE_ROOT:-/home/cae/ctrl-alt-elite}/.cae/metrics/{scheduler,heartbeat}.jsonl"
