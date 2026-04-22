---
tags: [cae, state-management, file-io]
---

# cae-disk-state

## CAE State Reader File Formats

**DONE.md** (outbox tasks) — YAML frontmatter only, no body:
```yaml
status: completed | queued | pending
summary: human description
branch: git-branch-name
commits: N
```
Parse with `yaml.parse(content.split('---')[1])`.

**Inbox/Outbox structure:** Task dirs scanned recursively from `INBOX_ROOT` / `OUTBOX_ROOT` env vars.
- Inbox: `BUILDPLAN.md` required, `META.yaml` optional
- Outbox: `DONE.md` required (frontmatter only)

**Metrics location:** `.cae/metrics/circuit-breakers.jsonl` — append-only, one JSON event per line.

**Logs location:** `.cae/logs/p{N}-{taskKey}.log` — include in SSE `ALLOWED_ROOTS` for tailing.

**Type gaps:** InboxTask lacks `hasMetaYaml` field; OutboxTask type has `processed?` but not rendered. Extend types to match actual format.

