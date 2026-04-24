/**
 * cae-mission-control-state.test.ts — unit tests for the Mission Control
 * aggregator (Phase 15 Wave 3.1).
 *
 * Coverage:
 *   1. Empty: missing files -> empty zero-shape with last_event_at=null.
 *   2. Three forge_begin without forge_end in last 5 min -> active_count=3.
 *   3. forge_end inside the window decrements (only "begin" entries count).
 *   4. token_usage events sum raw input+output tokens (no USD).
 *   5. tokens_today accumulates across the full UTC day.
 *   6. Sparkline buckets last 60 seconds at 1s resolution, aligned.
 *   7. since-you-left: first visit -> show=false; >1h gap -> show=true with
 *      counts; recent visit -> show=false.
 *   8. Process-level cache returns same projection within TTL.
 *   9. Last-seen file is created on the first call when touchLastSeen=true.
 *  10. tokens_burn_7d sums token_usage events inside the 7-day window only
 *      (events older than 7 days are excluded).
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  __resetMissionControlCache,
  emptyMissionControl,
  getMissionControlState,
} from "./cae-mission-control-state"

let tmpDir: string
const NOW = Date.parse("2026-04-23T12:00:00Z")

function tsAgo(ms: number): string {
  return new Date(NOW - ms).toISOString()
}

function writeLines(path: string, lines: string[]): void {
  writeFileSync(path, lines.join("\n") + (lines.length > 0 ? "\n" : ""), "utf8")
}

function paths() {
  const cb = join(tmpDir, "cb.jsonl")
  const tools = join(tmpDir, "tools.jsonl")
  const lastSeen = join(tmpDir, "sessions", "last-seen.json")
  return { cb, tools, lastSeen }
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cae-mc-test-"))
  __resetMissionControlCache()
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("getMissionControlState", () => {
  it("1. missing files -> zero shape with last_event_at=null", async () => {
    const p = paths()
    const data = await getMissionControlState({
      cbPath: p.cb,
      toolsPath: p.tools,
      lastSeenPath: p.lastSeen,
      now: NOW,
      noCache: true,
      touchLastSeen: false,
    })
    expect(data.active_count).toBe(0)
    expect(data.tokens_burn_7d).toBe(0)
    expect(data.tokens_today).toBe(0)
    expect(data.sparkline_60s).toHaveLength(60)
    expect(data.sparkline_60s.every((b) => b.count === 0)).toBe(true)
    expect(data.since_you_left.show).toBe(false)
    expect(data.last_event_at).toBeNull()
  })

  it("2. three forge_begin without forge_end -> active_count=3", async () => {
    const p = paths()
    writeLines(p.cb, [
      JSON.stringify({ ts: tsAgo(60_000), event: "forge_begin", task_id: "t-1" }),
      JSON.stringify({ ts: tsAgo(50_000), event: "forge_begin", task_id: "t-2" }),
      JSON.stringify({ ts: tsAgo(40_000), event: "forge_begin", task_id: "t-3" }),
    ])
    writeLines(p.tools, [])
    const data = await getMissionControlState({
      cbPath: p.cb,
      toolsPath: p.tools,
      lastSeenPath: p.lastSeen,
      now: NOW,
      noCache: true,
      touchLastSeen: false,
    })
    expect(data.active_count).toBe(3)
  })

  it("3. forge_end with same task_id later cancels active count", async () => {
    const p = paths()
    writeLines(p.cb, [
      JSON.stringify({ ts: tsAgo(120_000), event: "forge_begin", task_id: "t-A" }),
      JSON.stringify({ ts: tsAgo(60_000),  event: "forge_end",   task_id: "t-A" }),
      JSON.stringify({ ts: tsAgo(50_000),  event: "forge_begin", task_id: "t-B" }),
    ])
    writeLines(p.tools, [])
    const data = await getMissionControlState({
      cbPath: p.cb,
      toolsPath: p.tools,
      lastSeenPath: p.lastSeen,
      now: NOW,
      noCache: true,
      touchLastSeen: false,
    })
    expect(data.active_count).toBe(1)
  })

  it("4. token_usage events sum raw input+output tokens (no USD math)", async () => {
    const p = paths()
    // 1.2M input + 800k output = 2.0M total tokens — burn (last 7d) and
    // today (since UTC midnight) both include this event.
    writeLines(p.cb, [
      JSON.stringify({
        ts: tsAgo(30_000),
        event: "token_usage",
        input_tokens: 1_200_000,
        output_tokens: 800_000,
        model: "claude-sonnet-4-6",
      }),
    ])
    writeLines(p.tools, [])
    const data = await getMissionControlState({
      cbPath: p.cb,
      toolsPath: p.tools,
      lastSeenPath: p.lastSeen,
      now: NOW,
      noCache: true,
      touchLastSeen: false,
    })
    expect(data.tokens_burn_7d).toBe(2_000_000)
    expect(data.tokens_today).toBe(2_000_000)
    // Integer sum, not a fractional USD amount.
    expect(Number.isInteger(data.tokens_burn_7d)).toBe(true)
    expect(Number.isInteger(data.tokens_today)).toBe(true)
  })

  it("5. tokens_today accumulates across the full UTC day", async () => {
    const p = paths()
    // Two token_usage events earlier today — one near midnight, one 10m ago,
    // one 30s ago. All three fall inside both the 7-day burn window and the
    // today window.
    writeLines(p.cb, [
      JSON.stringify({
        ts: tsAgo(11 * 60 * 60 * 1000 + 30 * 60 * 1000), // 11.5h ago
        event: "token_usage",
        input_tokens: 300_000,
        output_tokens: 100_000,
      }),
      JSON.stringify({
        ts: tsAgo(10 * 60 * 1000), // 10m ago
        event: "token_usage",
        input_tokens: 50_000,
        output_tokens: 25_000,
      }),
      JSON.stringify({
        ts: tsAgo(30_000),
        event: "token_usage",
        input_tokens: 10_000,
        output_tokens: 5_000,
      }),
    ])
    writeLines(p.tools, [])
    const data = await getMissionControlState({
      cbPath: p.cb,
      toolsPath: p.tools,
      lastSeenPath: p.lastSeen,
      now: NOW,
      noCache: true,
      touchLastSeen: false,
    })
    // tokens_today = 400k + 75k + 15k = 490k
    expect(data.tokens_today).toBe(490_000)
    // 7-day burn window includes all three events = 490k total
    expect(data.tokens_burn_7d).toBe(490_000)
  })

  it("6. sparkline has 60 1s buckets, populated where events fall", async () => {
    const p = paths()
    // 5 events spread across the last 30 seconds. Offset by 500ms so the
    // first event doesn't land exactly on the window's upper bound, which
    // uses a half-open `[start, end)` range (ts === now is excluded).
    const lines: string[] = []
    for (let i = 0; i < 5; i++) {
      lines.push(
        JSON.stringify({
          ts: tsAgo(i * 5_000 + 500), // 0.5s, 5.5s, 10.5s, 15.5s, 20.5s ago
          task: "t",
          tool: "Bash",
          cwd: "/",
        }),
      )
    }
    writeLines(p.tools, lines)
    writeLines(p.cb, [])

    const data = await getMissionControlState({
      cbPath: p.cb,
      toolsPath: p.tools,
      lastSeenPath: p.lastSeen,
      now: NOW,
      noCache: true,
      touchLastSeen: false,
    })
    expect(data.sparkline_60s).toHaveLength(60)
    const total = data.sparkline_60s.reduce((s, b) => s + b.count, 0)
    expect(total).toBe(5)
  })

  it("7a. since-you-left: first visit -> show=false", async () => {
    const p = paths()
    writeLines(p.cb, [])
    writeLines(p.tools, [])
    const data = await getMissionControlState({
      cbPath: p.cb,
      toolsPath: p.tools,
      lastSeenPath: p.lastSeen,
      now: NOW,
      noCache: true,
      touchLastSeen: false,
    })
    expect(data.since_you_left.show).toBe(false)
    expect(data.since_you_left.last_seen_at).toBeNull()
  })

  it("7b. since-you-left: >1h gap -> show=true with counts", async () => {
    const p = paths()
    // Pre-seed last-seen 2 hours ago (handle missing dir)
    const lastSeenDir = join(tmpDir, "sessions")
    require("node:fs").mkdirSync(lastSeenDir, { recursive: true })
    writeFileSync(p.lastSeen, JSON.stringify({ last_seen_at: NOW - 2 * 60 * 60 * 1000 }), "utf8")

    // Two tool events between previous visit and now
    writeLines(p.tools, [
      JSON.stringify({ ts: tsAgo(60 * 60 * 1000), task: "t-1", tool: "Bash", cwd: "/" }),
      JSON.stringify({ ts: tsAgo(30 * 60 * 1000), task: "t-2", tool: "Edit", cwd: "/" }),
    ])
    // One token-usage event = 1.5M tokens (1M input + 500k output)
    writeLines(p.cb, [
      JSON.stringify({
        ts: tsAgo(45 * 60 * 1000),
        event: "token_usage",
        input_tokens: 1_000_000,
        output_tokens: 500_000,
      }),
    ])

    const data = await getMissionControlState({
      cbPath: p.cb,
      toolsPath: p.tools,
      lastSeenPath: p.lastSeen,
      now: NOW,
      noCache: true,
      touchLastSeen: false,
    })
    expect(data.since_you_left.show).toBe(true)
    expect(data.since_you_left.tool_calls_since).toBe(2)
    expect(data.since_you_left.tasks_touched).toBe(2)
    expect(data.since_you_left.tokens_since).toBe(1_500_000)
  })

  it("7c. since-you-left: recent visit (<1h) -> show=false", async () => {
    const p = paths()
    require("node:fs").mkdirSync(join(tmpDir, "sessions"), { recursive: true })
    writeFileSync(p.lastSeen, JSON.stringify({ last_seen_at: NOW - 30 * 60 * 1000 }), "utf8")
    writeLines(p.cb, [])
    writeLines(p.tools, [])
    const data = await getMissionControlState({
      cbPath: p.cb,
      toolsPath: p.tools,
      lastSeenPath: p.lastSeen,
      now: NOW,
      noCache: true,
      touchLastSeen: false,
    })
    expect(data.since_you_left.show).toBe(false)
  })

  it("8. process-level cache returns same projection within TTL", async () => {
    const p = paths()
    writeLines(p.cb, [
      JSON.stringify({ ts: tsAgo(30_000), event: "forge_begin", task_id: "t-1" }),
    ])
    writeLines(p.tools, [])
    const a = await getMissionControlState({
      cbPath: p.cb,
      toolsPath: p.tools,
      lastSeenPath: p.lastSeen,
      now: NOW,
      touchLastSeen: false,
    })
    // Mutate underlying file — cached response must ignore.
    writeLines(p.cb, [
      JSON.stringify({ ts: tsAgo(60_000), event: "forge_begin", task_id: "t-1" }),
      JSON.stringify({ ts: tsAgo(30_000), event: "forge_begin", task_id: "t-2" }),
    ])
    const b = await getMissionControlState({
      cbPath: p.cb,
      toolsPath: p.tools,
      lastSeenPath: p.lastSeen,
      now: NOW + 1_000,
      touchLastSeen: false,
    })
    expect(b.active_count).toBe(a.active_count)
  })

  it("9. last-seen file is created on first call when touchLastSeen=true", async () => {
    const p = paths()
    writeLines(p.cb, [])
    writeLines(p.tools, [])
    expect(existsSync(p.lastSeen)).toBe(false)
    await getMissionControlState({
      cbPath: p.cb,
      toolsPath: p.tools,
      lastSeenPath: p.lastSeen,
      now: NOW,
      noCache: true,
      touchLastSeen: true,
    })
    // The write is fire-and-forget (void writeLastSeen().catch()) — the real
    // mkdir+writeFile chain takes >1 macrotask on slow disks and the file
    // can briefly exist as zero-byte before content lands. Poll for
    // "parses as our shape" up to 500ms.
    let body: { last_seen_at?: number } | null = null
    const deadline = Date.now() + 500
    while (Date.now() < deadline) {
      if (existsSync(p.lastSeen)) {
        const raw = readFileSync(p.lastSeen, "utf8")
        if (raw.length > 0) {
          try {
            body = JSON.parse(raw)
            if (typeof body?.last_seen_at === "number") break
          } catch {
            // zero-byte or partial — keep polling
          }
        }
      }
      await new Promise<void>((resolve) => setImmediate(resolve))
    }
    expect(existsSync(p.lastSeen)).toBe(true)
    expect(body?.last_seen_at).toBe(NOW)
  })

  it("10. tokens_burn_7d sums events inside the 7-day window only", async () => {
    const p = paths()
    const ONE_MIN = 60_000
    const ONE_DAY = 24 * 60 * ONE_MIN
    // Three token_usage events:
    //   - 10 minutes ago  -> inside 7d window, inside today  (100k tok)
    //   - 5 days ago      -> inside 7d window, NOT today     (200k tok)
    //   - 8 days ago      -> OUTSIDE 7d window               (999k tok, should be excluded)
    writeLines(p.cb, [
      JSON.stringify({
        ts: new Date(NOW - 8 * ONE_DAY).toISOString(),
        event: "token_usage",
        input_tokens: 500_000,
        output_tokens: 499_000,
      }),
      JSON.stringify({
        ts: new Date(NOW - 5 * ONE_DAY).toISOString(),
        event: "token_usage",
        input_tokens: 120_000,
        output_tokens: 80_000,
      }),
      JSON.stringify({
        ts: new Date(NOW - 10 * ONE_MIN).toISOString(),
        event: "token_usage",
        input_tokens: 60_000,
        output_tokens: 40_000,
      }),
    ])
    writeLines(p.tools, [])
    const data = await getMissionControlState({
      cbPath: p.cb,
      toolsPath: p.tools,
      lastSeenPath: p.lastSeen,
      now: NOW,
      noCache: true,
      touchLastSeen: false,
    })
    // 10m-ago (100k) + 5d-ago (200k) = 300k; 8d-ago (999k) excluded.
    expect(data.tokens_burn_7d).toBe(300_000)
    // today only captures the 10m-ago event = 100k.
    expect(data.tokens_today).toBe(100_000)
  })
})

describe("emptyMissionControl", () => {
  it("returns 60 sparkline buckets aligned to 1s starting 60s ago", () => {
    const data = emptyMissionControl(NOW)
    expect(data.sparkline_60s).toHaveLength(60)
    const first = data.sparkline_60s[0]
    const last = data.sparkline_60s[data.sparkline_60s.length - 1]
    expect(last.ts - first.ts).toBe(59 * 1000)
  })

  it("returns token-only fields with zeros (no USD fields)", () => {
    const data = emptyMissionControl(NOW)
    expect(data.tokens_burn_7d).toBe(0)
    expect(data.tokens_today).toBe(0)
    expect(data.since_you_left.tokens_since).toBe(0)
    // The old USD fields are gone from the contract.
    expect("token_burn_usd_per_min" in data).toBe(false)
    expect("cost_today_usd" in data).toBe(false)
    expect("daily_budget_usd" in data).toBe(false)
    expect("cost_pct_of_budget" in data).toBe(false)
    expect("usd_since" in data.since_you_left).toBe(false)
  })
})
