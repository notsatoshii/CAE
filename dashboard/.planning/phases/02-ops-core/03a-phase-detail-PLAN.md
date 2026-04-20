---
phase: 2
plan: A
wave: 3
name: Wave 3 — phase detail route
---

# Wave 3 — Phase detail route

**Depends on:** Wave 2.

<task id="1">
<name>Phase detail route: tasks, waves, commits</name>
<files>/home/cae/ctrl-alt-elite/dashboard/app/ops/phase/[num]/page.tsx, /home/cae/ctrl-alt-elite/dashboard/app/ops/phase/[num]/waves-view.tsx, /home/cae/ctrl-alt-elite/dashboard/lib/cae-phase-detail.ts</files>
<action>
1. New lib `lib/cae-phase-detail.ts`:
   - `getPhaseDetail(projectRoot: string, phaseNumber: number): Promise<PhaseDetail>` returning `{ number, name, planFiles: PlanFile[], tasks: TaskState[], summary: string | null, mergedCommits: string[], currentBranch: string }`
   - `PlanFile` includes parsed frontmatter + task list from `<task id="N">` XML blocks
   - `TaskState` per task: `{ taskId, planFile, status: 'pending'|'running'|'merged'|'failed', attempts, outputPath }` — status inferred from forge branch existence + merge history + metrics events

2. `app/ops/phase/[num]/page.tsx` — server component reading `params.num` + `searchParams.project`. Calls `getPhaseDetail`. Renders heading + `<WavesView detail={detail} />`.

3. `waves-view.tsx` — client component. Groups tasks by wave number. Each wave = collapsible section with task cards. Each task card shows: task ID, plan file, current status badge, attempts count, "View output" link pointing to `?tail=<encoded-path>`. The actual tail panel is implemented in the next wave; this task just wires the link.

4. Auto-refresh every 5s via router.refresh().

5. Commit: `feat(ops): phase detail route with waves + task states`.
</action>
<verify>
test -f /home/cae/ctrl-alt-elite/dashboard/app/ops/phase/[num]/page.tsx && test -f /home/cae/ctrl-alt-elite/dashboard/lib/cae-phase-detail.ts && cd /home/cae/ctrl-alt-elite/dashboard && pnpm build 2>&1 | grep Compiled | head -1
</verify>
</task>
