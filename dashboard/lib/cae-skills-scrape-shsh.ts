import type { CatalogSkill } from "./cae-types"

const SKILLS_SH_URL = "https://skills.sh/trending"

/**
 * Fetches and parses the skills.sh trending page for skill cards.
 *
 * HTML structure (from fixture):
 *   <article class="skill-card" data-name="..." data-owner="...">
 *     <h3>owner/name</h3>
 *     <p class="desc">description</p>
 *     <span class="installs">12,453</span>
 *     <a class="detail-link" href="...">View</a>
 *   </article>
 *
 * Graceful degradation: non-2xx response → returns [] (per research Pitfall 1).
 * HTML length capped at 1MB before parse (T-14-02-03 DoS mitigation).
 * Regex uses non-backtracking patterns to prevent ReDoS.
 */
export async function fetchSkillsSh(
  q?: string,
  fetchImpl: typeof fetch = fetch
): Promise<CatalogSkill[]> {
  const url = q
    ? `${SKILLS_SH_URL}?q=${encodeURIComponent(q)}`
    : SKILLS_SH_URL

  let html: string
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) {
      console.warn(`[cae-skills-scrape-shsh] skills.sh returned ${res.status}`)
      return []
    }
    html = await res.text()
    // Cap at 1MB to prevent ReDoS on huge payloads
    if (html.length > 1_000_000) {
      html = html.slice(0, 1_000_000)
    }
  } catch (err) {
    console.warn(`[cae-skills-scrape-shsh] fetch error:`, err)
    return []
  }

  return parseSkillsShHtml(html)
}

/**
 * Parses skill cards from skills.sh HTML.
 * Uses simple attribute and element extraction without nested quantifiers.
 */
function parseSkillsShHtml(html: string): CatalogSkill[] {
  const skills: CatalogSkill[] = []

  // Match each <article class="skill-card" data-name="..." data-owner="..."> block
  // Non-greedy match avoids backtracking issues
  const articleRe = /<article[^>]*class="skill-card"[^>]*data-name="([^"]*)"[^>]*data-owner="([^"]*)"[^>]*>([\s\S]*?)<\/article>/g

  let match: RegExpExecArray | null
  while ((match = articleRe.exec(html)) !== null) {
    const name = match[1]
    const owner = match[2]
    const body = match[3]

    if (!name || !owner) continue

    // Extract description from <p class="desc">...</p>
    const descMatch = /<p[^>]*class="desc"[^>]*>([^<]*)<\/p>/.exec(body)
    const description = descMatch ? descMatch[1].trim() : ""

    // Extract installs from <span class="installs">12,453</span>
    const installsMatch = /<span[^>]*class="installs"[^>]*>([^<]*)<\/span>/.exec(body)
    const installsStr = installsMatch ? installsMatch[1].trim() : ""
    const installs = installsStr
      ? parseInt(installsStr.replace(/,/g, ""), 10) || undefined
      : undefined

    skills.push({
      name,
      owner,
      source: "skills.sh",
      description,
      installs,
      installCmd: `npx skills add ${owner}/${name}`,
      detailUrl: `https://skills.sh/${owner}/${name}`,
      installed: false,
    })
  }

  return skills
}
