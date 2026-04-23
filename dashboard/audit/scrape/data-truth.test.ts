// @vitest-environment node
/**
 * audit/scrape/data-truth.test.ts — Phase 15 Cap.6.
 *
 * Stub Page with a minimal locator().evaluateAll() so we can exercise
 * extractTruth + truthAsMap without booting a browser.
 */
import { describe, expect, it } from "vitest"
import { extractTruth, truthAsMap, type PageTruthAccess } from "./data-truth"

function stubPage(rows: Array<{ key: string | null; value: string | null; tag: string }>): PageTruthAccess {
  return {
    locator() {
      return {
        async evaluateAll<T>(): Promise<T> {
          return rows as unknown as T
        },
      }
    },
  }
}

describe("extractTruth", () => {
  it("returns rows from the stub page", async () => {
    const rows = [
      { key: "a", value: "1", tag: "span" },
      { key: "b", value: "2", tag: "div" },
    ]
    const out = await extractTruth(stubPage(rows))
    expect(out).toEqual(rows)
  })

  it("returns [] when page throws", async () => {
    const page: PageTruthAccess = {
      locator() {
        return {
          async evaluateAll<T>(): Promise<T> {
            throw new Error("boom")
          },
        }
      },
    }
    const out = await extractTruth(page)
    expect(out).toEqual([])
  })
})

describe("truthAsMap", () => {
  it("projects rows to a key→value map, skipping null keys", () => {
    const m = truthAsMap([
      { key: "a", value: "1", tag: "span" },
      { key: null, value: "?", tag: "span" },
      { key: "b", value: null, tag: "div" },
    ])
    expect(m).toEqual({ a: "1", b: "" })
  })
})
