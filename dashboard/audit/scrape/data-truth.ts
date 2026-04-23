/**
 * audit/scrape/data-truth.ts — Phase 15 Cap.6.
 *
 * Shared helper: given a Playwright Page-like object, walk every
 * `[data-truth]` element and return its key/value/tag. Extracted from
 * runner.spec.ts so the clickwalker can call the same routine for pre-
 * and post-click snapshots.
 *
 * Typed against a structural subset of Playwright's Page so tests can
 * pass a plain object with just the methods we actually use — no real
 * browser required.
 */

export interface TruthRow {
  key: string | null
  value: string | null
  tag: string
}

export interface PageTruthAccess {
  locator(selector: string): {
    evaluateAll<T>(
      fn: (elements: Element[]) => T,
      arg?: unknown,
    ): Promise<T>
  }
}

export async function extractTruth(page: PageTruthAccess): Promise<TruthRow[]> {
  return page
    .locator("[data-truth]")
    .evaluateAll<TruthRow[]>((els) =>
      els.map((e) => ({
        key: e.getAttribute("data-truth"),
        value: e.textContent?.trim() ?? null,
        tag: e.tagName.toLowerCase(),
      })),
    )
    .catch(() => [] as TruthRow[])
}

/** Convenience: reduce TruthRow[] to the string key → string value map. */
export function truthAsMap(rows: TruthRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) {
    if (r.key && typeof r.key === "string") out[r.key] = r.value ?? ""
  }
  return out
}
