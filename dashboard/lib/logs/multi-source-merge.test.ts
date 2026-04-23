/**
 * lib/logs/multi-source-merge.test.ts — Phase 15 Wave 5.1.
 *
 * Coverage:
 *   - parseLogLine: JSON + plain-text + bad-input paths
 *   - mergeLogLines: timestamp-sorted union, stable on ties, dedup
 *   - insertSorted: middle insertion, append fast-path, dedup of tail
 */
import { describe, it, expect } from "vitest"
import {
  parseLogLine,
  mergeLogLines,
  insertSorted,
  type LogLine,
} from "./multi-source-merge"

describe("parseLogLine", () => {
  it("parses pino JSON with numeric level", () => {
    const raw = JSON.stringify({
      level: 30,
      time: Date.parse("2026-04-23T10:00:00Z"),
      name: "api.tail",
      msg: "req.begin",
      url: "/api/tail",
    })
    const out = parseLogLine(raw, "tail")
    expect(out).not.toBeNull()
    expect(out?.level).toBe("info")
    expect(out?.scope).toBe("api.tail")
    expect(out?.msg).toBe("req.begin")
    expect(out?.tsMs).toBe(Date.parse("2026-04-23T10:00:00Z"))
    expect(out?.obj?.url).toBe("/api/tail")
  })

  it("parses tool-call audit JSON (string ts + tool field)", () => {
    const raw = JSON.stringify({
      ts: "2026-04-23T10:00:05Z",
      task: "t-abc",
      tool: "Bash",
      cwd: "/home/cae",
    })
    const out = parseLogLine(raw, "tool")
    expect(out?.ts).toBe("2026-04-23T10:00:05Z")
    expect(out?.scope).toBe("tool.Bash")
    expect(out?.source).toBe("tool")
    // No level field — defaults to info.
    expect(out?.level).toBe("info")
  })

  it("normalises pino numeric levels to enum", () => {
    expect(parseLogLine(JSON.stringify({ level: 50, time: 0 }), "tail")?.level).toBe("error")
    expect(parseLogLine(JSON.stringify({ level: 40, time: 0 }), "tail")?.level).toBe("warn")
    expect(parseLogLine(JSON.stringify({ level: 60, time: 0 }), "tail")?.level).toBe("fatal")
    expect(parseLogLine(JSON.stringify({ level: 20, time: 0 }), "tail")?.level).toBe("debug")
  })

  it("parses plain-text with leading ISO timestamp", () => {
    const raw = "2026-04-23T10:00:10Z ERROR something exploded"
    const out = parseLogLine(raw, "tail")
    expect(out?.tsMs).toBe(Date.parse("2026-04-23T10:00:10Z"))
    expect(out?.level).toBe("error")
    expect(out?.raw).toBe(raw)
  })

  it("returns null for empty/whitespace input", () => {
    expect(parseLogLine("", "tail")).toBeNull()
    expect(parseLogLine("   \n\t", "tail")).toBeNull()
  })

  it("falls back to receivedAt when input has no timestamp", () => {
    const fixedNow = Date.parse("2026-04-23T12:00:00Z")
    const out = parseLogLine("plain message no ts", "tail", fixedNow)
    expect(out?.tsMs).toBe(fixedNow)
    expect(out?.level).toBe("info")
  })

  it("handles invalid JSON gracefully (falls through to text)", () => {
    const raw = '{"broken": '
    const out = parseLogLine(raw, "tail", 1000)
    expect(out).not.toBeNull()
    expect(out?.tsMs).toBe(1000)
  })
})

describe("mergeLogLines", () => {
  function L(ts: string, source: LogLine["source"], raw = `r-${ts}`): LogLine {
    return {
      ts,
      tsMs: Date.parse(ts),
      source,
      level: "info",
      raw,
    }
  }

  it("merges three buckets in timestamp order", () => {
    const a = [L("2026-04-23T10:00:00Z", "tail"), L("2026-04-23T10:00:10Z", "tail")]
    const b = [L("2026-04-23T10:00:05Z", "audit")]
    const c = [L("2026-04-23T10:00:02Z", "tool")]
    const out = mergeLogLines([a, b, c])
    expect(out.map((l) => l.ts)).toEqual([
      "2026-04-23T10:00:00Z",
      "2026-04-23T10:00:02Z",
      "2026-04-23T10:00:05Z",
      "2026-04-23T10:00:10Z",
    ])
  })

  it("is stable on tsMs ties (preserves bucket-then-insertion order)", () => {
    const a = [L("2026-04-23T10:00:00Z", "tail", "A1"), L("2026-04-23T10:00:00Z", "tail", "A2")]
    const b = [L("2026-04-23T10:00:00Z", "audit", "B1")]
    const out = mergeLogLines([a, b])
    expect(out.map((l) => l.raw)).toEqual(["A1", "A2", "B1"])
  })

  it("dedups identical (tsMs + source + raw) tuples", () => {
    const a = [L("2026-04-23T10:00:00Z", "tail", "same")]
    const b = [L("2026-04-23T10:00:00Z", "tail", "same")]
    const out = mergeLogLines([a, b])
    expect(out).toHaveLength(1)
  })

  it("does NOT dedup when raw differs", () => {
    const a = [L("2026-04-23T10:00:00Z", "tail", "x")]
    const b = [L("2026-04-23T10:00:00Z", "tail", "y")]
    expect(mergeLogLines([a, b])).toHaveLength(2)
  })

  it("does NOT dedup across sources", () => {
    const a = [L("2026-04-23T10:00:00Z", "tail", "shared")]
    const b = [L("2026-04-23T10:00:00Z", "audit", "shared")]
    expect(mergeLogLines([a, b])).toHaveLength(2)
  })
})

describe("insertSorted", () => {
  function L(ts: string, raw = `r-${ts}`): LogLine {
    return {
      ts,
      tsMs: Date.parse(ts),
      source: "tail",
      level: "info",
      raw,
    }
  }

  it("appends when newer than tail (fast path)", () => {
    const buf = [L("2026-04-23T10:00:00Z"), L("2026-04-23T10:00:05Z")]
    const out = insertSorted(buf, L("2026-04-23T10:00:10Z"))
    expect(out).toHaveLength(3)
    expect(out[2].ts).toBe("2026-04-23T10:00:10Z")
    // Original buffer untouched (immutable).
    expect(buf).toHaveLength(2)
  })

  it("inserts in middle while keeping sort order", () => {
    const buf = [L("2026-04-23T10:00:00Z"), L("2026-04-23T10:00:10Z")]
    const out = insertSorted(buf, L("2026-04-23T10:00:05Z"))
    expect(out.map((l) => l.ts)).toEqual([
      "2026-04-23T10:00:00Z",
      "2026-04-23T10:00:05Z",
      "2026-04-23T10:00:10Z",
    ])
  })

  it("dedups against the tail (watcher double-fire)", () => {
    const buf = [L("2026-04-23T10:00:00Z"), L("2026-04-23T10:00:05Z", "dup")]
    const out = insertSorted(buf, L("2026-04-23T10:00:05Z", "dup"))
    expect(out).toBe(buf) // returns same reference when no change
  })

  it("inserts into empty buffer", () => {
    const out = insertSorted([], L("2026-04-23T10:00:00Z"))
    expect(out).toHaveLength(1)
  })
})
