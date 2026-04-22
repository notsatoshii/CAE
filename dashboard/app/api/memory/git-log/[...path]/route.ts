/**
 * Phase 8 Wave 2 (MEM-10): GET /api/memory/git-log/[...path][?since=&until=]
 *
 * Returns the git-log history for a single memory-source file (D-07:
 * per-file scope, no global timeline). Path must pass the D-10 allowlist;
 * the owning project root is resolved from the server allowlist.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { gitLogForFile } from "@/lib/cae-memory-git";
import { isMemorySourcePath, getAllowedRoots } from "@/lib/cae-memory-sources";
import {
  unauthorized,
  forbidden,
  notFound,
  internalError,
  reconstituteAbsPath,
  resolveProjectRoot,
} from "@/lib/cae-memory-api-helpers";
import { log } from "@/lib/log";
import { withLog } from "@/lib/with-log";

export const dynamic = "force-dynamic";

const l = log("api.memory.git-log");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function getHandler(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session) return unauthorized();

  const { path: segments } = await ctx.params;
  const abs = reconstituteAbsPath(segments);
  if (!abs) return notFound("missing_path");

  const allowed = await getAllowedRoots();
  if (!isMemorySourcePath(abs)) return forbidden("not_memory_source");

  const projectRoot = resolveProjectRoot(abs, allowed);
  if (!projectRoot) return forbidden("unresolvable_project_root");

  const url = new URL(req.url);
  const since = url.searchParams.get("since") ?? undefined;
  const until = url.searchParams.get("until") ?? undefined;
  if (since && !DATE_RE.test(since)) return forbidden("bad_since");
  if (until && !DATE_RE.test(until)) return forbidden("bad_until");

  try {
    const gitLog = await gitLogForFile(projectRoot, abs, since, until);
    return NextResponse.json({ path: abs, log: gitLog });
  } catch (err) {
    l.error({ err }, "git log for file failed");
    return internalError("git_log_failed");
  }
}

export const GET = withLog(getHandler, "/api/memory/git-log");
