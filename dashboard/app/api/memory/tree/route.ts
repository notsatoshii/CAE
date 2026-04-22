/**
 * Phase 8 Wave 2 (MEM-02): GET /api/memory/tree
 *
 * Returns the cross-project memory tree built from D-10 globs.
 * Consumed by the Browse tab's FileTree component (Wave 3).
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildMemoryTree } from "@/lib/cae-memory-sources";
import {
  unauthorized,
  internalError,
} from "@/lib/cae-memory-api-helpers";
import { log } from "@/lib/log";
import { withLog } from "@/lib/with-log";

export const dynamic = "force-dynamic";

const l = log("api.memory.tree");

async function getHandler(): Promise<NextResponse> {
  const session = await auth();
  if (!session) return unauthorized();
  try {
    const projects = await buildMemoryTree();
    return NextResponse.json({ projects });
  } catch (err) {
    l.error({ err }, "memory tree build failed");
    return internalError("tree_failed");
  }
}

export const GET = withLog(getHandler as (req: Request) => Promise<Response>, "/api/memory/tree");
