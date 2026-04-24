/**
 * POST /api/queue/item/[taskId]/action — wire queue-sheet controls to real
 * backend side effects. Supersedes the 4 `toast.info` stubs that were wired
 * in class19b.
 *
 * Body: { action: "abort" | "retry" | "approve" | "deny" }
 *   abort   — tmux kill-session + write HALT marker. Any role ≥ operator.
 *   retry   — remove HALT / SENTINEL_REVIEW + respawn tmux session.
 *   approve — remove SENTINEL_REVIEW + drop APPROVED marker (review flow).
 *   deny    — remove SENTINEL_REVIEW + drop HALT marker (review flow).
 *
 * NOT wired (kept as hidden controls in the sheet, documented in
 * docs/queue-backend-gaps.md): pause, abandon, reassign, edit-plan.
 *
 * Middleware already restricts POST /api/queue/:path* to operator+ at the
 * edge; this handler re-checks with requireRole() as defense-in-depth (same
 * STRIDE pattern as /api/workflows/[slug]/run).
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { requireRole } from "@/lib/cae-rbac";
import {
  abortTask,
  approveReview,
  denyReview,
  retryTask,
  TASK_ID_RE,
} from "@/lib/cae-queue-item";
import { withLog } from "@/lib/with-log";
import type { Role } from "@/lib/cae-types";

const ACTIONS = new Set(["abort", "retry", "approve", "deny"]);

async function postHandler(
  req: NextRequest,
  ctx: { params: Promise<{ taskId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!requireRole(session.user?.role as Role | undefined, "operator")) {
    return Response.json({ error: "forbidden", required: "operator" }, { status: 403 });
  }
  const { taskId } = await ctx.params;
  if (!TASK_ID_RE.test(taskId)) {
    return Response.json({ error: "invalid taskId" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json body" }, { status: 400 });
  }
  const action =
    typeof body === "object" && body !== null && typeof (body as { action?: unknown }).action === "string"
      ? ((body as { action: string }).action)
      : null;
  if (!action || !ACTIONS.has(action)) {
    return Response.json(
      { error: "unsupported action", supported: Array.from(ACTIONS) },
      { status: 400 },
    );
  }
  let result;
  switch (action) {
    case "abort":
      result = await abortTask(taskId);
      break;
    case "retry":
      result = await retryTask(taskId);
      break;
    case "approve":
      result = await approveReview(taskId);
      break;
    case "deny":
      result = await denyReview(taskId);
      break;
    default:
      return Response.json({ error: "unreachable" }, { status: 500 });
  }
  if (!result.ok) return Response.json(result, { status: 400 });
  return Response.json(result);
}

type Ctx = { params: Promise<{ taskId: string }> };
export const POST = withLog(
  postHandler as (req: Request, ctx: Ctx) => Promise<Response>,
  "/api/queue/item/[taskId]/action",
);
