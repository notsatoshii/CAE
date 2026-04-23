/**
 * cae-audit-log.test.ts — Unit tests for audit log reader.
 *
 * Behaviors tested:
 *   8. readAuditLog parses fixture JSONL → filtered AuditEntry[], sorted desc
 *   9. Invalid JSONL line skipped, others still returned
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import * as path from "node:path"

// Stub listProjects + tailJsonl to avoid filesystem access
vi.mock("./cae-state", () => ({
  listProjects: vi.fn(),
  tailJsonl: vi.fn(),
}))

const FIXTURE_DIR = path.join(
  process.cwd(),
  "tests/fixtures/schedule"
)

describe("readAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("Test 8: parses fixture entries → returns sorted descending AuditEntry[]", async () => {
    const { listProjects, tailJsonl } = await import("./cae-state")
    const { readAuditLog } = await import("./cae-audit-log")

    // Stub listProjects → one project pointing at fixture dir parent
    vi.mocked(listProjects).mockResolvedValue([
      { name: "test", path: "/tmp/fake-project", hasPlanning: false },
    ] as any)

    // Stub tailJsonl to return parsed entries from fixture
    vi.mocked(tailJsonl).mockResolvedValue([
      { ts: "2026-04-23T10:00:00Z", task: "t1", tool: "Bash", cwd: "/home/cae" },
      { ts: "2026-04-23T10:00:05Z", task: "t1", tool: "Write", cwd: "/home/cae" },
      { ts: "2026-04-23T10:00:10Z", task: "t2", tool: "Edit", cwd: "/home/cae" },
      { ts: "2026-04-23T09:00:00Z", task: "t2", tool: "Bash", cwd: "/home/cae" },
    ] as any)

    const { entries, total } = await readAuditLog({})
    expect(total).toBe(4)
    // Sorted descending by ts
    expect(entries[0].ts).toBe("2026-04-23T10:00:10Z")
    expect(entries[entries.length - 1].ts).toBe("2026-04-23T09:00:00Z")
  })

  it("Test 8b: filter by tool returns only matching entries", async () => {
    const { listProjects, tailJsonl } = await import("./cae-state")
    const { readAuditLog } = await import("./cae-audit-log")

    vi.mocked(listProjects).mockResolvedValue([
      { name: "test", path: "/tmp/fake-project", hasPlanning: false },
    ] as any)

    vi.mocked(tailJsonl).mockResolvedValue([
      { ts: "2026-04-23T10:00:00Z", task: "t1", tool: "Bash", cwd: "/home/cae" },
      { ts: "2026-04-23T10:00:05Z", task: "t1", tool: "Write", cwd: "/home/cae" },
      { ts: "2026-04-23T10:00:10Z", task: "t2", tool: "Edit", cwd: "/home/cae" },
    ] as any)

    const { entries } = await readAuditLog({ tool: "Bash" })
    expect(entries.length).toBe(1)
    expect(entries[0].tool).toBe("Bash")
  })

  it("Test 9: invalid JSONL lines skipped, others still returned", async () => {
    const { listProjects, tailJsonl } = await import("./cae-state")
    const { readAuditLog } = await import("./cae-audit-log")

    vi.mocked(listProjects).mockResolvedValue([
      { name: "test", path: "/tmp/fake-project", hasPlanning: false },
    ] as any)

    // tailJsonl already handles bad JSON internally and returns [] for bad lines
    // We simulate it returning an entry without required fields (typeguard should skip it)
    vi.mocked(tailJsonl).mockResolvedValue([
      { ts: "2026-04-23T10:00:00Z", task: "t1", tool: "Bash", cwd: "/home/cae" },
      { notAnAuditEntry: true }, // bad shape — should be skipped by typeguard
      { ts: "2026-04-23T10:00:05Z", task: "t1", tool: "Write", cwd: "/home/cae" },
    ] as any)

    const { entries, total } = await readAuditLog({})
    expect(total).toBe(2)
    expect(entries.every((e) => typeof e.tool === "string")).toBe(true)
  })

  it("Test 8c: pagination with offset + limit works", async () => {
    const { listProjects, tailJsonl } = await import("./cae-state")
    const { readAuditLog } = await import("./cae-audit-log")

    vi.mocked(listProjects).mockResolvedValue([
      { name: "test", path: "/tmp/fake-project", hasPlanning: false },
    ] as any)

    const allEntries = Array.from({ length: 10 }, (_, i) => ({
      ts: `2026-04-23T10:00:0${i}Z`,
      task: "t1",
      tool: "Bash",
      cwd: "/home/cae",
    }))
    vi.mocked(tailJsonl).mockResolvedValue(allEntries as any)

    const { entries, total } = await readAuditLog({ limit: 3, offset: 2 })
    expect(total).toBe(10)
    expect(entries.length).toBe(3)
  })
})
