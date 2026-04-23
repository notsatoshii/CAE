/**
 * components/logs/detectors.ts — Phase 15 Wave 5.1.
 *
 * Pure helpers used by LogLineRow:
 *   - detectCurlCandidate: extracts an HTTP request shape from a parsed
 *     pino payload (method + url + headers + body).
 *   - composeCurl: builds a `curl ...` shell command from a candidate.
 *   - detectStackFrames: pulls `path/file.ts:LINE` frames out of a raw
 *     log payload (handles V8 stack `at fn (path:line:col)` form too).
 *
 * Pure data — no React, no DOM, safe to test directly.
 */

export interface CurlCandidate {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
}

export interface StackFrame {
  /** Absolute (or repo-relative) path the editor will open. */
  path: string
  /** Last path segment for compact display. */
  short: string
  /** 1-based line number. */
  line: number
}

/**
 * Inspect a pino `obj` (or any record) and return a curl candidate IFF
 * we have at minimum a method + url. Headers + body are best-effort.
 */
export function detectCurlCandidate(
  obj: Record<string, unknown> | undefined,
): CurlCandidate | null {
  if (!obj) return null
  const method = pickString(obj, ["method", "httpMethod"]) ?? "GET"
  const url = pickString(obj, ["url", "href", "endpoint"])
  if (!url) return null

  // Common log shapes:
  //   { req: { method, url, headers } }
  //   { request: { method, url, headers } }
  //   { method, url, headers }
  let headers: Record<string, string> | undefined
  const headerCandidates = [
    obj.headers,
    (obj.req as Record<string, unknown> | undefined)?.headers,
    (obj.request as Record<string, unknown> | undefined)?.headers,
  ]
  for (const h of headerCandidates) {
    if (h && typeof h === "object") {
      headers = sanitiseHeaders(h as Record<string, unknown>)
      break
    }
  }

  let body: string | undefined
  const bodyVal = obj.body ?? obj.payload
  if (typeof bodyVal === "string" && bodyVal.length > 0) body = bodyVal
  else if (bodyVal && typeof bodyVal === "object") body = JSON.stringify(bodyVal)

  return { method: method.toUpperCase(), url, headers, body }
}

/** Build a shell-safe curl command from a CurlCandidate. */
export function composeCurl(c: CurlCandidate): string {
  const parts = ["curl", "-X", c.method, shellQuote(c.url)]
  if (c.headers) {
    for (const [k, v] of Object.entries(c.headers)) {
      parts.push("-H", shellQuote(`${k}: ${v}`))
    }
  }
  if (c.body) {
    parts.push("--data", shellQuote(c.body))
  }
  return parts.join(" ")
}

/**
 * Extract `path:line` candidates from a raw log payload.
 *
 * Handles three common forms:
 *   1. V8 stack frame:  `at fnName (/abs/path/file.ts:42:7)`
 *   2. Bare reference:  `/abs/path/file.ts:42:7`
 *   3. Relative:        `lib/foo.ts:42`
 *
 * Dedupes identical (path, line) tuples and caps at 8 frames.
 */
export function detectStackFrames(raw: string): StackFrame[] {
  const out: StackFrame[] = []
  const seen = new Set<string>()
  // Combined regex covering all three forms — non-greedy on the path part.
  const re =
    /(?:at\s+[^\s(]+\s+\()?((?:\/|[A-Za-z]:[\\/])?(?:[\w@.\-/\\]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|sh|py|go|rs|java)))(?::(\d+))(?::\d+)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const path = m[1]
    const line = parseInt(m[2], 10)
    if (!Number.isFinite(line)) continue
    const key = `${path}:${line}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ path, short: shortenPath(path), line })
    if (out.length >= 8) break
  }
  return out
}

function shortenPath(p: string): string {
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] ?? p
}

function pickString(
  obj: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.length > 0) return v
  }
  return undefined
}

/**
 * Header sanitiser: drops well-known auth headers (defence-in-depth — pino
 * already redacts these on write, but client-side data may flow through
 * other paths). Coerces values to strings.
 */
const SECRET_HEADER_RE = /^(authorization|cookie|x-api-key|x-auth-token|set-cookie|.*session-token.*)$/i
function sanitiseHeaders(h: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(h)) {
    if (SECRET_HEADER_RE.test(k)) {
      out[k] = "[REDACTED]"
    } else {
      out[k] = String(v)
    }
  }
  return out
}

/** Single-quote shell escape (handles embedded single quotes). */
function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}
