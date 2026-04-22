/**
 * Phase 9 Plan 02 (CHG-01): GET /api/changes
 *
 * Auth-gated merge-timeline aggregator. Returns `ProjectGroup[]` ready for
 * the Wave 2 Changes UI (plan 09-04). The aggregator (`getChangesGrouped`)
 * handles all git-log walking, dedupe, and forge_end join — this route is
 * a thin auth + 30s-cache envelope.
 *
 * Security:
 *   - `auth()` guard → 401 on no session (threat T-09-02-01).
 *   - No query params in v1 (30-day filter is a client-side concern over the
 *     returned window; keeps the surface minimal).
 *   - Read-only; no POST / PUT / DELETE.
 *
 * See 09-02-PLAN.md Task 2 and 09-CONTEXT.md §D-01.
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getChangesGrouped } from "@/lib/cae-changes-state";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    const projects = await getChangesGrouped();
    return Response.json({
      projects,
      generated_at: new Date().toISOString(),
      cache_ttl_ms: 30_000,
    });
  } catch (err) {
    console.error("[/api/changes] failed:", err);
    return Response.json({ error: "changes_failed" }, { status: 500 });
  }
}
