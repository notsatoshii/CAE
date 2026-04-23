#!/usr/bin/env bash
# heartbeat-emitter.sh — synthetic heartbeat for Live Floor liveness.
#
# Why: Live Floor watches circuit-breakers.jsonl via /api/tail SSE. When no
# real GSD activity is firing (long stretches between phases), Floor looks
# frozen. This script emits one tiny "heartbeat" event so the floor and any
# activity panels can render a visible pulse and a "system online — last
# heartbeat Ns ago" status.
#
# Cron-scheduled @ 30s (registered by install-scheduler-cron.sh).
#
# Writes to TWO destinations:
#   1. .cae/metrics/heartbeat.jsonl     — dedicated audit trail
#   2. .cae/metrics/circuit-breakers.jsonl — primary Floor SSE source so the
#      existing /api/tail pipeline picks it up without code changes to the
#      stream router. The Floor's parseEvent allowlist must include
#      "heartbeat" — see lib/floor/event-adapter.ts ALLOWED_EVENTS.
#
# Idempotent + crash-safe: pure append, no locks needed (single-line append
# under PIPE_BUF is atomic on Linux). Exit 0 even on errors so cron stays clean.

set -uo pipefail

CAE_ROOT="${CAE_ROOT:-/home/cae/ctrl-alt-elite}"
METRICS_DIR="$CAE_ROOT/.cae/metrics"
mkdir -p "$METRICS_DIR" 2>/dev/null || exit 0

TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
LINE="{\"ts\":\"$TS\",\"event\":\"heartbeat\",\"source\":\"heartbeat-emitter\"}"

# Append to dedicated heartbeat log (audit trail / future consumers)
printf '%s\n' "$LINE" >> "$METRICS_DIR/heartbeat.jsonl" 2>/dev/null || true

# Append to circuit-breakers.jsonl so the existing Floor SSE source picks it up.
# Floor only renders events on its allowlist (see event-adapter.ts) — heartbeat
# is mapped to a subtle station pulse so the canvas keeps animating.
printf '%s\n' "$LINE" >> "$METRICS_DIR/circuit-breakers.jsonl" 2>/dev/null || true

# Also write to the dashboard's local metrics dir so the dev dashboard sees
# liveness when Floor is loaded against the dashboard project itself.
DASH_METRICS="$CAE_ROOT/dashboard/.cae/metrics"
if [[ -d "$DASH_METRICS" ]]; then
  printf '%s\n' "$LINE" >> "$DASH_METRICS/heartbeat.jsonl" 2>/dev/null || true
  printf '%s\n' "$LINE" >> "$DASH_METRICS/circuit-breakers.jsonl" 2>/dev/null || true
fi

exit 0
