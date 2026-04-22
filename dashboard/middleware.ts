/**
 * middleware.ts — Route protection + role-based access gating.
 *
 * Phase 1: unauthenticated → redirect to /signin.
 * Phase 14 Plan 04: role-based gating for admin pages + operator-required mutations.
 *
 * Pitfall 3 (Research): middleware runs in Edge runtime. NO fs/spawn. Only
 * auth check + role check + plain redirects / JSON responses.
 *
 * Defense layers:
 *  1. This middleware (first line — fast, before handler runs)
 *  2. Each hardened route handler re-checks role independently (defense-in-depth)
 *
 * STRIDE T-14-04-02: Role comes from req.auth (verified signed JWT) not client claim.
 * STRIDE T-14-04-03: Middleware matcher escape via URL-encoding → defense-in-depth
 *   in route handlers covers this.
 */
import { auth } from "@/auth"
import { NextResponse, type NextRequest } from "next/server"
import { isAtLeast } from "@/lib/cae-rbac"
import type { Role } from "@/lib/cae-types"

/**
 * middlewareHandler — the pure routing logic, exported for unit testing.
 *
 * Receives a NextRequest augmented with .auth by NextAuth (or null if not signed in).
 */
export function middlewareHandler(
  req: NextRequest & { auth: { user?: { role?: Role } } | null },
): NextResponse {
  // ── Unauthenticated → redirect to /signin ──────────────────────────────────
  if (!req.auth) {
    const from = req.nextUrl.pathname
    const signinUrl = new URL("/signin", req.nextUrl.origin)
    signinUrl.searchParams.set("from", from)
    return NextResponse.redirect(signinUrl)
  }

  const role = req.auth.user?.role as Role | undefined
  const path = req.nextUrl.pathname
  const method = req.method

  // ── Admin-only pages and API routes ────────────────────────────────────────
  if (path.startsWith("/build/admin") || path.startsWith("/api/admin")) {
    if (!role || !isAtLeast(role, "admin")) {
      if (path.startsWith("/api/")) {
        return NextResponse.json(
          { error: "forbidden", required: "admin" },
          { status: 403 },
        )
      }
      return NextResponse.redirect(new URL("/403", req.nextUrl.origin))
    }
  }

  // ── Operator-required API mutations ────────────────────────────────────────
  // Each entry: [path regex, allowed methods that require operator+]
  const operatorMutations: Array<[RegExp, string[]]> = [
    [/^\/api\/queue\/delegate(\/|$)/, ["POST", "PUT", "PATCH", "DELETE"]],
    [/^\/api\/workflows\/[^/]+\/run(\/|$)/, ["POST"]],
    [/^\/api\/skills\/install(\/|$)/, ["POST"]],
    [/^\/api\/schedule(\/[^/]+)?(\/|$)/, ["POST", "PATCH", "DELETE", "PUT"]],
  ]

  for (const [re, methods] of operatorMutations) {
    if (re.test(path) && methods.includes(method)) {
      if (!role || !isAtLeast(role, "operator")) {
        return NextResponse.json(
          { error: "forbidden", required: "operator" },
          { status: 403 },
        )
      }
    }
  }

  return NextResponse.next()
}

// NextAuth wraps our handler — req.auth is injected before our code runs.
export default auth(middlewareHandler as Parameters<typeof auth>[0])

export const config = {
  matcher: [
    "/plan/:path*",
    "/build/:path*",
    "/memory",
    "/metrics",
    "/floor",
    "/floor/:path*",
    "/api/tail",
    "/api/state",
    "/api/queue/:path*",
    "/api/workflows/:path*",
    "/api/skills/:path*",
    "/api/schedule/:path*",
    "/api/admin/:path*",
  ],
}
