#!/usr/bin/env bash
# install-heartbeat-daemon.sh — make the 5s heartbeat daemon boot-persistent.
#
# Prefers systemd (if PID 1 is systemd). Falls back to @reboot cron otherwise.
# Idempotent — safe to re-run.

set -euo pipefail

CAE_ROOT="${CAE_ROOT:-/home/cae/ctrl-alt-elite}"
DAEMON="$CAE_ROOT/dashboard/scripts/heartbeat-daemon.sh"

if [[ ! -x "$DAEMON" ]]; then
  echo "error: daemon not executable at $DAEMON" >&2
  exit 1
fi

if command -v systemctl >/dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
  UNIT_FILE="/etc/systemd/system/cae-heartbeat.service"
  cat > "$UNIT_FILE" <<EOF
[Unit]
Description=CAE heartbeat daemon (5s interval)
After=network.target

[Service]
Type=simple
ExecStart=$DAEMON
Restart=on-failure
RestartSec=3
Environment=HEARTBEAT_INTERVAL_SEC=5
Environment=CAE_ROOT=$CAE_ROOT

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now cae-heartbeat.service
  echo "installed: systemd cae-heartbeat.service"
  systemctl status --no-pager cae-heartbeat.service | head -6
else
  LINE="@reboot $DAEMON > /tmp/cae-heartbeat-daemon.out 2>&1 &"
  ( crontab -l 2>/dev/null | grep -v "heartbeat-daemon.sh"; echo "$LINE" ) | crontab -
  echo "installed: @reboot cron line"
fi
