/**
 * cae-agents-state tests — session 14 focus.
 *
 * Covers the new `active_concurrent` + `active_since_ms` fields that drive
 * the per-card "ACTIVE · Nx" chip on /build/agents. Also asserts the
 * 5-minute window + (task_id, attempt) pairing mirrors the Mission
 * Control countActiveAgents contract.
 *
 * Mocks `./cae-state::listProjects` + `tailJsonl` via vi.hoisted so the
 * aggregator reads a fixture event stream instead of the real filesystem
 * (same pattern as cae-changes-state.test.ts).
 */

import { describe, it, expect, beforeEach, vi } from "vitest"

const { listProjectsMock, tailJsonlMock } = vi.hoisted(() => ({
  listProjectsMock: vi.fn(),
  tailJsonlMock: vi.fn(),
}))

vi.mock("./cae-state", () => ({
  listProjects: (...args: unknown[]) => listProjectsMock(...args),
  tailJsonl: (...args: unknown[]) => tailJsonlMock(...args),
}))

import {
  getAgentsRoster,
  __resetAgentsRosterCacheForTest,
  type AgentRosterEntry,
} from "./cae-agents-state"

// Ground-truth CB event shape matches bin/circuit_breakers.py output.
type CbRow = Record<string, unknown>

function iso(date: Date): string {
  return date.toISOString()
}

function minutesAgo(mins: number, now: Date = new Date()): string {
  return iso(new Date(now.getTime() - mins * 60_000))
}

function secondsAgo(secs: number, now: Date = new Date()): string {
  return iso(new Date(now.getTime() - secs * 1_000))
}

function setFixtureEvents(rows: CbRow[]) {
  listProjectsMock.mockResolvedValue([
    { name: "ctrl-alt-elite", path: "/home/cae/ctrl-alt-elite" },
  ])
  tailJsonlMock.mockResolvedValue(rows)
}

function findAgent(
  roster: AgentRosterEntry[],
  name: string,
): AgentRosterEntry {
  const a = roster.find((r) => r.name === name)
  if (!a) throw new Error("fixture bug: expected agent " + name + " in roster")
  return a
}

