/**
 * audit/auth/mint-session.ts
 *
 * Mint a Playwright `storageState.json` containing a NextAuth v5 (Auth.js)
 * session cookie for the headless harness user.
 *
 * Why this exists:
 *   The audit harness drives every protected route; it cannot complete the
 *   GitHub/Google OAuth dance from a headless browser. We instead forge the
 *   exact same encrypted session token the runtime issues after a real sign-in
 *   and drop it into a Playwright `storageState` file so the harness boots
 *   pre-authenticated.
 *
 * Why not jsonwebtoken:
 *   NextAuth v5 / Auth.js does NOT issue a JWS. It issues a JWE
 *   (encrypted JWT, alg=dir, enc=A256CBC-HS512) keyed by HKDF over
 *   AUTH_SECRET with salt = cookie name. The CAPTURE-IMPL-PLAN spec mentions
 *   `jsonwebtoken` and a `next-auth.session-token` cookie name; both are
 *   stale (NextAuth v4). The actual cookie name in this codebase is
 *   `authjs.session-token` and tokens must be JWE — verified by reading
 *   `node_modules/.pnpm/@auth+core@0.41.2/node_modules/@auth/core/src/jwt.ts`
 *   and `lib/utils/cookie.js` (defaultCookies). We therefore call the same
 *   `encode()` the runtime uses, guaranteeing the token round-trips through
 *   /api/auth/session.
 *
 * Role assignment:
 *   `resolveRole(email)` reads ADMIN_EMAILS / OPERATOR_EMAILS from env.
 *   For deterministic captures we set `token.role = "admin"` directly so the
 *   harness reaches every admin-gated route regardless of env config.
 *
 * Output:
 *   audit/auth/storage-state.json — Playwright storage-state shape with one
 *   cookie. Gitignored (see audit/auth/.gitignore).
 *
 * Usage:
 *   AUTH_SECRET=... npx tsx audit/auth/mint-session.ts            # default localhost:3002
 *   AUDIT_BASE_URL=http://localhost:3002 npx tsx audit/auth/mint-session.ts
 *
 * Verification:
 *   curl -sS -b "authjs.session-token=$(jq -r '.cookies[0].value' audit/auth/storage-state.json)" \
 *        http://localhost:3002/api/auth/session
 *   → returns { user: { email: "harness@cae.local", role: "admin", ... }, expires: ... }
 */

// `next-auth/jwt` re-exports `@auth/core/jwt` (`export * from "@auth/core/jwt"`).
// We import via the next-auth surface so Vite/Vitest resolves it cleanly —
// next-auth is a top-level dep; @auth/core is only a transitive under pnpm.
import { encode } from "next-auth/jwt"
import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const HARNESS_EMAIL = "harness@cae.local"
const HARNESS_NAME = "Audit Harness"
const HARNESS_SUB = "harness-cae-audit"
const HARNESS_ROLE = "admin"

// Auth.js v5 cookie names live in @auth/core/lib/utils/cookie.js → defaultCookies.
// On http (dev) the unprefixed name is used; on https the cookie is prefixed
// with `__Secure-`. The dashboard dev server is plain http://localhost:3002,
// so we always emit the unprefixed name. The salt passed to encode() must
// equal the cookie name (Auth.js HKDF derives the key from secret + salt).
const COOKIE_NAME_INSECURE = "authjs.session-token"
const COOKIE_NAME_SECURE = "__Secure-authjs.session-token"

// Match the runtime default: 30 days. (See @auth/core/src/jwt.ts DEFAULT_MAX_AGE.)
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60

interface ParsedBaseUrl {
  hostname: string
  protocol: "http:" | "https:"
  isSecure: boolean
}

function parseBaseUrl(raw: string): ParsedBaseUrl {
  const u = new URL(raw)
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`AUDIT_BASE_URL must be http:// or https:// — got ${u.protocol}`)
  }
  return {
    hostname: u.hostname,
    protocol: u.protocol,
    isSecure: u.protocol === "https:",
  }
}

/**
 * Best-effort `.env.local` loader so the script works without `dotenv`
 * registered. We deliberately keep it tiny — only KEY=value lines, ignores
 * comments, no quote unwrapping logic beyond stripping balanced surrounding
 * single/double quotes. Process env wins over file values.
 */
