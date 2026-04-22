/**
 * Phase 8 Wave 2: shared helpers for the /api/memory/* route surface.
 *
 * Centralizes the auth envelope + project-root resolution used by every
 * route so the failure envelopes stay uniform and no route leaks raw
 * `Error.message` to the wire.
 */
import { NextResponse } from "next/server";

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function badRequest(reason: string): NextResponse {
  return NextResponse.json({ error: "bad_request", reason }, { status: 400 });
}

export function notFound(reason = "not_found"): NextResponse {
  return NextResponse.json({ error: reason }, { status: 404 });
}

export function forbidden(reason: string): NextResponse {
  return NextResponse.json({ error: "forbidden", reason }, { status: 403 });
}

export function internalError(label: string): NextResponse {
  return NextResponse.json({ error: "internal", label }, { status: 500 });
}

/**
 * Return the first allowlisted root that `absPath` lives under, or `null`
 * if the path escapes every root. Used by routes that receive an abs path
 * via `[...path]` and need to resolve the owning project root.
 */
export function resolveProjectRoot(
  absPath: string,
  roots: readonly string[],
): string | null {
  for (const r of roots) {
    if (absPath === r || absPath.startsWith(r + "/")) return r;
  }
  return null;
}

/**
 * Reconstitute an absolute path from a Next.js `[...path]` catchall.
 * Next drops the leading "/" of the URL, so `pathSegments[0]` is the
 * first non-"/" segment. We prepend "/" to get back the original abs.
 */
export function reconstituteAbsPath(pathSegments: string[] | undefined): string {
  if (!Array.isArray(pathSegments) || pathSegments.length === 0) return "";
  return "/" + pathSegments.map((s) => decodeURIComponent(s)).join("/");
}
