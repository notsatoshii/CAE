import type { CatalogSkill } from "./cae-types"

const CLAWHUB_URL = "https://clawhub.ai/skills?sort=downloads"

/**
 * Fetches and parses the ClawHub skills page for skill cards.
 *
 * HTML structure (from fixture):
 *   <article class="skill-card" data-name="..." data-owner="..." data-stars="342">
 *     <h3>owner/name</h3>
 *     <p class="skill-description">description</p>
 *     <span class="star-count">342</span>
 *     <a class="skill-link" href="...">Details</a>
 *   </article>
 *
 * Graceful degradation: non-2xx response → returns [].
 * HTML length capped at 1MB (T-14-02-03).
 */
export async function fetchClawHub(
  q?: string,
  fetchImpl: typeof fetch = fetch
): Promise<CatalogSkill[]> {
  const url = q
    ? `${CLAWHUB_URL}&q=${encodeURIComponent(q)}`
    : CLAWHUB_URL

  let html: string
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) {
      console.warn(`[cae-skills-scrape-clawhub] clawhub.ai returned ${res.status}`)
      return []
    }
    html = await res.text()
    if (html.length > 1_000_000) {
      html = html.slice(0, 1_000_000)
    }
  } catch (err) {
    console.warn(`[cae-skills-scrape-clawhub] fetch error:`, err)
    return []
  }

  return parseClawHubHtml(html)
}

/**
 * Parses skill cards from ClawHub HTML.
 */
function parseClawHubHtml(html: string): CatalogSkill[] {
  const skills: CatalogSkill[] = []

  // Match each skill card — non-backtracking, attribute order-tolerant
  const articleRe = /<article[^>]*class="skill-card"[^>]*data-name="([^"]*)"[^>]*data-owner="([^"]*)"[^>]*data-stars="([^"]*)"[^>]*>([\s\S]*?)<\/article>/g

  let match: RegExpExecArray | null
  while ((match = articleRe.exec(html)) !== null) {
    const name = match[1]
    const owner = match[2]
    const starsStr = match[3]
    const body = match[4]

    if (!name || !owner) continue

    // Extract description from <p class="skill-description">...</p>
    const descMatch = /<p[^>]*class="skill-description"[^>]*>([^<]*)<\/p>/.exec(body)
    const description = descMatch ? descMatch[1].trim() : ""

    const stars = starsStr ? parseInt(starsStr, 10) || undefined : undefined

    skills.push({
      name,
      owner,
      source: "clawhub",
      description,
      stars,
      installCmd: `npx skills add ${owner}/${name}`,
      detailUrl: `https://clawhub.ai/skills/${owner}/${name}`,
      installed: false,
    })
  }

  return skills
}
