/**
 * cae-activity-feed.test.ts — Class 15A reader.
 *
 * Coverage:
 *   1. Empty / missing streams → []
 *   2. activity.jsonl rows pass through with origin=activity.
 *   3. circuit-breakers.jsonl forge_begin/forge_end translate.
 *   4. Union across streams → sorted ts DESC.
 *   5. Cap at FEED_CAP (500).
 *   6. Malformed rows silently dropped.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { FEED_CAP, getActivityFeed } from "./cae-activity-feed"

let rootDir: string
let metricsDir: string

function writeJsonl(name: string, lines: string[]): string {
  const path = join(metricsDir, name)
  writeFileSync(
    path,
    lines.join("\n") + (lines.length > 0 ? "\n" : ""),
    "utf8",
  )
  return path
}

beforeEach(() => {
  rootDir = mkdtempSync(join(tmpdir(), "cae-activity-feed-"))
  metricsDir = join(rootDir, ".cae", "metrics")
  mkdirSync(metricsDir, { recursive: true })
})

afterEach(() => {
  rmSync(rootDir, { recursive: true, force: true })
})

function paths() {
  return {
    activity: join(metricsDir, "activity.jsonl"),
    circuitBreakers: join(metricsDir, "circuit-breakers.jsonl"),
    heartbeat: join(metricsDir, "heartbeat.jsonl"),
    scheduler: join(metricsDir, "scheduler.jsonl"),
  }
}

describe("getActivityFeed", () => {
  it("returns [] when every stream is missing", async () => {
    const rows = await getActivityFeed({ paths: paths() })
    expect(rows).toEqual([])
  })

  it("passes activity.jsonl rows through with origin=activity", async () => {
    writeJsonl("activity.jsonl", [
      JSON.stringify({
        ts: "2026-04-23T12:00:00Z",
        type: "commit",
        source: "git-post-commit",
        actor: "Eric",
        summary: "abc1234 feat: ship 15",
        meta: { sha: "abc1234" },
      }),
    ])
    const rows = await getActivityFeed({ paths: paths() })
    expect(rows).toHaveLength(1)
    expect(rows[0].origin).toBe("activity")
    expect(rows[0].type).toBe("commit")
    expect(rows[0].summary).toBe("abc1234 feat: ship 15")
  })

  it("translates circuit-breakers rows into the feed shape", async () => {
    writeJsonl("circuit-breakers.jsonl", [
      JSON.stringify({
        ts: "2026-04-23T11:00:00Z",
        event: "forge_begin",
        agent: "forge",
        task_id: "p15-plA-t1",
      }),
      JSON.stringify({
        ts: "2026-04-23T11:05:00Z",
        event: "forge_end",
        agent: "forge",
        task_id: "p15-plA-t1",
        success: true,
      }),
    ])
    const rows = await getActivityFeed({ paths: paths() })
    expect(rows).toHaveLength(2)
    // DESC sort: forge_end first
    expect(rows[0].type).toBe("agent_complete")
    expect(rows[0].summary).toContain("completed")
    expect(rows[0].phase).toBe("p15")
    expect(rows[1].type).toBe("agent_spawn")
    expect(rows[1].origin).toBe("circuit-breakers")
  })

  it("unions every stream and sorts ts DESC", async () => {
    writeJsonl("activity.jsonl", [
      JSON.stringify({
        ts: "2026-04-23T12:00:00Z",
        type: "commit",
        source: "git-post-commit",
        summary: "c1",
      }),
    ])
    writeJsonl("circuit-breakers.jsonl", [
      JSON.stringify({
        ts: "2026-04-23T10:00:00Z",
        event: "forge_begin",
        agent: "forge",
        task_id: "p7-plA-t1",
      }),
    ])
    writeJsonl("heartbeat.jsonl", [
      JSON.stringify({
        ts: "2026-04-23T13:00:00Z",
        source: "heartbeat-emitter",
      }),
    ])
    writeJsonl("scheduler.jsonl", [
      JSON.stringify({
        ts: "2026-04-23T11:00:00Z",
        event: "scheduler_tick",
        schedule: "morning-brief",
      }),
    ])

    const rows = await getActivityFeed({ paths: paths() })
    expect(rows).toHaveLength(4)
    // Verify DESC order by ts
    const ts = rows.map((r) => r.ts)
    expect(ts).toEqual([
      "2026-04-23T13:00:00Z",
      "2026-04-23T12:00:00Z",
      "2026-04-23T11:00:00Z",
      "2026-04-23T10:00:00Z",
    ])
  })

  it("caps results at FEED_CAP (500)", async () => {
    const lines: string[] = []
    // 600 rows, 1s apart.
    const base = Date.parse("2026-04-23T00:00:00Z")
    for (let i = 0; i < 600; i++) {
      lines.push(
        JSON.stringify({
          ts: new Date(base + i * 1000).toISOString(),
          type: "other",
          source: "flood",
          summary: `row-${i}`,
        }),
      )
    }
    writeJsonl("activity.jsonl", lines)
    const rows = await getActivityFeed({ paths: paths(), tailLimit: 1000 })
    expect(rows).toHaveLength(FEED_CAP)
    // Newest row is the last-emitted (i=599)
    expect(rows[0].summary).toBe("row-599")
  })

  it("drops malformed rows silently", async () => {
    writeJsonl("activity.jsonl", [
      "not json",
      JSON.stringify({
        ts: "2026-04-23T12:00:00Z",
        type: "commit",
        source: "s",
        summary: "ok",
      }),
      JSON.stringify({ ts: 123, type: "commit", source: "s", summary: "bad-ts" }),
      JSON.stringify({ ts: "2026-04-23T12:00:01Z", summary: "missing-type" }),
    ])
    const rows = await getActivityFeed({ paths: paths() })
    expect(rows).toHaveLength(1)
    expect(rows[0].summary).toBe("ok")
  })

  it("tolerates heartbeat rows with only ts + source", async () => {
    writeJsonl("heartbeat.jsonl", [
      JSON.stringify({ ts: "2026-04-23T12:00:00Z", source: "heartbeat-emitter" }),
      JSON.stringify({ ts: "2026-04-23T12:00:30Z" }),
    ])
    const rows = await getActivityFeed({ paths: paths() })
    expect(rows).toHaveLength(2)
    expect(rows[0].origin).toBe("heartbeat")
  })
})
