import { NextResponse } from "next/server"
import { getCatalog } from "@/lib/cae-skills-catalog"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/skills/installed
 * Returns only installed skills (source:"local" or installed:true) from getCatalog.
 *
 * TODO(14-04): Add operator role gate via NextAuth middleware.
 */
export async function GET() {
  try {
    const all = await getCatalog()
    const installed = all.filter((s) => s.source === "local" || s.installed)
    return NextResponse.json(installed)
  } catch (err) {
    console.error("[api/skills/installed] error:", err)
    return NextResponse.json(
      { error: "Failed to fetch installed skills" },
      { status: 500 }
    )
  }
}
