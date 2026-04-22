#!/usr/bin/env bash
# install-scheduler-cron.sh — Idempotent user-crontab installer for CAE scheduler watcher.
#
# Adds a single crontab line with a marker comment so re-running is safe.
# Does NOT touch the crontab if the marker is already present.
#
# Usage: bash scripts/install-scheduler-cron.sh
# Remove: crontab -e → delete the marker + watcher line manually
#
# Log output: /tmp/cae-scheduler.log (cron stdout/stderr)
# Structured events: $CAE_ROOT/.cae/metrics/scheduler.jsonl

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WATCHER="$SCRIPT_DIR/cae-scheduler-watcher.sh"
MARKER="# CAE_SCHEDULER_WATCHER (managed by CAE dashboard Phase 14)"

if [[ ! -f "$WATCHER" ]]; then
  echo "ERROR: watcher script not found at $WATCHER"
  exit 1
fi

# Idempotency check: bail if marker already in crontab
if crontab -l 2>/dev/null | grep -qF "$MARKER"; then
  echo "scheduler watcher already in crontab — skipping (idempotent)"
  exit 0
fi

LINE="* * * * * \"$WATCHER\" >> /tmp/cae-scheduler.log 2>&1"

# Append marker + watcher line to current crontab (preserve existing entries)
(
  crontab -l 2>/dev/null || true
  echo ""
  echo "$MARKER"
  echo "$LINE"
) | crontab -

echo "scheduler watcher installed:"
echo "  $LINE"
echo ""
echo "To remove: crontab -e → delete lines starting with '$MARKER'"
echo "Log: /tmp/cae-scheduler.log"
echo "Events: \${CAE_ROOT:-/home/cae/ctrl-alt-elite}/.cae/metrics/scheduler.jsonl"
