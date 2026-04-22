/**
 * Phase 8 Wave 2 (MEM-05): GET /api/memory/graph
 *
 * Returns the classified GraphPayload loaded from `.cae/graph.json`.
 * When the file doesn't exist yet, returns 200 with an empty envelope
 * (`total_nodes: 0`) so the UI can render the "not built yet" empty state
 * without branching on error shapes.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadGraph } from "@/lib/cae-graph-state";
import {
  unauthorized,
  internalError,
} from "@/lib/cae-memory-api-helpers";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session) return unauthorized();
  try {
    const graph = await loadGraph();
    if (graph === null) {
      // UI interprets total_nodes === 0 as "not built yet" — render the
      // empty banner + Regenerate CTA.
      return NextResponse.json({
        nodes: [],
        links: [],
        generated_at: "",
        source_path: "",
        truncated: false,
        total_nodes: 0,
      });
    }
    return NextResponse.json(graph);
  } catch (err) {
    console.error("/api/memory/graph failed", err);
    return internalError("graph_failed");
  }
}
