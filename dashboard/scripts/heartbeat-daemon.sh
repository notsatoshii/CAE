#!/usr/bin/env bash
# heartbeat-daemon.sh — 5s interval heartbeat loop.
#
# Cron min resolution is 1 min. Two cron lines at :00 + sleep 30 + :30 gave
# 30s cadence (Eric: too slow, canvas looks static between ticks). This is
# the sub-minute replacement — long-running loop fires heartbeat-emitter.sh
# every HEARTBEAT_INTERVAL_SEC seconds (default 5).
#
# Lifecycle: install as systemd service OR run via nohup. Exits only on
# SIGTERM/SIGINT. One instance per box — guarded by a pidfile.
#
# Intentionally trivial — the emitter itself is crash-safe + idempotent;
# losing a tick here just means a 5s gap (next tick picks up).

set -uo pipefail

CAE_ROOT="${CAE_ROOT:-/home/cae/ctrl-alt-elite}"
INTERVAL="${HEARTBEAT_INTERVAL_SEC:-5}"
EMITTER="$CAE_ROOT/dashboard/scripts/heartbeat-emitter.sh"
PIDFILE="/tmp/cae-heartbeat-daemon.pid"
LOGFILE="/tmp/cae-heartbeat-daemon.log"

if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "heartbeat-daemon already running (pid $(cat "$PIDFILE"))"
  exit 0
fi
echo $$ > "$PIDFILE"
trap 'rm -f "$PIDFILE"; exit 0' TERM INT EXIT

echo "[$(date -u +%FT%TZ)] heartbeat-daemon start pid=$$ interval=${INTERVAL}s" >> "$LOGFILE"

while true; do
  "$EMITTER" >> "$LOGFILE" 2>&1 || true
  sleep "$INTERVAL"
done
