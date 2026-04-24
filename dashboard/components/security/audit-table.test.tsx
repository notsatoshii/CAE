/**
 * audit-table.test.tsx — AuditTable filter + pagination tests.
 *
 * Test 5: renders AuditEntry[] with filter inputs and pagination.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { AuditTable } from "./audit-table"
import type { AuditEntry } from "@/lib/cae-types"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const ENTRIES: AuditEntry[] = [
  { ts: "2026-04-23T10:00:00Z", task: "t1", tool: "Bash", cwd: "/home/cae" },
  { ts: "2026-04-23T10:00:05Z", task: "t1", tool: "Write", cwd: "/home/cae" },
  { ts: "2026-04-23T10:00:10Z", task: "t2", tool: "Edit", cwd: "/home/cae/project" },
]

describe("AuditTable", () => {
  it("Test 5: renders all entries in initial data", () => {
    render(
      <AuditTable initial={{ entries: ENTRIES, total: ENTRIES.length }} />
    )

    // Tools appear in both the filter dropdown and the table rows
    expect(screen.getAllByText("Bash").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Write").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Edit").length).toBeGreaterThanOrEqual(1)
  })

  it("Test 5b: renders filter inputs", () => {
    render(
      <AuditTable initial={{ entries: ENTRIES, total: ENTRIES.length }} />
    )

    // Tool filter
    expect(screen.getByTestId("audit-filter-tool")).toBeDefined()
    // Date range inputs
    expect(screen.getByTestId("audit-filter-from")).toBeDefined()
    expect(screen.getByTestId("audit-filter-to")).toBeDefined()
  })

  it("Test 5c: shows total count", () => {
    render(
      <AuditTable initial={{ entries: ENTRIES, total: 3 }} />
    )
    // Shows "{total} entries" label
    expect(screen.getByText(/3 entries/)).toBeDefined()
  })

  it("Test 5d: empty state when no entries", () => {
    render(
      <AuditTable initial={{ entries: [], total: 0 }} />
    )
    expect(screen.getByTestId("audit-empty")).toBeDefined()
  })

  it("hydration regression: initial render is deterministic regardless of current time", () => {
    // Simulate SSR at one time, CSR hydration at a very different time.
    // With the mounted-guard fix, Date.now() must not be called during initial render.
    vi.spyOn(Date, "now").mockReturnValue(0)
    const html1 = renderToStaticMarkup(
      <AuditTable initial={{ entries: ENTRIES, total: ENTRIES.length }} />
    )
    vi.spyOn(Date, "now").mockReturnValue(Number.MAX_SAFE_INTEGER)
    const html2 = renderToStaticMarkup(
      <AuditTable initial={{ entries: ENTRIES, total: ENTRIES.length }} />
    )
    expect(html1).toBe(html2)
  })
})
