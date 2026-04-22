/**
 * Plan 13-10 — Queue column chrome consistency tests.
 *
 * Verifies that all 5 queue columns share the same chrome pattern:
 *   - Same wrapper classes (rounded-lg border bg-surface p-3)
 *   - Same count chip class (rounded-full font-mono)
 *   - Consistent empty state across all columns
 */

import { describe, it, expect, afterEach, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { QueueKanbanClient } from "../../app/build/queue/queue-kanban-client"
import { DevModeProvider } from "@/lib/providers/dev-mode"
import { ExplainModeProvider } from "@/lib/providers/explain-mode"
import type { QueueState } from "@/lib/cae-queue-state"

afterEach(() => {
  cleanup()
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ toString: () => "", get: () => null }),
  usePathname: () => "/build/queue",
}))

function emptyQueueState(): QueueState {
  return {
    columns: {
      waiting: [],
      in_progress: [],
      double_checking: [],
      stuck: [],
      shipped: [],
    },
    generated_at: new Date().toISOString(),
    cache_ttl_ms: 5000,
  }
}

function renderKanban(state: QueueState) {
  return render(
    <ExplainModeProvider>
      <DevModeProvider>
        <QueueKanbanClient initialState={state} />
      </DevModeProvider>
    </ExplainModeProvider>,
  )
}

const COLUMN_KEYS = ["waiting", "in_progress", "double_checking", "stuck", "shipped"] as const

describe("Queue column chrome consistency (pillar 3)", () => {
  it("renders all 5 columns even when all are empty (with tasks in one)", () => {
    // Add one task so we don't hit the page-level EmptyState
    const state = emptyQueueState()
    state.columns.waiting = [
      {
        taskId: "t1",
        title: "Test task",
        agent: "forge",
        project: "ctrl-alt-elite",
        status: "waiting",
        ts: Date.now(),
        tags: [],
      },
    ]
    renderKanban(state)
    for (const key of COLUMN_KEYS) {
      expect(screen.getByTestId("queue-column-" + key)).toBeInTheDocument()
    }
  })

  it("all columns have the same rounded-lg border class", () => {
    const state = emptyQueueState()
    state.columns.waiting = [
      {
        taskId: "t2",
        title: "Another task",
        agent: "forge",
        project: "ctrl-alt-elite",
        status: "waiting",
        ts: Date.now(),
        tags: [],
      },
    ]
    renderKanban(state)
    for (const key of COLUMN_KEYS) {
      const col = screen.getByTestId("queue-column-" + key)
      expect(col.className).toContain("rounded-lg")
      expect(col.className).toContain("border")
      expect(col.className).toContain("p-3")
    }
  })

  it("all count chips share the rounded-full font-mono class", () => {
    const state = emptyQueueState()
    state.columns.waiting = [
      {
        taskId: "t3",
        title: "Task",
        agent: "forge",
        project: "ctrl-alt-elite",
        status: "waiting",
        ts: Date.now(),
        tags: [],
      },
    ]
    renderKanban(state)
    for (const key of COLUMN_KEYS) {
      const chip = screen.getByTestId("queue-column-count-" + key)
      expect(chip.className).toContain("rounded-full")
      expect(chip.className).toContain("font-mono")
    }
  })

  it("empty columns show consistent 'No items' text", () => {
    const state = emptyQueueState()
    // Put one item in waiting so we see the kanban (not page EmptyState)
    state.columns.waiting = [
      {
        taskId: "t4",
        title: "Filler",
        agent: "forge",
        project: "ctrl-alt-elite",
        status: "waiting",
        ts: Date.now(),
        tags: [],
      },
    ]
    renderKanban(state)
    // Other 4 columns are empty — should all show empty state testids
    for (const key of ["in_progress", "double_checking", "stuck", "shipped"] as const) {
      expect(screen.getByTestId("queue-column-empty-" + key)).toBeInTheDocument()
    }
  })
})