describe("cae-agents-state — active_concurrent + active_since_ms", () => {
  beforeEach(() => {
    __resetAgentsRosterCacheForTest()
    listProjectsMock.mockReset()
    tailJsonlMock.mockReset()
  })

  it("sets active_concurrent = 0 when the jsonl is empty", async () => {
    setFixtureEvents([])
    const { agents } = await getAgentsRoster()
    for (const a of agents) {
      expect(a.active_concurrent).toBe(0)
      expect(a.active_since_ms).toBeNull()
    }
  })

  it("counts a forge_begin with NO matching forge_end as 1 active", async () => {
    setFixtureEvents([
      {
        ts: minutesAgo(1),
        event: "forge_begin",
        task_id: "p99-pl01-t1",
        attempt: 1,
        agent: "forge",
      },
    ])
    const { agents } = await getAgentsRoster()
    const forge = findAgent(agents, "forge")
    expect(forge.active_concurrent).toBe(1)
    expect(forge.active_since_ms).not.toBeNull()
    // Other agents unaffected
    const nexus = findAgent(agents, "nexus")
    expect(nexus.active_concurrent).toBe(0)
    expect(nexus.active_since_ms).toBeNull()
  })

  it("ignores a forge_begin already paired with a forge_end", async () => {
    setFixtureEvents([
      {
        ts: minutesAgo(3),
        event: "forge_begin",
        task_id: "p99-pl01-tDone",
        attempt: 1,
        agent: "forge",
      },
      {
        ts: minutesAgo(2),
        event: "forge_end",
        task_id: "p99-pl01-tDone",
        attempt: 1,
        agent: "forge",
        success: true,
      },
    ])
    const { agents } = await getAgentsRoster()
    expect(findAgent(agents, "forge").active_concurrent).toBe(0)
  })

  it("counts multiple concurrent tasks as N", async () => {
    setFixtureEvents([
      { ts: secondsAgo(90), event: "forge_begin", task_id: "p99-pl01-tA", attempt: 1, agent: "forge" },
      { ts: secondsAgo(60), event: "forge_begin", task_id: "p99-pl01-tB", attempt: 1, agent: "forge" },
      { ts: secondsAgo(30), event: "forge_begin", task_id: "p99-pl01-tC", attempt: 1, agent: "forge" },
    ])
    const { agents } = await getAgentsRoster()
    expect(findAgent(agents, "forge").active_concurrent).toBe(3)
  })

  it("active_since_ms is the OLDEST open begin timestamp", async () => {
    const now = new Date()
    const olderBegin = new Date(now.getTime() - 120_000) // 2 min ago
    const newerBegin = new Date(now.getTime() - 30_000)  // 30 s ago
    setFixtureEvents([
      { ts: iso(olderBegin), event: "forge_begin", task_id: "p99-pl01-tOld", attempt: 1, agent: "forge" },
      { ts: iso(newerBegin), event: "forge_begin", task_id: "p99-pl01-tNew", attempt: 1, agent: "forge" },
    ])
    const { agents } = await getAgentsRoster()
    const forge = findAgent(agents, "forge")
    expect(forge.active_concurrent).toBe(2)
    expect(forge.active_since_ms).toBe(olderBegin.getTime())
  })

  it("drops forge_begin outside the 5-minute window", async () => {
    setFixtureEvents([
      // 6 minutes ago — outside the window, must not contribute
      { ts: minutesAgo(6), event: "forge_begin", task_id: "p99-pl01-tStale", attempt: 1, agent: "forge" },
    ])
    const { agents } = await getAgentsRoster()
    expect(findAgent(agents, "forge").active_concurrent).toBe(0)
    expect(findAgent(agents, "forge").active_since_ms).toBeNull()
  })

  it("keys on (task_id, attempt) — a retry doesn't erase the original begin", async () => {
    // forge_begin attempt=1 (open), then forge_begin attempt=2 (different key)
    // plus a forge_end ONLY for attempt=2 → attempt=1 still active.
    setFixtureEvents([
      { ts: secondsAgo(90), event: "forge_begin", task_id: "p99-pl01-tRetry", attempt: 1, agent: "forge" },
      { ts: secondsAgo(60), event: "forge_begin", task_id: "p99-pl01-tRetry", attempt: 2, agent: "forge" },
      { ts: secondsAgo(30), event: "forge_end",   task_id: "p99-pl01-tRetry", attempt: 2, agent: "forge", success: true },
    ])
    const { agents } = await getAgentsRoster()
    expect(findAgent(agents, "forge").active_concurrent).toBe(1)
  })

  it("partitions active_concurrent per agent name", async () => {
    setFixtureEvents([
      { ts: secondsAgo(60), event: "forge_begin", task_id: "p99-pl01-tF", attempt: 1, agent: "forge" },
      { ts: secondsAgo(50), event: "forge_begin", task_id: "p99-pl01-tS", attempt: 1, agent: "sentinel" },
      { ts: secondsAgo(40), event: "forge_begin", task_id: "p99-pl01-tS2", attempt: 1, agent: "sentinel" },
    ])
    const { agents } = await getAgentsRoster()
    expect(findAgent(agents, "forge").active_concurrent).toBe(1)
    expect(findAgent(agents, "sentinel").active_concurrent).toBe(2)
    expect(findAgent(agents, "nexus").active_concurrent).toBe(0)
  })

  it("group flips to 'active' when active_concurrent > 0 even if the 30s footer count is 0", async () => {
    // Begin was 2 minutes ago — well outside the 30-second `current.concurrent`
    // window but inside the 5-minute chip window. The card should still
    // count as "active" (group) so sorting + pill agree with the chip.
    setFixtureEvents([
      { ts: minutesAgo(2), event: "forge_begin", task_id: "p99-pl01-tLong", attempt: 1, agent: "forge" },
    ])
    const { agents } = await getAgentsRoster()
    const forge = findAgent(agents, "forge")
    expect(forge.active_concurrent).toBe(1)
    expect(forge.current.concurrent).toBe(0) // 30s window skipped this begin
    expect(forge.group).toBe("active")
  })
})
