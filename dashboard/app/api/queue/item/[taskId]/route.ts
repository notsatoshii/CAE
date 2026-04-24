/**
 * GET /api/queue/item/[taskId] — queue item detail for the clicked-card sheet.
 *
 * Used by components/queue/queue-item-sheet.tsx to hydrate the sheet with
 * the actual queue-item shape (not phase-shape). Viewer role is enough —
 * this is read-only.
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getQueueItem, TASK_ID_RE } from "@/lib/cae-queue-item";
import { withLog } from "@/lib/with-log";

async function getHandler(
  _req: NextRequest,
  ctx: { params: Promise<{ taskId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { taskId } = await ctx.params;
  if (!TASK_ID_RE.test(taskId)) {
    return Response.json({ error: "invalid taskId" }, { status: 400 });
  }
  const item = await getQueueItem(taskId);
  if (!item) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(item);
}

type Ctx = { params: Promise<{ taskId: string }> };
export const GET = withLog(
  getHandler as (req: Request, ctx: Ctx) => Promise<Response>,
  "/api/queue/item/[taskId]",
);
