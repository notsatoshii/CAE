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
  matcher: ["/build/:path*", "/ops/:path*"],
};
