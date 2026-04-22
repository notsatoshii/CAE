# Dashboard Scripts

Utility scripts for CAE dashboard setup and maintenance.

## Scheduler (Plan 14-03)

### cae-scheduler-watcher.sh

Every-minute watcher that reads `$CAE_ROOT/scheduled_tasks.json`, computes next-run for each task using cron-parser, and dispatches `cae execute-buildplan` for tasks that are due and enabled.

**Environment variables:**
- `CAE_ROOT` (default: `/home/cae/ctrl-alt-elite`) — registry location
- `DASHBOARD_DIR` (default: `/home/cae/ctrl-alt-elite/dashboard`) — where node_modules lives
- `LOCK_DIR` (default: `/tmp`) — where per-task `.lock` files are written

**Log output:**
- `/tmp/cae-scheduler.log` — cron stdout/stderr (set by install-scheduler-cron.sh)
- `$CAE_ROOT/.cae/metrics/scheduler.jsonl` — structured dispatch events (JSONL)

**Debug manually:**
```bash
bash scripts/cae-scheduler-watcher.sh
```

### install-scheduler-cron.sh

Idempotent user-crontab installer. Adds one `* * * * * cae-scheduler-watcher.sh` line with a marker comment. Re-running is safe — exits 0 if already installed.

**Install:**
```bash
bash scripts/install-scheduler-cron.sh
```

**Verify installed:**
```bash
crontab -l | grep CAE_SCHEDULER_WATCHER
```

**Remove:**
```bash
crontab -e
# Delete the two lines: the marker comment + the watcher line
```

---

## Security (Plan 14-01)

### install-gitleaks.sh

Installs gitleaks v8.18.4 binary to `/usr/local/bin/`. Idempotent — skips if already at correct version.

```bash
sudo bash scripts/install-gitleaks.sh
```

---

## Audit / Verification

### audit-a11y.sh — Accessibility audit using axe-core
### verify-explain-keys.sh — Confirm all UI labels have explain-mode entries
### verify-keybindings-wiring.sh — Confirm keyboard shortcut wiring
### verify-memory-hook.sh — Confirm audit-hook.sh is writing JSONL
### lint-no-dollar.sh — Reject shell scripts that use `$()` without quoting
