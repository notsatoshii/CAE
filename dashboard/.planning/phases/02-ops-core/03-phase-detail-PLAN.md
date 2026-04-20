---
phase: 2
plan: A
wave: 3
name: Wave 3 — /ops/phase/[num] detail + metrics + tail
---

# Wave 3 — Phase detail page

**Depends on:** Wave 2.

Two parallel tasks — split by concern:

<task id="1">
<name>Phase detail route: tasks, waves, commits</name>
<files>/home/cae/ctrl-alt-elite/dashboard/app/ops/phase/[num]/page.tsx, /home/cae/ctrl-alt-elite/dashboard/app/ops/phase/[num]/waves-view.tsx, /home/cae/ctrl-alt-elite/dashboard/lib/cae-phase-detail.ts</files>
<action>
1. New lib `lib/cae-phase-detail.ts`:
   - `getPhaseDetail(projectRoot: string, phaseNumber: number): Promise<PhaseDetail>` returning `{ number, name, planFiles: PlanFile[], tasks: TaskState[], summary: string | null, mergedCommits: string[], currentBranch: string }`
   - `PlanFile` includes parsed frontmatter + task list from `<task id="N">` XML blocks
   - `TaskState` per task: `{ taskId, planFile, status: 'pending'|'running'|'merged'|'failed', attempts, outputPath }` — status inferred from forge branch existence + merge history + metrics events

2. `app/ops/phase/[num]/page.tsx` — server component reading `params.num` + `searchParams.project`. Calls `getPhaseDetail`. Renders heading + `<WavesView detail={detail} />`.

3. `waves-view.tsx` — client component. Groups tasks by wave number. Each wave = collapsible section with task cards. Each task card shows: task ID, plan file, current status badge, attempts count, "View output" button.

4. Auto-refresh every 5s.

5. Commit: `feat(ops): phase detail route with waves + task states`.
</action>
<verify>
test -f /home/cae/ctrl-alt-elite/dashboard/app/ops/phase/[num]/page.tsx && test -f /home/cae/ctrl-alt-elite/dashboard/lib/cae-phase-detail.ts && cd /home/cae/ctrl-alt-elite/dashboard && pnpm build 2>&1 | grep Compiled | head -1
</verify>
</task>

<task id="2">
<name>Live tail SSE endpoint + panel</name>
<files>/home/cae/ctrl-alt-elite/dashboard/app/api/tail/route.ts, /home/cae/ctrl-alt-elite/dashboard/components/tail-panel.tsx, /home/cae/ctrl-alt-elite/dashboard/lib/tail-stream.ts</files>
<action>
1. `lib/tail-stream.ts`:
   - `createTailStream(filepath: string, signal: AbortSignal): ReadableStream<string>` — opens file, reads in append-mode using `fs.watch` + `fs.createReadStream` with position tracking. Emits each new line as a data chunk. Gracefully handles file rotation or absence.

2. `app/api/tail/route.ts` — GET handler with query params `?path=<encoded-file-path>`. Returns a Server-Sent Events response streaming file contents. Must:
   - Validate path is under an allowed root (`.cae/metrics/`, `.planning/phases/`, or `/home/cae/outbox/`) — reject otherwise (security: prevent arbitrary file reads)
   - Set `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
   - Use the Tail helper from lib

3. `components/tail-panel.tsx` — client component accepting `path: string` prop. Uses `EventSource` (built-in) to connect to `/api/tail?path=<path>`. Renders incoming lines in a `<pre>` with auto-scroll-to-bottom. "Pause" button toggles auto-scroll. Max 500 lines in DOM (drop oldest).

4. Expose in phase detail page when user clicks a task's "View output" button — can modalize or inline.

5. Commit: `feat(ops): SSE live tail for metrics + task outputs`.
</action>
<verify>
test -f /home/cae/ctrl-alt-elite/dashboard/app/api/tail/route.ts && test -f /home/cae/ctrl-alt-elite/dashboard/components/tail-panel.tsx && test -f /home/cae/ctrl-alt-elite/dashboard/lib/tail-stream.ts && cd /home/cae/ctrl-alt-elite/dashboard && pnpm build 2>&1 | grep Compiled | head -1
</verify>
</task>
