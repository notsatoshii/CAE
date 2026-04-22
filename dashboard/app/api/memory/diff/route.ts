/**
 * Phase 8 Wave 2 (MEM-10): POST /api/memory/diff
 *
 * Body: { path: string, sha_a: string, sha_b: string }
 * Validates: path passes D-10 allowlist + owning root resolves; both
 * shas match /^[0-9a-f]{7,40}$/ (redundant with `gitDiff`'s own check but
 * catches bad input before the subprocess spawn).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { gitDiff } from "@/lib/cae-memory-git";
import { isMemorySourcePath, getAllowedRoots } from "@/lib/cae-memory-sources";
import {
  unauthorized,
  badRequest,
  forbidden,
  internalError,
  resolveProjectRoot,
} from "@/lib/cae-memory-api-helpers";
import { log } from "@/lib/log";
import { withLog } from "@/lib/with-log";

export const dynamic = "force-dynamic";

const l = log("api.memory.diff");
const SHA_RE = /^[0-9a-f]{7,40}$/;

async function postHandler(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid_json");
  }
  if (typeof body !== "object" || body === null) {
    return badRequest("missing_body");
  }
  const b = body as { path?: unknown; sha_a?: unknown; sha_b?: unknown };
  const abs = typeof b.path === "string" ? b.path : "";
  const shaA = typeof b.sha_a === "string" ? b.sha_a : "";
  const shaB = typeof b.sha_b === "string" ? b.sha_b : "";

  if (!abs) return badRequest("missing_path");
  if (!SHA_RE.test(shaA)) return badRequest("bad_sha_a");
  if (!SHA_RE.test(shaB)) return badRequest("bad_sha_b");

  const allowed = await getAllowedRoots();
  if (!isMemorySourcePath(abs)) return forbidden("not_memory_source");
  const projectRoot = resolveProjectRoot(abs, allowed);
  if (!projectRoot) return forbidden("unresolvable_project_root");

  try {
    const diff = await gitDiff(projectRoot, shaA, shaB, abs);
    return NextResponse.json({ path: abs, sha_a: shaA, sha_b: shaB, diff });
  } catch (err) {
    l.error({ err }, "git diff failed");
    return internalError("diff_failed");
  }
}

export const POST = withLog(postHandler, "/api/memory/diff");
