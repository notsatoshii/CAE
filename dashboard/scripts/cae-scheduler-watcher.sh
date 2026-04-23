#!/usr/bin/env bash
# cae-scheduler-watcher.sh — CAE scheduled-task dispatcher
#
# Runs every minute via user crontab (installed by install-scheduler-cron.sh).
# Reads scheduled_tasks.json at CAE_ROOT, computes next-run per task,
# dispatches cae execute-buildplan for tasks that are due AND enabled.
#
# Security:
#   - Task id validated at write-time (^[a-z0-9-]+$); watcher trusts registry.
#   - buildplan validated at write-time (BUILDPLAN_RE); no shell metacharacters.
#   - CR-04: tmux command uses `bash -c '...' _ "$1" "$2" "$3"` positional arg
#     pattern — buildplan, id, and log path are passed as argv, never interpolated
#     into the shell command string.
#   - flock -n per-task prevents double-fire when runs overlap (pitfall 7).
#   - lastRun written BEFORE spawn to prevent duplicate dispatch on crash.
#
# Dependencies: bash, jq, node (for cron-parser), flock, tmux (optional)

set -uo pipefail

CAE_ROOT="${CAE_ROOT:-/home/cae/ctrl-alt-elite}"
TASKS_FILE="$CAE_ROOT/scheduled_tasks.json"
LOG="$CAE_ROOT/.cae/metrics/scheduler.jsonl"
LOCK_DIR="${LOCK_DIR:-/tmp}"

# Dashboard directory (where node_modules lives)
DASHBOARD_DIR="${DASHBOARD_DIR:-/home/cae/ctrl-alt-elite/dashboard}"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG")"

# Auto-create empty registry if missing
if [[ ! -f "$TASKS_FILE" ]]; then
  echo "[]" > "$TASKS_FILE"
  exit 0
fi

NOW=$(date +%s)

# Resolve node binary
NODE_BIN="$(command -v node 2>/dev/null || true)"
if [[ -z "$NODE_BIN" ]]; then
  for p in /usr/bin/node /usr/local/bin/node "$HOME/.nvm/versions/node/"*/bin/node; do
    if [[ -x "$p" ]]; then
      NODE_BIN="$p"
      break
    fi
  done
fi

if [[ -z "$NODE_BIN" ]]; then
  echo "{\"ts\":$NOW,\"event\":\"error\",\"msg\":\"node not found on PATH\"}" >> "$LOG"
  exit 1
fi

# Resolve cae binary
CAE_BIN="$(command -v cae 2>/dev/null || true)"

# Path to cron-parser module (in dashboard node_modules)
CRON_PARSER_INDEX="$DASHBOARD_DIR/node_modules/cron-parser/dist/index.js"

# Compute next run after lastRun using node + cron-parser
# Returns epoch seconds, or 0 if computation fails.
# Uses CJS require pattern for broader compatibility.
compute_next_run() {
  local cron_expr="$1"
  local tz="$2"
  local last_run="$3"

  "$NODE_BIN" -e "
const cp = require('$CRON_PARSER_INDEX');
const Parser = cp.CronExpressionParser || (cp.default && cp.default.CronExpressionParser);
try {
  const iter = Parser.parse('$cron_expr', {
    currentDate: new Date($last_run * 1000),
    tz: '$tz'
  });
  process.stdout.write(String(Math.floor(iter.next().getTime() / 1000)));
} catch(e) {
  process.stdout.write('0');
}
" 2>/dev/null || echo 0
}

# Process each task from registry
while IFS= read -r task; do
  id=$(echo "$task" | jq -r '.id')
  enabled=$(echo "$task" | jq -r '.enabled')
  cron=$(echo "$task" | jq -r '.cron')
  tz=$(echo "$task" | jq -r '.timezone // "UTC"')
  last=$(echo "$task" | jq -r '.lastRun // 0')
  buildplan=$(echo "$task" | jq -r '.buildplan')

  # Skip disabled tasks (T-14-03: disabled tasks never dispatch)
  [[ "$enabled" == "true" ]] || continue

  # Compute next run time
  next=$(compute_next_run "$cron" "$tz" "$last")

  # Skip if compute failed or task is not yet due
  if [[ -z "$next" ]] || [[ "$next" == "0" ]] || [[ "$NOW" -lt "$next" ]]; then
    continue
  fi

  LOCK="$LOCK_DIR/cae-scheduler-${id}.lock"

  # Acquire non-blocking flock in subshell to handle concurrent watcher instances.
  # pitfall 7: flock -n prevents double-fire; lastRun updated BEFORE spawn.
  (
    exec 9>"$LOCK"
    if ! flock -n 9; then
      echo "{\"ts\":$NOW,\"event\":\"skip_locked\",\"id\":\"$id\"}" >> "$LOG"
      exit 0
    fi

    # Log dispatch event
    echo "{\"ts\":$NOW,\"event\":\"dispatch\",\"id\":\"$id\",\"cron\":\"$cron\"}" >> "$LOG"

    # Update lastRun BEFORE spawn (pitfall 7 — prevents re-dispatch on crash)
    tmp_file=$(mktemp)
    if jq --arg id "$id" --argjson ts "$NOW" \
        'map(if .id == $id then .lastRun = $ts else . end)' \
        "$TASKS_FILE" > "$tmp_file"; then
      mv "$tmp_file" "$TASKS_FILE"
    else
      rm -f "$tmp_file"
    fi

    # Spawn the buildplan execution
    if command -v tmux >/dev/null 2>&1; then
      # Spawn via tmux so /api/tail can stream logs (Phase 2 pattern)
      #
      # CR-04 fix: buildplan, id, and log path are passed as positional arguments
      # to an inner `bash -c` script, NOT interpolated into the command string.
      # This eliminates the shell-injection vector regardless of path content.
      #
      # Argument mapping inside the inner script:
      #   $0 = script name placeholder (_)
      #   $1 = CAE_BIN
      #   $2 = buildplan path
      #   $3 = task id
      #   $4 = log file path
      session="scheduler-${id}"
      tmux kill-session -t "$session" 2>/dev/null || true
      if [[ -n "$CAE_BIN" ]]; then
        tmux new-session -d -s "$session" -- \
          bash -c '"$1" execute-buildplan < "$2"; echo "{\"ts\":$(date +%s),\"event\":\"complete\",\"id\":\"$3\"}" >> "$4"' \
          _ "$CAE_BIN" "$buildplan" "$id" "$LOG"
      fi
    else
      # No-tmux fallback: run in background subshell
      # The fallback uses "$buildplan" as a quoted variable — already safe.
      if [[ -n "$CAE_BIN" ]]; then
        (
          "$CAE_BIN" execute-buildplan < "$buildplan" >> "$LOG" 2>&1
          echo "{\"ts\":$(date +%s),\"event\":\"complete\",\"id\":\"$id\"}" >> "$LOG"
        ) &
      else
        # Log that we would dispatch but cae binary is missing
        echo "{\"ts\":$NOW,\"event\":\"skip_no_cae\",\"id\":\"$id\"}" >> "$LOG"
      fi
    fi
  ) &

done < <(jq -c '.[]' "$TASKS_FILE" 2>/dev/null)

# Wait for all dispatched subshells before exiting
wait
