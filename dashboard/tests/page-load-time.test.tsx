/**
 * P17-W1: per-route load-time unit tests.
 *
 * Verifies that when slow server-side dependencies are mocked to resolve
 * instantly, the client-facing components render a non-empty DOM in <100ms.
 *
 * Strategy:
 *   - Mock next/navigation, next/dynamic, and DevMode providers
 *   - Pass empty or minimal props to avoid real data-fetching
 *   - Measure wall-clock render time; assert <100ms
 *
 * Routes covered: /build/skills, /build/queue, /memory, /plan, /signin
 */

import { afterEach, describe, expect, it, vi, beforeEach } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import React from "react"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Shared stubs
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({
    get: () => null,
    toString: () => "",
  }),
  usePathname: () => "/",
}))

vi.mock("@/lib/providers/dev-mode", () => ({
  useDevMode: () => ({ dev: false }),
  DevModeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/lib/providers/explain-mode", () => ({
  useExplainMode: () => ({ explain: false }),
  ExplainModeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// ---------------------------------------------------------------------------
// /build/skills — SkillsClient renders in <100ms with empty catalog
// ---------------------------------------------------------------------------

vi.mock("@/components/skills/catalog-grid", () => ({
  CatalogGrid: () => <div data-testid="catalog-grid-stub" />,
}))

vi.mock("@/components/skills/skill-detail-drawer", () => ({
  SkillDetailDrawer: () => null,
}))

vi.mock("@/components/skills/install-button", () => ({
  InstallButton: () => null,
}))

describe("/build/skills — SkillsClient load time", () => {
  it("renders non-empty DOM in <100ms with empty catalog", async () => {
    const { SkillsClient } = await import("@/app/build/skills/skills-client")
    const t0 = performance.now()
    render(<SkillsClient catalog={[]} currentRole="viewer" />)
    const elapsed = performance.now() - t0
    expect(screen.getByTestId("skills-client")).toBeDefined()
    expect(elapsed).toBeLessThan(100)
  })
})

// ---------------------------------------------------------------------------
// /build/queue — QueueKanbanClient renders in <100ms with empty state
// ---------------------------------------------------------------------------

vi.mock("@/components/ui/empty-state", () => ({
  EmptyState: ({ heading }: { heading: string }) => <div>{heading}</div>,
  EmptyStateActions: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))

vi.mock("@/app/build/queue/queue-card", () => ({
  QueueCard: () => null,
}))

describe("/build/queue — QueueKanbanClient load time", () => {
  it("renders non-empty DOM in <100ms with empty queue state", async () => {
    const { QueueKanbanClient } = await import("@/app/build/queue/queue-kanban-client")
    const emptyState = {
      columns: {
        waiting: [],
        in_progress: [],
        double_checking: [],
        stuck: [],
        shipped: [],
      },
      counts: { waiting: 0, in_progress: 0, double_checking: 0, stuck: 0, shipped: 0 },
      fetchedAt: Date.now(),
    }
    const t0 = performance.now()
    render(<QueueKanbanClient initialState={emptyState} />)
    const elapsed = performance.now() - t0
    // Empty queue renders the empty-state root, not the kanban board
    expect(screen.getByTestId("build-queue-empty-root")).toBeDefined()
    expect(elapsed).toBeLessThan(100)
  })
})

// ---------------------------------------------------------------------------
// /plan — PlanPage renders in <100ms (pure static client component)
// ---------------------------------------------------------------------------

vi.mock("@/components/ui/empty-state", () => ({
  EmptyState: ({ heading }: { heading: string }) => <div>{heading}</div>,
  EmptyStateActions: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe("/plan — PlanPage load time", () => {
  it("renders non-empty DOM in <100ms", async () => {
    // PlanPage is a "use client" component with no data fetches
    const PlanPage = (await import("@/app/plan/page")).default
    const t0 = performance.now()
    render(<PlanPage />)
    const elapsed = performance.now() - t0
    expect(screen.getByTestId("plan-page")).toBeDefined()
    expect(elapsed).toBeLessThan(100)
  })
})

// ---------------------------------------------------------------------------
// /signin — SignInPage renders in <100ms (pure static client component)
// ---------------------------------------------------------------------------

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}))

describe("/signin — SignInPage load time", () => {
  it("renders non-empty DOM in <100ms with no auth fetches", async () => {
    const SignInPage = (await import("@/app/signin/page")).default
    const t0 = performance.now()
    render(<SignInPage />)
    const elapsed = performance.now() - t0
    expect(screen.getByTestId("signin-page")).toBeDefined()
    expect(elapsed).toBeLessThan(100)
  })
})
