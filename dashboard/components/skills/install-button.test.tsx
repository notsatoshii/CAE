import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React from "react"
import type { CatalogSkill } from "@/lib/cae-types"

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const SKILL: CatalogSkill = {
  name: "agent-skills",
  owner: "vercel-labs",
  source: "skills.sh",
  description: "Reusable agent skills",
  installCmd: "npx skills add vercel-labs/agent-skills",
  detailUrl: "https://skills.sh/vercel-labs/agent-skills",
  installed: false,
}

function makeSseStream(lines: string[], exitCode: number): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  const chunks: string[] = [
    ...lines.map((l) => `event: line\ndata: ${JSON.stringify(l)}\n\n`),
    `event: done\ndata: ${JSON.stringify(String(exitCode))}\n\n`,
  ]
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(enc.encode(chunks[i++]))
      } else {
        controller.close()
      }
    },
  })
}

describe("InstallButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("Test 3: click opens install dialog showing live log on SSE stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "text/event-stream" }),
        body: makeSseStream(["Installing...\n", "Done!\n"], 0),
      })
    )

    const { InstallButton } = await import("./install-button")
    render(<InstallButton skill={SKILL} />)

    fireEvent.click(screen.getByRole("button", { name: /install/i }))

    // Dialog should appear
    await waitFor(() => {
      expect(screen.getByTestId("install-dialog")).toBeInTheDocument()
    })

    // Log output should appear
    await waitFor(
      () => {
        expect(screen.getByTestId("install-log")).toHaveTextContent(
          /Installing/i
        )
      },
      { timeout: 3000 }
    )
  })

  it("Test 3b: calls onInstalled after done:0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "text/event-stream" }),
        body: makeSseStream(["Line 1\n"], 0),
      })
    )

    const onInstalled = vi.fn()
    const { InstallButton } = await import("./install-button")
    render(<InstallButton skill={SKILL} onInstalled={onInstalled} />)

    fireEvent.click(screen.getByRole("button", { name: /install/i }))

    await waitFor(
      () => {
        expect(onInstalled).toHaveBeenCalled()
      },
      { timeout: 3000 }
    )
  })

  it("Test 3c: POST is called with correct repo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "text/event-stream" }),
      body: makeSseStream([], 0),
    })
    vi.stubGlobal("fetch", fetchMock)

    const { InstallButton } = await import("./install-button")
    render(<InstallButton skill={SKILL} />)

    fireEvent.click(screen.getByRole("button", { name: /install/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/skills/install",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("vercel-labs/agent-skills"),
        })
      )
    })
  })
})
