/**
 * Phase 8 Wave 1 (MEM-09, D-03): GET /api/memory/consult/[task_id]
 *
 * Returns the set of memory sources consulted by the Claude-Code session
 * that handled `task_id`, as recorded by the PostToolUse hook at
 * /home/cae/ctrl-alt-elite/tools/memory-consult-hook.sh. The route is
 * force-dynamic — the aggregator walks jsonl per request, response shape
 * is small, and memory-consult.jsonl grows per-agent-run so any cache
 * would risk staleness. The aggregator has its own 60s process cache for
 * burst-query smoothing.
 *
 * Response shape:
 *   {
 *     task_id: string,
 *     entries: Array<{ source_path: string, ts: string }>,
 *     found:   boolean   // false → client shows the heuristic fallback
 *   }
 *
 * Auth:
 *   Requires an authenticated session (direct auth() call — middleware
 *   only gates /memory, /metrics, /plan/*, /build/* page routes, NOT
 *   /api/*). Unauthenticated callers get 401.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMemoryConsultEntries } from "@/lib/cae-memory-consult";
import { log } from "@/lib/log";
import { withLog } from "@/lib/with-log";

export const dynamic = "force-dynamic";

const l = log("api.memory.consult");

async function getHandler(
  _req: NextRequest,
  ctx: { params: Promise<{ task_id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { task_id: taskId } = await ctx.params;
  if (!taskId || typeof taskId !== "string" || taskId.length > 200) {
    return NextResponse.json({ error: "bad task_id" }, { status: 400 });
  }
  try {
    const result = await getMemoryConsultEntries(taskId);
    return NextResponse.json(result);
  } catch (err) {
    // Log full error server-side but don't leak path/fs details to client.
    l.error({ err }, "memory consult lookup failed");
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

type TaskCtx = { params: Promise<{ task_id: string }> };
export const GET = withLog(
  getHandler as (req: Request, ctx: TaskCtx) => Promise<Response>,
  "/api/memory/consult",
);
