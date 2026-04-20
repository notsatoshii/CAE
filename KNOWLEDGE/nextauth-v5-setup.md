---
tags: [nextauth, v5, auth, middleware, github-oauth]
---

# nextauth-v5-setup

## Route Handler Pattern

V5 uses a handlers export object. Route files re-export its GET/POST properties:

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

## Middleware + Route Protection

Middleware checks session and redirects unauth users:

```typescript
export const config = {
  matcher: ["/build/:path*", "/ops/:path*"],
};

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname.match(/^\/(build|ops)/)) {
    return NextResponse.redirect(new URL(`/signin?from=${req.nextUrl.pathname}`, req.url));
  }
});
```

## Environment Variables

- `AUTH_SECRET` — generated via `openssl rand -hex 32`
- `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` — from GitHub OAuth app
- `AUTH_URL` — deployed URL for production, `http://localhost:3000` for dev

