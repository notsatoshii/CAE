/**
 * RecentCommits tests — Class 15C.
 *
 * Four required states per Class 3 liveness discipline:
 *   - loading → skeleton rendered, data-liveness="loading"
 *   - empty   → EmptyState rendered, data-liveness="empty"
 *   - healthy → commit rows rendered, data-liveness="healthy"
 *   - error   → EmptyState error rendered, data-liveness="error"
 *
 * Additionally: rows render shortSha + subject + author and link to the
 * html URL when present.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { RecentCommits } from "./recent-commits"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
})

function makeResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as Response
}

const SAMPLE_COMMITS = [
  {
    sha: "abcdef1234567890",
    shortSha: "abcdef1",
    subject: "feat(x): do a thing",
    author: "Eric",
    ts: new Date(Date.now() - 300_000).toISOString(),
    url: "https://github.com/foo/bar/commit/abcdef1234567890",
    source: "github",
  },
  {
    sha: "fedcba0987654321",
    shortSha: "fedcba0",
    subject: "fix(y): the regression",
    author: "Claude",
    ts: new Date(Date.now() - 3600_000).toISOString(),
    source: "local",
  },
]

describe("RecentCommits", () => {
  it("renders the loading state before data arrives", () => {
    // Fetch never resolves — component stays in loading state.
    fetchMock.mockImplementation(() => new Promise(() => {}))
    render(<RecentCommits />)
    const panel = screen.getByTestId("recent-commits")
    expect(panel.getAttribute("data-liveness")).toBe("loading")
    expect(screen.getByTestId("recent-commits-loading")).toBeInTheDocument()
  })

  it("renders the empty state when the API returns []", async () => {
    fetchMock.mockResolvedValue(makeResponse({ commits: [], repo: null }))
    render(<RecentCommits />)
    await waitFor(() =>
      expect(screen.getByTestId("recent-commits-empty")).toBeInTheDocument(),
    )
    const panel = screen.getByTestId("recent-commits")
    expect(panel.getAttribute("data-liveness")).toBe("empty")
  })

  it("renders the error state when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"))
    render(<RecentCommits />)
    await waitFor(() =>
      expect(screen.getByTestId("recent-commits-error")).toBeInTheDocument(),
    )
    const panel = screen.getByTestId("recent-commits")
    expect(panel.getAttribute("data-liveness")).toBe("error")
  })

  it("renders commit rows when commits arrive (healthy)", async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ commits: SAMPLE_COMMITS, repo: "https://github.com/foo/bar" }),
    )
    render(<RecentCommits />)
    await waitFor(() =>
      expect(screen.getByTestId("recent-commit-abcdef1")).toBeInTheDocument(),
    )
    expect(screen.getByTestId("recent-commit-fedcba0")).toBeInTheDocument()
    expect(screen.getByText("feat(x): do a thing")).toBeInTheDocument()
    expect(screen.getByText("fix(y): the regression")).toBeInTheDocument()

    const panel = screen.getByTestId("recent-commits")
    expect(panel.getAttribute("data-liveness")).toBe("healthy")

    // Link to github when url is present.
    const link = screen
      .getByTestId("recent-commit-abcdef1")
      .querySelector("a") as HTMLAnchorElement
    expect(link.href).toContain("github.com/foo/bar/commit/abcdef1234567890")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toContain("noopener")
  })
})
