---
phase: 2
plan: A
wave: 4
name: Wave 4 — SSE tail endpoint + panel
---

# Wave 4 — Live tail

**Depends on:** Wave 3.

<task id="1">
<name>Live tail SSE endpoint + panel</name>
<files>/home/cae/ctrl-alt-elite/dashboard/app/api/tail/route.ts, /home/cae/ctrl-alt-elite/dashboard/components/tail-panel.tsx, /home/cae/ctrl-alt-elite/dashboard/lib/tail-stream.ts</files>
<action>
1. `lib/tail-stream.ts`:
   - `createTailStream(filepath: string, signal: AbortSignal): ReadableStream<string>` — opens file, reads in append-mode using `fs.watch` + `fs.createReadStream` with position tracking. Emits each new line as a data chunk. Gracefully handles file rotation or absence.

2. `app/api/tail/route.ts` — GET handler with query params `?path=<encoded-file-path>`. Returns a Server-Sent Events response streaming file contents. Must:
   - Validate path is under an allowed root (`.cae/metrics/`, `.planning/phases/`, or `/home/cae/outbox/`) — reject otherwise (prevents arbitrary reads)
   - Set `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
   - Use the tail helper from lib

3. `components/tail-panel.tsx` — client component accepting `path: string` prop. Uses `EventSource` (built-in) to connect to `/api/tail?path=<path>`. Renders incoming lines in a `<pre>` with auto-scroll-to-bottom. "Pause" button toggles auto-scroll. Max 500 lines in DOM (drop oldest).

4. Wire into phase detail page from wave 3: when `?tail=<path>` search param is present, render TailPanel in a side-sheet (shadcn Sheet component — run `pnpm dlx shadcn@latest add --yes sheet` if not already present) alongside the waves view.

5. Commit: `feat(ops): SSE live tail for metrics + task outputs`.
</action>
<verify>
test -f /home/cae/ctrl-alt-elite/dashboard/app/api/tail/route.ts && test -f /home/cae/ctrl-alt-elite/dashboard/components/tail-panel.tsx && test -f /home/cae/ctrl-alt-elite/dashboard/lib/tail-stream.ts && cd /home/cae/ctrl-alt-elite/dashboard && pnpm build 2>&1 | grep Compiled | head -1
</verify>
</task>
