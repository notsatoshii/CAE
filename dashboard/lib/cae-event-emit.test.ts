/**
 * cae-event-emit.test.ts — Class 15A.
 *
 * Coverage:
 *   1. Missing parent dir → emitActivity mkdir -p's it.
 *   2. Single event → one JSONL line, parse round-trips all fields.
 *   3. Concurrent emits → N lines, all parse clean, no interleaves.
 *   4. buildCommitEvent → sha/subject/files_changed_count roundtripped.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  type ActivityEvent,
  buildCommitEvent,
  emitActivity,
} from "./cae-event-emit"

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cae-event-emit-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("emitActivity", () => {
  it("creates the parent directory if missing and writes a JSONL line", async () => {
    const filePath = join(tmpDir, "nested", "dir", "activity.jsonl")
    const event: ActivityEvent = {
      ts: "2026-04-23T12:00:00.000Z",
      type: "commit",
      source: "git-post-commit",
      actor: "Eric",
      summary: "abc1234 feat: ship class 15",
      meta: { sha: "abc1234", files_changed_count: 3 },
    }
    await emitActivity(event, { filePath })

    const contents = readFileSync(filePath, "utf8")
    expect(contents.endsWith("\n")).toBe(true)
    const parsed = JSON.parse(contents.trim())
    expect(parsed).toEqual(event)
  })

  it("appends — does not overwrite", async () => {
    const filePath = join(tmpDir, "activity.jsonl")
    await emitActivity(
      { ts: "2026-04-23T00:00:00Z", type: "commit", source: "s1", summary: "first" },
      { filePath },
    )
    await emitActivity(
      { ts: "2026-04-23T00:00:01Z", type: "agent_spawn", source: "s2", summary: "second" },
      { filePath },
    )
    const lines = readFileSync(filePath, "utf8")
      .split("\n")
      .filter((l) => l.length > 0)
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).summary).toBe("first")
    expect(JSON.parse(lines[1]).summary).toBe("second")
  })

  it("handles 50 concurrent emits without line interleave", async () => {
    const filePath = join(tmpDir, "activity.jsonl")
    const emits = Array.from({ length: 50 }, (_, i) =>
      emitActivity(
        {
          ts: "2026-04-23T12:00:00Z",
          type: "other",
          source: "stress-test",
          summary: `event-${i}`,
          meta: { idx: i },
        },
        { filePath },
      ),
    )
    await Promise.all(emits)
    const lines = readFileSync(filePath, "utf8")
      .split("\n")
      .filter((l) => l.length > 0)
    expect(lines).toHaveLength(50)
    // Every line MUST parse — no partial/interleaved JSON.
    const indices = new Set<number>()
    for (const line of lines) {
      const ev = JSON.parse(line) as ActivityEvent
      const idx = (ev.meta?.idx as number) ?? -1
      indices.add(idx)
    }
    expect(indices.size).toBe(50)
  })
})

describe("buildCommitEvent", () => {
  it("returns a well-formed commit-type event", () => {
    const ev = buildCommitEvent({
      sha: "abcdef1234567890",
      shortSha: "abcdef1",
      subject: "feat(x): do thing",
      author: "Eric",
      filesChangedCount: 4,
      ts: "2026-04-23T12:00:00.000Z",
    })
    expect(ev.ts).toBe("2026-04-23T12:00:00.000Z")
    expect(ev.type).toBe("commit")
    expect(ev.source).toBe("git-post-commit")
    expect(ev.actor).toBe("Eric")
    expect(ev.summary).toBe("abcdef1 feat(x): do thing")
    expect(ev.meta).toMatchObject({
      sha: "abcdef1234567890",
      short_sha: "abcdef1",
      subject: "feat(x): do thing",
      files_changed_count: 4,
    })
  })

  it("defaults ts to now() when not provided", () => {
    const before = Date.now()
    const ev = buildCommitEvent({
      sha: "a",
      shortSha: "a",
      subject: "s",
      author: "x",
      filesChangedCount: 0,
    })
    const after = Date.now()
    const t = Date.parse(ev.ts)
    expect(t).toBeGreaterThanOrEqual(before)
    expect(t).toBeLessThanOrEqual(after)
  })
})
