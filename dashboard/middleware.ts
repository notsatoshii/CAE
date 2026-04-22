import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (!req.auth) {
    const from = req.nextUrl.pathname;
    const signinUrl = new URL(`/signin`, req.nextUrl.origin);
    signinUrl.searchParams.set("from", from);
    return NextResponse.redirect(signinUrl);
  }
});

export const config = {
  matcher: [
    "/plan/:path*",
    "/build/:path*",
    "/memory",
    "/metrics",
    "/floor",
    "/floor/:path*",
    "/api/tail",   // CR-03: SSE stream carries project telemetry — must be auth-gated
    "/api/state",  // CR-03: dashboard snapshot carries circuit-breakers, tokens, inbox/outbox
  ],
};
