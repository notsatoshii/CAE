/**
 * WorkflowsListClient — hydration regression + smoke tests.
 *
 * Verifies that the initial render (before useEffect/mount) is deterministic
 * regardless of the current time. The relativeTime() function uses Date.now(),
 * which would differ between SSR and CSR. The mounted-guard fix ensures
 * Date.now() is only called after the component mounts.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import React from "react"
import { WorkflowsListClient } from "./workflows-list-client"
import type { WorkflowRecord } from "@/lib/cae-workflows"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/build/workflows",
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: React.ReactNode }) =>
    React.createElement("a", { href, ...props }, children),
}))

vi.mock("@/lib/providers/dev-mode", () => ({
  useDevMode: () => ({ dev: false }),
}))

vi.mock("@/lib/chat-gated-actions", () => ({
  useGatedAction: () => ({ open: false, request: vi.fn(), reset: vi.fn() }),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock("@/components/chat/confirm-action-dialog", () => ({
  ConfirmActionDialog: () => null,
}))

vi.mock("@/components/auth/role-gate", () => ({
  RoleGate: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

const WORKFLOW: WorkflowRecord = {
  slug: "nightly-ship",
  filepath: "/home/cae/.cae/workflows/nightly-ship.yaml",
  spec: {
    name: "Nightly Ship",
    description: "Ships the latest build",
    trigger: { type: "manual" },
    steps: [
      { name: "build", agent: "forge", prompt: "build" },
      { name: "test", agent: "sentinel", prompt: "test" },
    ],
  },
  yaml: "",
  mtime: 1_745_000_000_000,
}

describe("WorkflowsListClient", () => {
  it("renders the workflow name", () => {
    render(<WorkflowsListClient initialWorkflows={[WORKFLOW]} />)
    expect(screen.getByText("Nightly Ship")).toBeTruthy()
  })

  it("hydration regression: initial render is deterministic regardless of current time", () => {
    // relativeTime(w.mtime) uses Date.now(). With the mounted guard, it is only
    // called after mount; initial render uses the ISO date string instead.
    vi.spyOn(Date, "now").mockReturnValue(0)
    const html1 = renderToStaticMarkup(
      <WorkflowsListClient initialWorkflows={[WORKFLOW]} />
    )
    vi.spyOn(Date, "now").mockReturnValue(Number.MAX_SAFE_INTEGER)
    const html2 = renderToStaticMarkup(
      <WorkflowsListClient initialWorkflows={[WORKFLOW]} />
    )
    expect(html1).toBe(html2)
  })
})
