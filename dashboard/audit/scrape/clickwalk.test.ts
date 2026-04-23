// @vitest-environment node
/**
 * audit/scrape/clickwalk.test.ts — Phase 15 Cap.6.
 *
 * Mock Page with just the methods clickwalk calls. Exercises the skip
 * filters (destructive / logout / external), the truth-diff logic, and
 * the 30-element hard cap.
 */
import { describe, expect, it } from "vitest"
import { clickwalkRoute, type ClickwalkPage, type Interactable } from "./clickwalk"
import type { TruthRow } from "./data-truth"

interface StubOpts {
  interactables: Interactable[]
  /**
   * Sequence of `truth` rows returned by successive extractTruth() calls.
   * If the array runs short, the last entry is reused.
   */
  truthSequence?: TruthRow[][]
  /** URL sequence returned by url() — mirrors click progression. */
  urlSequence?: string[]
  /** Click throws on selectors matching this regex. */
  clickFail?: RegExp
}

function stubPage(opts: StubOpts): ClickwalkPage {
  let truthIdx = 0
  let urlIdx = 0
  const nextTruth = (): TruthRow[] => {
    const seq = opts.truthSequence ?? [[]]
    const row = seq[Math.min(truthIdx, seq.length - 1)] ?? []
    truthIdx++
    return row
  }
  const nextUrl = (): string => {
    const seq = opts.urlSequence ?? ["http://x/test"]
    const u = seq[Math.min(urlIdx, seq.length - 1)] ?? "http://x/test"
    urlIdx++
    return u
  }
  return {
    url: () => nextUrl(),
    async goto() {},
    async waitForLoadState() {},
    async evaluate<T>(): Promise<T> {
      return opts.interactables as unknown as T
    },
    async click(selector: string) {
      if (opts.clickFail && opts.clickFail.test(selector)) {
        throw new Error("click failed")
      }
    },
    locator() {
      return {
        async evaluateAll<T>(): Promise<T> {
          return nextTruth() as unknown as T
        },
      }
    },
  }
}

describe("clickwalkRoute", () => {
  it("skips destructive, logout, and external elements", async () => {
    const page = stubPage({
      interactables: [
        { selector: "#a", text: "Delete project", href: null },
        { selector: "#b", text: "Sign out", href: null },
        { selector: "#c", text: "Docs", href: "https://external.example" },
        { selector: "#d", text: "Open panel", href: null },
      ],
      truthSequence: [
        [{ key: "x", value: "before", tag: "span" }],
        [{ key: "x", value: "after", tag: "span" }],
      ],
      urlSequence: ["http://x/test", "http://x/test", "http://x/test", "http://x/test"],
    })
    const r = await clickwalkRoute(page, { path: "/test", slug: "test" })
    expect(r.skipped).toBe(3)
    expect(r.visited).toBe(1)
    expect(r.steps[0].selector).toBe("#d")
    expect(r.steps[0].truthDelta).toEqual({
      x: { before: "before", after: "after" },
    })
  })

  it("caps at 30 elements per route", async () => {
    const interactables: Interactable[] = Array.from(
      { length: 50 },
      (_, i) => ({ selector: `#btn-${i}`, text: `Click ${i}`, href: null }),
    )
    const page = stubPage({
      interactables,
      truthSequence: [[]], // always empty → no delta
      urlSequence: Array(200).fill("http://x/test"),
    })
    const r = await clickwalkRoute(page, { path: "/test", slug: "test" })
    expect(r.visited).toBe(30)
    expect(r.steps.length).toBe(30)
  })

  it("records errorIfAny when click throws", async () => {
    const page = stubPage({
      interactables: [
        { selector: "#broken", text: "Broken", href: null },
      ],
      truthSequence: [[]],
      urlSequence: ["http://x/test", "http://x/test"],
      clickFail: /broken/,
    })
    const r = await clickwalkRoute(page, { path: "/test", slug: "test" })
    expect(r.visited).toBe(1)
    expect(r.steps[0].errorIfAny).toMatch(/click failed/)
  })

  it("captures URL change when click navigates", async () => {
    const page = stubPage({
      interactables: [
        { selector: "#go", text: "Go somewhere", href: null },
      ],
      truthSequence: [[], []],
      // pre=old, post=new — clickwalk treats this as navigation.
      urlSequence: ["http://x/test", "http://x/other"],
    })
    const r = await clickwalkRoute(page, { path: "/test", slug: "test" })
    expect(r.steps[0].preUrl).toBe("http://x/test")
    expect(r.steps[0].postUrl).toBe("http://x/other")
  })
})
