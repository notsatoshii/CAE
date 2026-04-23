/**
 * cae-activity-state.test.ts — unit tests for the live-activity projection.
 *
 * Coverage:
 *   1. Missing file → empty-zero shape (last_event_at=null).
 *   2. Empty file → empty-zero shape.
 *   3. One event in last 60s → tools_per_min_now=1, most_frequent_tool set,
 *      last_24h_count=1, last_event_at populated.
 *   4. 100 events spanning 30 minutes → sparkline distribution non-zero,
 *      breakdown sums to 5-minute count.
 *   5. Malformed lines (bad JSON, missing fields) silently dropped.
 *   6. Process-level cache returns same object on repeat call within TTL.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  __resetActivityCache,
  emptyActivity,
  getLiveActivity,
} from "./cae-activity-state"

let tmpDir: string

const NOW = Date.parse("2026-04-23T12:00:00Z")

function tsAgo(ms: number): string {
  return new Date(NOW - ms).toISOString()
}

function writeJsonl(lines: string[]): string {
  const path = join(tmpDir, "tool-calls.jsonl")
  writeFileSync(path, lines.join("\n") + (lines.length > 0 ? "\n" : ""), "utf8")
  return path
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cae-activity-test-"))
  __resetActivityCache()
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("getLiveActivity", () => {
  it("missing file → empty zero-shape with last_event_at=null", async () => {
    const data = await getLiveActivity({
      filePath: join(tmpDir, "does-not-exist.jsonl"),
      now: NOW,
      noCache: true,
    })
    expect(data.tools_per_min_now).toBe(0)
    expect(data.most_frequent_tool).toBeNull()
    expect(data.last_24h_count).toBe(0)
    expect(data.last_event_at).toBeNull()
    expect(data.sparkline).toHaveLength(30)
    expect(data.sparkline.every((b) => b.count === 0)).toBe(true)
    expect(data.tool_breakdown_5m).toEqual({})
  })

  it("empty file → same empty zero-shape", async () => {
    const path = writeJsonl([])
    const data = await getLiveActivity({ filePath: path, now: NOW, noCache: true })
    expect(data.tools_per_min_now).toBe(0)
    expect(data.last_event_at).toBeNull()
  })

  it("one event in last 60s → tools_per_min_now=1, most_frequent_tool set", async () => {
    const path = writeJsonl([
      JSON.stringify({
        ts: tsAgo(10_000), // 10s ago
        task: "t-test",
        tool: "Bash",
        cwd: "/tmp",
      }),
    ])
    const data = await getLiveActivity({ filePath: path, now: NOW, noCache: true })
    expect(data.tools_per_min_now).toBe(1)
    expect(data.most_frequent_tool).toBe("Bash")
    expect(data.last_24h_count).toBe(1)
    expect(data.last_event_at).toBe(NOW - 10_000)
    expect(data.tool_breakdown_5m.Bash).toBe(1)
    // Sparkline last bucket should contain the event
    const lastBucket = data.sparkline[data.sparkline.length - 1]
    expect(lastBucket.count).toBeGreaterThanOrEqual(1)
  })

  it("100 events spanning 30 minutes → sparkline distributes, breakdown sums right", async () => {
    const lines: string[] = []
    // 100 events, evenly spaced over the last 30 minutes (1 every 18s).
    // Tool kind cycles Bash → Edit → Read → Write → Agent → Task.
    const tools = ["Bash", "Edit", "Read", "Write", "Agent", "Task"]
    for (let i = 0; i < 100; i++) {
      lines.push(
        JSON.stringify({
          ts: tsAgo(i * 18_000),
          task: "t-load",
          tool: tools[i % tools.length],
          cwd: "/tmp",
        }),
      )
    }
    const path = writeJsonl(lines)
    const data = await getLiveActivity({ filePath: path, now: NOW, noCache: true })

    expect(data.last_24h_count).toBe(100)
    expect(data.last_event_at).toBe(NOW)

    // Sparkline should have non-zero buckets distributed across the window.
    const nonZeroBuckets = data.sparkline.filter((b) => b.count > 0).length
    expect(nonZeroBuckets).toBeGreaterThan(10)
    const sparklineTotal = data.sparkline.reduce((sum, b) => sum + b.count, 0)
    // Every event in the last 30 min should be plotted (allow 1 boundary slip).
    expect(sparklineTotal).toBeGreaterThanOrEqual(99)

    // Breakdown for last 5 minutes — at 18s spacing, 5min holds ~17 events.
    const breakdownTotal = Object.values(data.tool_breakdown_5m).reduce(
      (sum, n) => sum + n,
      0,
    )
    expect(breakdownTotal).toBeGreaterThan(0)
    expect(breakdownTotal).toBeLessThanOrEqual(20)
  })

  it("most_frequent_tool reflects the dominant kind in last 60s", async () => {
    const lines = [
      JSON.stringify({ ts: tsAgo(5_000), task: "t", tool: "Edit", cwd: "/" }),
      JSON.stringify({ ts: tsAgo(10_000), task: "t", tool: "Edit", cwd: "/" }),
      JSON.stringify({ ts: tsAgo(15_000), task: "t", tool: "Edit", cwd: "/" }),
      JSON.stringify({ ts: tsAgo(20_000), task: "t", tool: "Bash", cwd: "/" }),
    ]
    const path = writeJsonl(lines)
    const data = await getLiveActivity({ filePath: path, now: NOW, noCache: true })
    expect(data.tools_per_min_now).toBe(4)
    expect(data.most_frequent_tool).toBe("Edit")
  })

  it("malformed lines silently dropped", async () => {
    const path = writeJsonl([
      "this is not json",
      JSON.stringify({ ts: tsAgo(5_000), task: "t", tool: "Bash", cwd: "/" }),
      JSON.stringify({ ts: "not-a-date", task: "t", tool: "Bash", cwd: "/" }),
      JSON.stringify({ ts: tsAgo(10_000), tool: "" }), // empty tool — drop
      "{",
      JSON.stringify({ ts: tsAgo(15_000), task: "t", tool: "Edit", cwd: "/" }),
    ])
    const data = await getLiveActivity({ filePath: path, now: NOW, noCache: true })
    expect(data.tools_per_min_now).toBe(2)
    expect(data.last_24h_count).toBe(2)
  })

  it("events older than 24h are excluded from last_24h_count", async () => {
    const path = writeJsonl([
      JSON.stringify({ ts: tsAgo(25 * 60 * 60 * 1000), task: "t", tool: "Bash", cwd: "/" }),
      JSON.stringify({ ts: tsAgo(60 * 60 * 1000), task: "t", tool: "Bash", cwd: "/" }),
    ])
    const data = await getLiveActivity({ filePath: path, now: NOW, noCache: true })
    expect(data.last_24h_count).toBe(1)
  })

  it("process-level cache returns same projection within TTL", async () => {
    const path = writeJsonl([
      JSON.stringify({ ts: tsAgo(5_000), task: "t", tool: "Bash", cwd: "/" }),
    ])
    const a = await getLiveActivity({ filePath: path, now: NOW })
    // Mutate the underlying file — cached call should ignore it.
    writeFileSync(
      path,
      JSON.stringify({ ts: tsAgo(1_000), task: "t", tool: "Edit", cwd: "/" }) + "\n",
      "utf8",
    )
    const b = await getLiveActivity({ filePath: path, now: NOW + 1_000 })
    expect(b.tools_per_min_now).toBe(a.tools_per_min_now)
    expect(b.most_frequent_tool).toBe("Bash")
  })

  it("process-level cache expires after TTL", async () => {
    const path = writeJsonl([
      JSON.stringify({ ts: tsAgo(5_000), task: "t", tool: "Bash", cwd: "/" }),
    ])
    await getLiveActivity({ filePath: path, now: NOW })
    writeFileSync(
      path,
      JSON.stringify({ ts: tsAgo(0), task: "t", tool: "Edit", cwd: "/" }) + "\n",
      "utf8",
    )
    // 6 seconds later the cache must have expired.
    const fresh = await getLiveActivity({ filePath: path, now: NOW + 6_000 })
    expect(fresh.most_frequent_tool).toBe("Edit")
  })
})

describe("emptyActivity", () => {
  it("returns 30 buckets aligned to 60s starting 30m ago", () => {
    const data = emptyActivity(NOW)
    expect(data.sparkline).toHaveLength(30)
    expect(data.tools_per_min_now).toBe(0)
    expect(data.most_frequent_tool).toBeNull()
    expect(data.last_24h_count).toBe(0)
    expect(data.last_event_at).toBeNull()
    // First bucket starts ~30 min ago
    const first = data.sparkline[0]
    const last = data.sparkline[data.sparkline.length - 1]
    expect(last.ts - first.ts).toBe(29 * 60_000)
  })
})
