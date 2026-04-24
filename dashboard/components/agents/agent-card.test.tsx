/**
 * AgentCard tests.
 *
 * Plan 13-10 — MC-style redesign baseline (avatar, status pill, verb labels).
 * Phase 15 Wave 2.2 — verb container is now ALWAYS visible at rest. The
 * old "verb container starts with opacity-0" assertion was inverted to
 * assert visibility + keyboard reachability.
 * Session 14 — colored "ACTIVE · Nx" chip renders when the agent has
 * live forge_begin events in the last 5 min. Chip color is the agent's
 * deterministic hue (hash-derived from the name).
 */

import { describe, it, expect, afterEach, vi, beforeEach } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { AgentCard, agentHue, AGENT_HUE_PALETTE } from "./agent-card"
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
    active_concurrent: 0,
    active_since_ms: null,
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

describe("AgentCard — Session 14 ACTIVE chip", () => {
  it("does NOT render the chip when active_concurrent = 0", () => {
    renderCard(makeAgent({ active_concurrent: 0 }))
    expect(screen.queryByTestId("agent-card-forge-active-chip")).toBeNull()
  })

  it("renders the chip when active_concurrent > 0", () => {
    renderCard(makeAgent({ active_concurrent: 3 }))
    const chip = screen.getByTestId("agent-card-forge-active-chip")
    expect(chip).toBeInTheDocument()
    // Label format: "ACTIVE · 3x"
    expect(chip.textContent).toMatch(/ACTIVE\s*·\s*3x/)
  })

  it("chip count reflects the active_concurrent value", () => {
    renderCard(makeAgent({ name: "nexus", active_concurrent: 7 }))
    const chip = screen.getByTestId("agent-card-nexus-active-chip")
    expect(chip.textContent).toMatch(/ACTIVE\s*·\s*7x/)
  })

  it("chip carries the agent's deterministic hue in its inline style", () => {
    // Confirm that chip background/border use the same hue agentHue() returns.
    renderCard(makeAgent({ name: "forge", active_concurrent: 1 }))
    const chip = screen.getByTestId("agent-card-forge-active-chip")
    const hue = agentHue("forge")
    expect(AGENT_HUE_PALETTE).toContain(hue as typeof AGENT_HUE_PALETTE[number])
    // JSDOM normalizes "#rrggbb" → "rgb(r, g, b)" on the style attribute,
    // so compare numerically.
    const style = chip.getAttribute("style") ?? ""
    const r = parseInt(hue.slice(1, 3), 16)
    const g = parseInt(hue.slice(3, 5), 16)
    const b = parseInt(hue.slice(5, 7), 16)
    const rgb = "rgb(" + r + ", " + g + ", " + b + ")"
    expect(style).toContain("border-color: " + rgb)
    expect(style).toContain("color: " + rgb)
    // And the chip background must be the color-mix wrapper over the same hue.
    expect(style).toContain("color-mix(in srgb, " + rgb + " 20%, transparent)")
  })

  it("chip is keyboard-focusable and carries a descriptive title attribute", () => {
    renderCard(makeAgent({ name: "forge", label: "Forge", active_concurrent: 2 }))
    const chip = screen.getByTestId("agent-card-forge-active-chip")
    expect(chip.getAttribute("tabindex")).toBe("0")
    expect(chip).toHaveAttribute("title", "2 concurrent tasks running as Forge")
  })

  it("chip carries the pulse animation class (globals.css handles reduced-motion)", () => {
    renderCard(makeAgent({ active_concurrent: 1 }))
    const chip = screen.getByTestId("agent-card-forge-active-chip")
    expect(chip.className).toContain("agent-active-chip")
  })

  it("different agents get different hues (palette covers all 9 AGENT_META names)", () => {
    // Not every pair needs to differ (the palette has 8 entries for 9 names
    // so collision is expected), but the function must be deterministic + stable.
    expect(agentHue("forge")).toBe(agentHue("forge"))
    expect(agentHue("nexus")).toBe(agentHue("nexus"))
    // Sanity: at least two different names land on different hues.
    const hues = new Set(
      ["forge", "nexus", "sentinel", "scout", "scribe", "phantom", "aegis", "arch", "herald"]
        .map(agentHue),
    )
    expect(hues.size).toBeGreaterThanOrEqual(2)
  })
})
