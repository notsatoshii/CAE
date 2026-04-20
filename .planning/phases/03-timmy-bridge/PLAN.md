---
phase: 3
plan: A
wave: 1
name: Timmy bridge — file-mediated Hermes → CAE delegation
---

# Phase 3 — Timmy bridge

**Goal:** Wire Hermes (`/home/timmy/.hermes/`) to CAE via a file-mediated contract so
Master can say "/delegate build X" and get a Telegram ping when CAE finishes.

**Architecture:**

```
Master → Hermes /delegate → writes /home/cae/inbox/<id>/BUILDPLAN.md
                          → spawns `cae execute-buildplan <id>` in detached tmux
                          → confirms delegation to Master

CAE execute-buildplan     → reads inbox buildplan
                          → picks target repo (from META.yaml or buildplan hint)
                          → runs execution loop on isolated branch
                          → writes /home/cae/outbox/<id>/DONE.md when finished

Hermes outbox watcher     → detects DONE.md
                          → parses frontmatter
                          → sends Telegram notification
                          → marks task .processed
```

---

<task id="1">
<name>Create inbox/outbox directory contract</name>
<files>/home/cae/inbox/CONTRACT.md, /home/cae/outbox/CONTRACT.md</files>
<action>
Create /home/cae/inbox/ and /home/cae/outbox/ as world-writable dirs (Timmy UID timmy,
CAE UID root/cae). Write CONTRACT.md in each explaining the schema:
  - inbox/<task-id>/BUILDPLAN.md — freeform markdown buildplan
  - inbox/<task-id>/META.yaml (optional) — {target_repo, constraints, budget, branch_base}
  - outbox/<task-id>/DONE.md — completion sentinel with YAML frontmatter
  - outbox/<task-id>/artifacts/ — optional output files CAE wants surfaced
  - outbox/<task-id>/.processed — flag Hermes drops after handling the notification
</action>
<verify>
ls /home/cae/inbox/CONTRACT.md /home/cae/outbox/CONTRACT.md
ls -ld /home/cae/inbox /home/cae/outbox | grep "drwxrwxr"
</verify>
</task>

<task id="2">
<name>Add `cae execute-buildplan` subcommand</name>
<files>/home/cae/ctrl-alt-elite/bin/cae</files>
<action>
New subcommand. Signature: `cae execute-buildplan <task-id> [--dry-run]`.
Behavior:
  1. Read /home/cae/inbox/<task-id>/BUILDPLAN.md — die if missing
  2. Read /home/cae/inbox/<task-id>/META.yaml if present (target_repo, branch_base, constraints)
  3. cd into target_repo (default: CAE_ROOT if not specified — buildplan may target CAE itself)
  4. Create branch `buildplan/<short-task-id>` from branch_base (default: main)
  5. Invoke Forge via existing adapter with the buildplan as the task spec
  6. On success: commit, write DONE.md with status=success, commits, branch, summary
  7. On failure: write DONE.md with status=failed, error, partial_commits
  8. On blocked (missing context, needs approval): status=blocked
  9. Always write started_at + finished_at timestamps
  10. Flush DONE.md atomically (write .tmp, fsync, rename) so the watcher can't see partial writes
</action>
<verify>
cae execute-buildplan --help prints usage
Dry-run on a fixture task-id shows what it would do
</verify>
</task>

<task id="3">
<name>Rewrite Hermes timmy-delegate SKILL.md to new contract</name>
<files>/home/timmy/.hermes/skills/timmy-delegate/SKILL.md</files>
<action>
Replace v0.1 (direct claude spawn, GSD autonomous) with v0.2 file-mediated flow:
  1. Generate task-id = uuid
  2. Draft buildplan from Master's request
  3. Write to /home/cae/inbox/<id>/BUILDPLAN.md + META.yaml
  4. Spawn `tmux new-session -d -s cae-<short-id> 'cae execute-buildplan <id> 2>&1 | tee /home/cae/outbox/<id>/cae.log'`
  5. Reply to Master: "Delegated task <short-id>, watching for completion"
  6. Store task-id in ~/.hermes/memories/delegations.md for status queries
</action>
<verify>
Reading SKILL.md shows v0.2 contract, no references to /gsd-autonomous spawn
</verify>
</task>

<task id="4">
<name>Hermes outbox watcher (cron or inotify)</name>
<files>/home/timmy/.hermes/cron/jobs.json, /home/timmy/.hermes/skills/timmy-delegate/watcher.sh</files>
<action>
Simplest viable approach: Hermes cron job runs every minute, scans /home/cae/outbox/*/DONE.md
where sibling .processed flag is absent.
For each match:
  1. Parse YAML frontmatter
  2. Send Telegram via existing Hermes gateway send_message API
  3. Create .processed flag to prevent duplicate notifications
Use a standalone shell script (watcher.sh) the cron job invokes, so it's testable outside Hermes.
Notification template:
  "CAE task <short-id> <emoji-for-status>: <summary>. <N> commits on <branch>."
</action>
<verify>
Drop a fixture DONE.md in /home/cae/outbox/test/ → run watcher.sh → .processed appears
</verify>
</task>

<task id="5">
<name>Integration test: end-to-end dummy delegation</name>
<files>scripts/test-timmy-bridge.sh</files>
<action>
One script that:
  1. Picks a trivial task ("add a comment to /tmp/timmy-bridge-test.txt")
  2. Writes fixture BUILDPLAN.md + META.yaml to inbox
  3. Runs `cae execute-buildplan <id>` inline (not detached, for testability)
  4. Asserts DONE.md appeared with status=success
  5. Invokes watcher.sh with TEST_MODE=1 (skips real TG, just prints what would send)
  6. Asserts .processed flag appeared
  7. Prints PASS/FAIL summary
</action>
<verify>bash scripts/test-timmy-bridge.sh && echo "integration green"</verify>
</task>

---

## Execution notes (dogfood attempt → direct implement)

CAE was unable to self-dogfood this phase because the CAE repo `.planning/` was
never initialized (`cae-init.sh` requires pre-existing `.planning/config.json` from
`/gsd-new-project`, and running that full flow would exceed the user's "hurry up"
budget). This PLAN.md is kept as the audit-trail artifact showing what CAE *would*
have executed — commits on the `timmy-bridge` branch correspond 1:1 to these tasks.

The 5-task decomposition matches CAE's wave model (all wave 1, single plan, serial
within plan). If Phase 3 is later re-run through `cae execute-phase 03`, the tasks
can be ported to `<task>` XML blocks with minimal edits.
