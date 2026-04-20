---
phase: 2
plan: A
wave: 5
name: Wave 5 — delegation queue (inbox/outbox) + manual delegation
---

# Wave 5 — Delegation queue

**Depends on:** Wave 1 (lib) + Wave 4 (metrics).

<task id="1">
<name>Build /ops/queue page + delegate server action</name>
<files>/home/cae/ctrl-alt-elite/dashboard/app/ops/queue/page.tsx, /home/cae/ctrl-alt-elite/dashboard/app/ops/queue/delegate-form.tsx, /home/cae/ctrl-alt-elite/dashboard/app/ops/queue/actions.ts, /home/cae/ctrl-alt-elite/dashboard/components/shell/mode-toggle.tsx</files>
<action>
1. `app/ops/queue/page.tsx` — server component:
   - Calls `listInbox()` + `listOutbox()` from lib/cae-state
   - Shows two tables side-by-side: "Inbox (awaiting execution)" and "Outbox (completed)"
   - Columns (inbox): task_id, age, has_buildplan, has_meta, actions (View BUILDPLAN link → new modal/page)
   - Columns (outbox): task_id, status badge, summary (truncated), branch, commits count, processed?, actions (View DONE link)
   - `<DelegateForm />` at top

2. `actions.ts` — server actions:
   - `createDelegation(formData: FormData)`: validates input, generates task_id `web-<uuid>`, writes `/home/cae/inbox/<task_id>/BUILDPLAN.md` + `META.yaml` if target_repo specified, spawns `cae execute-buildplan <task_id>` via `child_process.spawn` in detached mode with `tmux new-session -d -s "buildplan-<short>" "cae execute-buildplan <task_id>"`. Returns task_id.
   - `revalidate` the page after creation
   - Require auth: `const session = await auth(); if (!session) throw new Error("unauthorized");`

3. `delegate-form.tsx` — client component form with shadcn Input + Textarea:
   - Target repo path (text, optional — defaults to CAE_ROOT)
   - BUILDPLAN markdown (textarea, required)
   - "Delegate to CAE" button → calls server action
   - Shows created task_id with link to queue after submit

4. Update `mode-toggle.tsx` (or add link in ops layout) to include a "Queue" link when in Ops mode.

5. Commit: `feat(ops): delegation queue + manual CAE task dispatcher`.
</action>
<verify>
cd /home/cae/ctrl-alt-elite/dashboard && test -f app/ops/queue/page.tsx && test -f app/ops/queue/delegate-form.tsx && test -f app/ops/queue/actions.ts && pnpm build 2>&1 | grep Compiled | head -1
</verify>
</task>
