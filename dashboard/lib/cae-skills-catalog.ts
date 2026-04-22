import type { CatalogSkill } from "./cae-types"
import { fetchSkillsSh } from "./cae-skills-scrape-shsh"
import { fetchClawHub } from "./cae-skills-scrape-clawhub"
import { readLocalSkillsDir } from "./cae-skills-local"

const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

type CacheEntry = {
  items: CatalogSkill[]
  fetchedAt: number
}

// In-memory cache — keyed by `${q ?? ""}:${NODE_ENV}` so dev hot-reload
// doesn't serve stale data across env changes.
const _cache = new Map<string, CacheEntry>()

/**
 * Merges a flat list of CatalogSkill items by deduplicating on `${owner}/${name}`.
 *
 * Merge rules:
 * - sources[] accumulates all origins the skill was seen in
 * - First non-null description/installs/stars wins
 * - installed = true if ANY group member has installed:true (local always wins)
 * - installCmd from the first group member that has one
 */
export function dedupeMergeByName(items: CatalogSkill[]): CatalogSkill[] {
  const groups = new Map<string, CatalogSkill[]>()

  for (const skill of items) {
    const key = `${skill.owner}/${skill.name}`
    const group = groups.get(key)
    if (group) {
      group.push(skill)
    } else {
      groups.set(key, [skill])
    }
  }

  const merged: CatalogSkill[] = []

  for (const group of groups.values()) {
    const base = group[0]
    const sources = [
      ...new Set(group.map((s) => s.source)),
    ] as Array<"skills.sh" | "clawhub" | "local">

    const description =
      group.find((s) => s.description)?.description ?? base.description
    const installs = group.find((s) => typeof s.installs === "number")?.installs
    const stars = group.find((s) => typeof s.stars === "number")?.stars
    const installed = group.some((s) => s.installed)
    const installCmd =
      group.find((s) => s.installCmd && s.installCmd !== "already installed")
        ?.installCmd ?? base.installCmd
    const detailUrl = base.detailUrl

    merged.push({
      name: base.name,
      owner: base.owner,
      source: base.source,
      sources,
      description,
      installs,
      stars,
      installCmd,
      detailUrl,
      installed,
    })
  }

  // Sort: installed first, then by installs+stars descending
  merged.sort((a, b) => {
    if (a.installed && !b.installed) return -1
    if (!a.installed && b.installed) return 1
    const aScore = (a.installs ?? 0) + (a.stars ?? 0)
    const bScore = (b.installs ?? 0) + (b.stars ?? 0)
    return bScore - aScore
  })

  return merged
}

export type GetCatalogOpts = {
  q?: string
  fetchImpl?: typeof fetch
  localDir?: string
}

/**
 * Fetches and merges skills from all 3 sources: skills.sh, ClawHub, and local.
 *
 * Server-side in-memory cache with 15-min TTL (per research Pitfall 1) to
 * avoid rate-limiting from skills.sh. Cache key includes NODE_ENV so
 * dev hot-reload doesn't serve stale data.
 */
export async function getCatalog(opts: GetCatalogOpts = {}): Promise<CatalogSkill[]> {
  const { q, fetchImpl, localDir } = opts
  const cacheKey = `${q ?? ""}:${process.env.NODE_ENV ?? "development"}`
  const now = Date.now()

  const cached = _cache.get(cacheKey)
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.items
  }

  const [shSkills, clawHubSkills, localSkills] = await Promise.all([
    fetchSkillsSh(q, fetchImpl),
    fetchClawHub(q, fetchImpl),
    readLocalSkillsDir(localDir),
  ])

  const all = [...shSkills, ...clawHubSkills, ...localSkills]
  const items = dedupeMergeByName(all)

  _cache.set(cacheKey, { items, fetchedAt: now })

  return items
}
