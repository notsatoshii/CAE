/**
 * AgentCard tests.
 *
 * Plan 13-10 — MC-style redesign baseline (avatar, status pill, verb labels).
 * Phase 15 Wave 2.2 — verb container is now ALWAYS visible at rest. The
 * old "verb container starts with opacity-0" assertion was inverted to
 * assert visibility + keyboard reachability.
 */

import { describe, it, expect, afterEach, vi, beforeEach } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { AgentCard } from "./agent-card"
import { DevModeProvider } from "@/lib/providers/dev-mode"
import { ExplainModeProvider } from "@/lib/providers/explain-mode"
import type { AgentRosterEntry } from "@/lib/cae-agents-state"

afterEach(() => {
  cleanup()
})

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ toString: () => "", get: () => null }),
  usePathname: () => "/build/agents",
}))

function makeAgent(over: Partial<AgentRosterEntry> = {}): AgentRosterEntry {
  return {
    name: "forge",
    label: "Forge",
    founder_label: "The Builder",
    emoji: "🔨",
    color: "#00d4ff",
    model: "claude-sonnet-4-6",
    group: "active",
    last_run_days_ago: 0,
    stats_7d: {
      tokens_per_hour: [100, 200, 150],
      tokens_total: 45000,
      success_rate: 0.92,
      success_history: [1, 1, 0, 1, 1, 1, 1],
      avg_wall_ms: 30000,
      wall_history: [28000, 32000, 29000],
    },
    current: {
      concurrent: 2,
      queued: 1,
      last_24h_count: 8,
    },
    drift_warning: false,
    ...over,
  }
}

function renderCard(agent: AgentRosterEntry) {
  return render(
    <ExplainModeProvider>
      <DevModeProvider>
        <AgentCard agent={agent} />
      </DevModeProvider>
    </ExplainModeProvider>,
  )
}

describe("AgentCard (MC-style redesign)", () => {
  beforeEach(() => {
    // Ensure localStorage is clean for verb set tests
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("p13-agent-verbs")
    }
  })

  it("renders the avatar initial (first letter of agent name)", () => {
    renderCard(makeAgent({ name: "forge" }))
    // Avatar uses aria-hidden so it won't show up in accessible queries,
    // but it renders in the DOM.
    const card = screen.getByTestId("agent-card-forge")
    expect(card).toBeInTheDocument()
    // The avatar div renders "F" initial — check it's present somewhere in the card
    expect(card.textContent).toContain("F")
  })

  it("shows Active status pill for active group", () => {
    renderCard(makeAgent({ group: "active" }))
    expect(screen.getByText("Active")).toBeInTheDocument()
  })

  it("shows Offline status pill for dormant group", () => {
    renderCard(makeAgent({ group: "dormant", last_run_days_ago: 5 }))
    expect(screen.getByText("Offline")).toBeInTheDocument()
  })

  it("renders verb buttons from agentVerbs() (default: Start/Stop/Archive)", () => {
    renderCard(makeAgent())
    // Verbs are rendered; default set is start_stop_archive
    expect(screen.getByTestId("agent-card-forge-verb-primary")).toHaveTextContent("Start")
    expect(screen.getByTestId("agent-card-forge-verb-stop")).toHaveTextContent("Stop")
    expect(screen.getByTestId("agent-card-forge-verb-archive")).toHaveTextContent("Archive")
  })

  it("Wave 2.2 — verb container is visible at rest (no opacity-0 hover gate)", () => {
    renderCard(makeAgent())
    const verbContainer = screen.getByTestId("agent-card-forge-verbs")
    // Wave 2.2 contract: the row must NOT use opacity-0 (which hid it from
    // both pointer-less + keyboard users) and must NOT depend on group-hover
    // to become visible.
    expect(verbContainer.className).not.toContain("opacity-0")
    expect(verbContainer.className).not.toContain("group-hover:opacity-100")
  })

  it("Wave 2.2 — each verb button is keyboard reachable (a real <button>)", () => {
    renderCard(makeAgent())
    for (const verb of ["primary", "stop", "archive"] as const) {
      const btn = screen.getByTestId("agent-card-forge-verb-" + verb)
      expect(btn.tagName).toBe("BUTTON")
      expect(btn).toHaveAttribute("type", "button")
      // tabIndex must not be -1 — implicit "0" on a real <button> is fine.
      expect(btn.getAttribute("tabindex")).not.toBe("-1")
    }
  })

  it("card has role=button with aria-label", () => {
    renderCard(makeAgent({ label: "Forge" }))
    const card = screen.getByRole("button", { name: /Forge.*open details/i })
    expect(card).toBeInTheDocument()
  })

  it("shows 'Never' when last_run_days_ago is null", () => {
    renderCard(makeAgent({ group: "dormant", last_run_days_ago: null }))
    expect(screen.getByTestId("agent-card-forge-idle")).toHaveTextContent("Never")
  })

  it("shows drift warning badge when drift_warning is true", () => {
    renderCard(makeAgent({ drift_warning: true }))
    expect(screen.getByTestId("agent-card-forge-drift-indicator")).toBeInTheDocument()
  })
})