async function loadEnvLocal(repoRoot: string): Promise<void> {
  const path = join(repoRoot, ".env.local")
  let text: string
  try {
    text = await readFile(path, "utf8")
  } catch {
    return
  }
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith("\"") && val.endsWith("\"")) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) {
      process.env[key] = val
    }
  }
}

export interface MintedCookie {
  name: string
  value: string
  domain: string
  path: string
  httpOnly: boolean
  secure: boolean
  sameSite: "Lax" | "Strict" | "None"
  expires: number // Playwright wants seconds since epoch
}

export interface StorageState {
  cookies: MintedCookie[]
  origins: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>
}

export interface MintOptions {
  baseUrl: string
  secret: string
  email?: string
  role?: string
  name?: string
  sub?: string
  maxAgeSeconds?: number
}

/**
 * mintSessionState — produce a Playwright `storageState`-shaped object with
 * one Auth.js v5 session cookie that the dashboard will accept on
 * `${baseUrl}/api/auth/session`.
 *
 * Pure function — no fs side-effects so unit tests can call it directly.
 */
export async function mintSessionState(opts: MintOptions): Promise<StorageState> {
  const { hostname, isSecure } = parseBaseUrl(opts.baseUrl)
  const cookieName = isSecure ? COOKIE_NAME_SECURE : COOKIE_NAME_INSECURE
  const maxAge = opts.maxAgeSeconds ?? MAX_AGE_SECONDS

  // Token shape mirrors what the runtime jwt callback writes after sign-in:
  //   - sub:   subject id (lib/cae-rbac never reads this; NextAuth requires a string)
  //   - email: lowercased (auth.ts session callback writes back token.email)
  //   - role:  copied to session.user.role by auth.ts session callback
  //   - name:  shown by user-menu component
  // No `picture`, no `iat/exp` — encode() sets iat + exp from maxAge itself.
  const token = {
    sub: opts.sub ?? HARNESS_SUB,
    email: (opts.email ?? HARNESS_EMAIL).toLowerCase(),
    name: opts.name ?? HARNESS_NAME,
    role: opts.role ?? HARNESS_ROLE,
  }

  const value = await encode({
    token,
    secret: opts.secret,
    salt: cookieName,
    maxAge,
  })

  const cookie: MintedCookie = {
    name: cookieName,
    value,
    domain: hostname,
    path: "/",
    httpOnly: true,
    secure: isSecure,
    sameSite: "Lax",
    expires: Math.floor(Date.now() / 1000) + maxAge,
  }

  return { cookies: [cookie], origins: [] }
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url))
  // audit/auth → audit → dashboard
  const repoRoot = join(here, "..", "..")

  await loadEnvLocal(repoRoot)

  const baseUrl = process.env.AUDIT_BASE_URL ?? "http://localhost:3002"
  // Auth.js v5 standard: AUTH_SECRET. NEXTAUTH_SECRET is the v4 alias and
  // some older docs still use it — accept either.
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error(
      "AUTH_SECRET (or NEXTAUTH_SECRET) is required. Add it to .env.local " +
        "or run: openssl rand -base64 32",
    )
  }

  const email = process.env.AUDIT_HARNESS_EMAIL
  const role = process.env.AUDIT_HARNESS_ROLE
  const state = await mintSessionState({
    baseUrl,
    secret,
    email,
    role,
  })

  const outPath = join(here, "storage-state.json")
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(state, null, 2) + "\n", "utf8")

  // eslint-disable-next-line no-console
  console.log(
    `mint-session: wrote ${outPath}\n` +
      `  baseUrl  = ${baseUrl}\n` +
      `  cookie   = ${state.cookies[0].name}\n` +
      `  domain   = ${state.cookies[0].domain}\n` +
      `  email    = ${email ?? HARNESS_EMAIL}\n` +
      `  role     = ${role ?? HARNESS_ROLE}\n` +
      `  expires  = ${new Date(state.cookies[0].expires * 1000).toISOString()}\n` +
      `\nVerify with:\n` +
      `  curl -sS -b "${state.cookies[0].name}=$(jq -r '.cookies[0].value' ${outPath})" \\\n` +
      `       ${baseUrl}/api/auth/session`,
  )
}

// Only auto-run when invoked directly via `tsx audit/auth/mint-session.ts`,
// not when imported by tests.
const invokedDirectly = (() => {
  try {
    return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
  } catch {
    return false
  }
})()

if (invokedDirectly) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("mint-session failed:", err)
    process.exit(1)
  })
}
