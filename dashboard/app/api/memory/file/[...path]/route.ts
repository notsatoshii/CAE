/**
 * Phase 8 Wave 2 (MEM-03): GET /api/memory/file/[...path]
 *
 * Returns the raw markdown contents of a memory-source file. The catchall
 * segment list is reconstituted into an absolute path, validated against
 * the D-10 allowlist (`isMemorySourcePath`), and capped at 512 KB.
 *
 * 403 on not-a-memory-source, 404 on missing, 200 with {path,contents,size}
 * on success.
 */
import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { auth } from "@/auth";
import { isMemorySourcePath, getAllowedRoots } from "@/lib/cae-memory-sources";
import {
  unauthorized,
  notFound,
  forbidden,
  internalError,
  reconstituteAbsPath,
} from "@/lib/cae-memory-api-helpers";

export const dynamic = "force-dynamic";

const MAX_BYTES = 512 * 1024;

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session) return unauthorized();

  const { path: segments } = await ctx.params;
  const abs = reconstituteAbsPath(segments);
  if (!abs) return notFound("missing_path");

  // Warm the allowlist so isMemorySourcePath enforces root-prefix check.
  await getAllowedRoots();
  if (!isMemorySourcePath(abs)) return forbidden("not_memory_source");

  try {
    const info = await stat(abs);
    if (!info.isFile()) return notFound("not_a_file");
    if (info.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "too_large", size: info.size, cap: MAX_BYTES },
        { status: 413 },
      );
    }
    const contents = await readFile(abs, "utf8");
    return NextResponse.json({ path: abs, contents, size: info.size });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | null)?.code;
    if (code === "ENOENT") return notFound("missing_file");
    console.error("/api/memory/file failed", err);
    return internalError("read_failed");
  }
}
