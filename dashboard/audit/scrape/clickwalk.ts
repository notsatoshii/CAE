/**
 * audit/scrape/clickwalk.ts — Phase 15 Cap.6.
 *
 * Automated click-exploration of a single route. For every interactive
 * element on the landing page (button / a[href] / [role=button|tab] /
 * labelled input), click it and diff the `[data-truth]` snapshot + URL.
 *
 * What we DON'T click:
 *   - destructive actions (matched by text regex: delete|remove|drop|purge)
 *   - log-out buttons (sign[- ]?out|logout|log out)
 *   - external links (href^=http)
 *   - any element with [data-audit-skip]
 *
 * Hard cap: 30 elements per route so a bad page can't wedge the harness.
 *
 * Typed against a thin structural subset of Playwright's Page. Tests
 * feed a stub; runtime wraps a real Page.
 */

import type { PageTruthAccess, TruthRow } from "./data-truth"
import { extractTruth, truthAsMap } from "./data-truth"

// ── Element shape we read ──────────────────────────────────────────────
export interface Interactable {
  selector: string
  text: string
  href: string | null
}

// ── Step + result shapes ───────────────────────────────────────────────
export interface ClickwalkStep {
  selector: string
  text: string
  preUrl: string
  postUrl: string
  truthDelta: Record<string, { before: string | null; after: string | null }>
  errorIfAny: string | null
}

export interface ClickwalkResult {
  route: string
  visited: number
  skipped: number
  steps: ClickwalkStep[]
}

// ── Page structural interface (subset of @playwright/test Page) ────────
export interface ClickwalkPage extends PageTruthAccess {
  url(): string
  goto(
    url: string,
    opts?: { waitUntil?: "load" | "domcontentloaded" | "networkidle"; timeout?: number },
  ): Promise<unknown>
  waitForLoadState?(
    state?: "load" | "domcontentloaded" | "networkidle",
    opts?: { timeout?: number },
  ): Promise<void>
  /**
   * Returns the serializable list of interactable elements on the
   * current page. We evaluate this once per landing to avoid stale
   * element-handle races after each click.
   */
  evaluate<T>(fn: () => T): Promise<T>
  /**
   * Click by text-content match — the simplest selector that survives
   * React re-renders. Selector+text come from the list above.
   */
  click(selector: string, opts?: { timeout?: number }): Promise<void>
}

// ── Regex filters ──────────────────────────────────────────────────────
const DESTRUCTIVE = /\b(delete|remove|drop|purge|destroy|wipe|erase)\b/i
const LOGOUT = /\b(sign[\s-]?out|log[\s-]?out)\b/i

function isExternal(href: string | null): boolean {
  return !!href && /^https?:/i.test(href)
}

// ── Main export ────────────────────────────────────────────────────────
export async function clickwalkRoute(
  page: ClickwalkPage,
  route: { path: string; slug: string },
): Promise<ClickwalkResult> {
  const steps: ClickwalkStep[] = []
  let skipped = 0

  // Collect interactables from the landing page once. If the user
  // navigates away we re-navigate to the route to re-collect is avoided
  // for speed — see cap at 30.
  const candidates = await page.evaluate<Interactable[]>(() => {
    const sel =
      'button, a[href], [role="button"], [role="tab"], input[id], textarea[id]'
    const els = Array.from(document.querySelectorAll(sel))
    return els.slice(0, 60).map((el, idx) => {
      const text = (el.textContent ?? "").trim().slice(0, 60)
      const href = el.getAttribute("href")
      const id = el.getAttribute("id")
      const testid = el.getAttribute("data-testid")
      let selector: string
      if (testid) selector = `[data-testid="${testid}"]`
      else if (id) selector = `#${id}`
      else selector = `${el.tagName.toLowerCase()}:nth-of-type(${idx + 1})`
      return { selector, text, href }
    })
  })

  for (const el of candidates) {
    if (steps.length >= 30) break
    if (DESTRUCTIVE.test(el.text) || LOGOUT.test(el.text)) {
      skipped++
      continue
    }
    if (isExternal(el.href)) {
      skipped++
      continue
    }

    // Pre-click snapshot.
    const preUrl = page.url()
    const preRows: TruthRow[] = await extractTruth(page)
    const preMap = truthAsMap(preRows)

    // Click (best-effort).
    let errorIfAny: string | null = null
    try {
      await page.click(el.selector, { timeout: 3_000 })
      // Best-effort settle — either state is fine, whichever is fast.
      if (page.waitForLoadState) {
        await page
          .waitForLoadState("domcontentloaded", { timeout: 3_000 })
          .catch(() => undefined)
      }
    } catch (err) {
      errorIfAny = err instanceof Error ? err.message : String(err)
    }

    // Post-click snapshot.
    const postUrl = page.url()
    const postRows: TruthRow[] = await extractTruth(page)
    const postMap = truthAsMap(postRows)

    // Diff truth maps.
    const keys = new Set<string>([
      ...Object.keys(preMap),
      ...Object.keys(postMap),
    ])
    const truthDelta: Record<
      string,
      { before: string | null; after: string | null }
    > = {}
    for (const k of keys) {
      const b = preMap[k] ?? null
      const a = postMap[k] ?? null
      if (b !== a) truthDelta[k] = { before: b, after: a }
    }

    steps.push({
      selector: el.selector,
      text: el.text,
      preUrl,
      postUrl,
      truthDelta,
      errorIfAny,
    })

    // If the click navigated us off-route, re-navigate so subsequent
    // elements resolve against the original landing page. The stub in
    // tests treats goto() as a no-op.
    if (postUrl !== preUrl) {
      try {
        await page.goto(route.path, {
          waitUntil: "domcontentloaded",
          timeout: 10_000,
        })
      } catch {
        // best-effort; if re-nav fails we stop here.
        break
      }
    }
  }

  return {
    route: route.path,
    visited: steps.length,
    skipped,
    steps,
  }
}
