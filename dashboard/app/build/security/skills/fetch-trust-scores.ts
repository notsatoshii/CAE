/**
 * fetchTrustScores — server-side fetch helper for /build/security/skills.
 *
 * Hardened against HTML 500s / wrong-port routing (see C1 audit bug:
 * NEXTAUTH_URL default of localhost:3000 hit a neighbouring static server
 * that returned `<!doctype ...>`, crashing res.json() in server render).
 *
 * Contract:
 *   - Always resolves with TrustEntry[] (never throws).
 *   - If response isn't 2xx or isn't application/json, returns [].
 *   - If JSON.parse fails for any reason, returns [].
 *   - Picks base URL from AUTH_URL > NEXTAUTH_URL > localhost:3000.
 */
import type { CatalogSkill, TrustScore } from "@/lib/cae-types"

export type TrustEntry = { skill: CatalogSkill; trust: TrustScore }

function resolveBaseUrl(): string {
  // NextAuth v5 uses AUTH_URL; v4 used NEXTAUTH_URL. Prefer v5.
  return (
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  )
}

export async function fetchTrustScores(
  cookieHeader: string,
  fetchImpl: typeof fetch = fetch
): Promise<TrustEntry[]> {
  const base = resolveBaseUrl()
  let res: Response
  try {
    res = await fetchImpl(`${base}/api/security/trust`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    })
  } catch (err) {
    // Network-layer fail (DNS, refused, abort). Caveman: swallow, return empty.
    console.warn("[security/skills] trust fetch network error", {
      base,
      err: err instanceof Error ? err.message : String(err),
    })
    return []
  }

  if (!res.ok) {
    console.warn("[security/skills] trust fetch non-ok", {
      status: res.status,
      base,
    })
    return []
  }

  // Guard: upstream must be JSON. Wrong-port routing returns HTML.
  const ct = res.headers.get("content-type") ?? ""
  if (!ct.toLowerCase().startsWith("application/json")) {
    console.warn("[security/skills] trust fetch wrong content-type", {
      contentType: ct,
      base,
    })
    return []
  }

  try {
    // `await` here so the try/catch actually catches a rejected promise.
    const data = (await res.json()) as unknown
    if (!Array.isArray(data)) {
      console.warn("[security/skills] trust fetch non-array payload")
      return []
    }
    return data as TrustEntry[]
  } catch (err) {
    console.warn("[security/skills] trust fetch json parse failed", {
      err: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}
