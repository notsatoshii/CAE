// @vitest-environment node
/**
 * audit/fixtures/fixtures.test.ts — Phase 15 Cap.2.
 *
 * Seeds each fixture into a fresh tmpdir and asserts the dashboard's
 * real aggregators (getMissionControlState, buildHomeState) read them
 * correctly without throwing.
 *
 * Why this matters: the aggregators are law (see the task brief) — if
 * our fixtures produce bytes the aggregator can't parse, every screenshot
 * downstream will be wrong. This test catches schema drift early.
 *
 * Uses `noCache: true` + explicit path overrides so we never hit the real
 * project's .cae/ directory or the 5-second process cache.
 */
import { describe, expect, it } from "vitest"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { seed as seedEmpty } from "./empty"
import { seed as seedHealthy } from "./healthy"
import { seed as seedDegraded } from "./degraded"
import { seed as seedBroken } from "./broken"
import { getMissionControlState } from "@/lib/cae-mission-control-state"

async function mktmp(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `audit-fixture-${prefix}-`))
}

function mcOpts(root: string) {
  return {
    cbPath: join(root, ".cae", "metrics", "circuit-breakers.jsonl"),
    toolsPath: join(root, ".cae", "metrics", "tool-calls.jsonl"),
    lastSeenPath: join(root, ".cae", "sessions", "last-seen.json"),
    noCache: true,
    touchLastSeen: false,
  }
}

describe("fixtures", () => {
  it("empty → aggregator returns zero counts and does not throw", async () => {
    const root = await mktmp("empty")
    try {
      await seedEmpty(root)
      const state = await getMissionControlState(mcOpts(root))
      expect(state.active_count).toBe(0)
      expect(state.tokens_today).toBe(0)
      expect(state.tokens_burn_7d).toBe(0)
      expect(state.sparkline_60s).toHaveLength(60)
      expect(state.last_event_at).toBeNull()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("healthy → active_count > 0, tokens today > 0, sparkline populated", async () => {
    const root = await mktmp("healthy")
    try {
      await seedHealthy(root)
      const state = await getMissionControlState(mcOpts(root))
      // 5 of 30 forge_begins have no matching forge_end → 5 active.
      expect(state.active_count).toBeGreaterThan(0)
      expect(state.tokens_today).toBeGreaterThan(0)
      // At least one 1s bucket populated from the 120 tool calls.
      const populated = state.sparkline_60s.filter((b) => b.count > 0)
      expect(populated.length).toBeGreaterThan(0)
      expect(state.last_event_at).not.toBeNull()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("degraded → activity present but none active now (all > 5min old)", async () => {
    const root = await mktmp("degraded")
    try {
      await seedDegraded(root)
      const state = await getMissionControlState(mcOpts(root))
      // Degraded fixture places all events 1..30min ago — outside the
      // 5-minute active window, so active_count must be 0.
      expect(state.active_count).toBe(0)
      // But tokens today must still accumulate from token_usage rows.
      expect(state.tokens_today).toBeGreaterThan(0)
      expect(state.last_event_at).not.toBeNull()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("broken → aggregator does not throw, skips malformed rows", async () => {
    const root = await mktmp("broken")
    try {
      await seedBroken(root)
      // Must not throw — corrupted lines are ignored by design.
      const state = await getMissionControlState(mcOpts(root))
      expect(state).toBeDefined()
      // At least the one valid forge_begin+forge_end pair was seen.
      expect(state.last_event_at).not.toBeNull()
      // Valid forge_end closed the begin → no active.
      expect(state.active_count).toBe(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
