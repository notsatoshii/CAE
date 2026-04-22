import { NextRequest, NextResponse } from "next/server"
import { getCatalog } from "@/lib/cae-skills-catalog"

// Must run in Node.js runtime for fs access (readLocalSkillsDir uses node:fs)
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/skills?q=<query>
 * Returns merged CatalogSkill[] from skills.sh + ClawHub + local.
 * Uses 15-min in-memory cache per query (per research Pitfall 1).
 *
 * TODO(14-04): Add operator role gate via NextAuth middleware.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? undefined
  try {
    const catalog = await getCatalog({ q })
    return NextResponse.json(catalog)
  } catch (err) {
    console.error("[api/skills] getCatalog error:", err)
    return NextResponse.json(
      { error: "Failed to fetch catalog" },
      { status: 500 }
    )
  }
}
