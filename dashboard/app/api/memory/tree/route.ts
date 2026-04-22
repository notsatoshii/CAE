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

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session) return unauthorized();
  try {
    const projects = await buildMemoryTree();
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("/api/memory/tree failed", err);
    return internalError("tree_failed");
  }
}
