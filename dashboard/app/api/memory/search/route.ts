/**
 * Phase 8 Wave 2 (MEM-04): GET /api/memory/search?q=<str>[&roots=<csv>]
 *
 * ripgrep-backed full-text search across the memory-source allowlist.
 * `q` required, ≤ 200 chars (enforced both here and in `searchMemory`).
 * `roots` optional CSV of abs project paths — intersected with the
 * server allowlist inside `searchMemory`.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchMemory } from "@/lib/cae-memory-search";
import {
  unauthorized,
  badRequest,
  internalError,
} from "@/lib/cae-memory-api-helpers";
import { log } from "@/lib/log";
import { withLog } from "@/lib/with-log";

export const dynamic = "force-dynamic";

const l = log("api.memory.search");

async function getHandler(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) return unauthorized();

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  if (q.length === 0) return badRequest("missing_q");
  if (q.length > 200) return badRequest("query_too_long");

  const rootsParam = url.searchParams.get("roots");
  const roots = rootsParam
    ? rootsParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : undefined;

  try {
    const hits = await searchMemory(q, roots);
    return NextResponse.json({ q, hits });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("too long")) {
      return badRequest("query_too_long");
    }
    l.error({ err }, "memory search failed");
    return internalError("search_failed");
  }
}

export const GET = withLog(getHandler, "/api/memory/search");
