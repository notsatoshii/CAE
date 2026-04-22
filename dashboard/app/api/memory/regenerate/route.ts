/**
 * Phase 8 Wave 2 (MEM-08): POST /api/memory/regenerate
 *
 * Triggers the pure-TS memory-graph walker (D-02). 60s server-side
 * cooldown (D-06) — rejects with 429 + `retry_after_ms` when invoked
 * within the cooldown window. On success returns {ok:true, duration_ms}.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { regenerateGraph } from "@/lib/cae-graph-state";
import {
  unauthorized,
  internalError,
} from "@/lib/cae-memory-api-helpers";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const session = await auth();
  if (!session) return unauthorized();
  try {
    const result = await regenerateGraph();
    if (!result.ok && result.error === "cooldown") {
      return NextResponse.json(
        {
          error: "cooldown",
          retry_after_ms: result.retry_after_ms ?? 60_000,
        },
        { status: 429 },
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { error: "regenerate_failed", label: result.error ?? "unknown" },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      duration_ms: result.duration_ms,
      total_nodes: result.total_nodes,
    });
  } catch (err) {
    console.error("/api/memory/regenerate failed", err);
    return internalError("regenerate_failed");
  }
}
