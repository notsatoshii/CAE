import { NextRequest, NextResponse } from "next/server"
import { getCatalog } from "@/lib/cae-skills-catalog"
import { getSkillsLastUpdatedMap } from "@/lib/skills/last-updated"
import { getLocalSkillsMtimeMap } from "@/lib/cae-skills-local"
import { enrichSkillsWithLastUpdated } from "@/lib/skills/enrich"

// Must run in Node.js runtime for fs access (readLocalSkillsDir uses node:fs)
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/skills?q=<query>
 * Returns merged CatalogSkill[] from skills.sh + ClawHub + local,
 * decorated with `lastUpdatedISO` from git-log (repo skills) or fs.stat
 * mtime (locally installed skills).
 * Uses 15-min in-memory cache per query (per research Pitfall 1).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? undefined
  try {
    const [catalog, gitMap, mtimeMap] = await Promise.all([
      getCatalog({ q }),
      getSkillsLastUpdatedMap().catch(() => ({})),
      getLocalSkillsMtimeMap().catch(() => ({})),
    ])
    // Git-log timestamps win; fall back to fs.stat mtime for local-only skills.
    const lastUpdatedMap = { ...mtimeMap, ...gitMap }
    const enriched = enrichSkillsWithLastUpdated(catalog, lastUpdatedMap)
    return NextResponse.json(enriched)
  } catch (err) {
    console.error("[api/skills] getCatalog error:", err)
    return NextResponse.json(
      { error: "Failed to fetch catalog" },
      { status: 500 }
    )
  }
}
