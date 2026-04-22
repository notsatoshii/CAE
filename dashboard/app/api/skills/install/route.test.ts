import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Mock the install module
vi.mock("@/lib/cae-skills-install", () => ({
  installSkill: vi.fn(),
}))

async function* mockInstallIterator(lines: string[], exitCode: number) {
  for (const line of lines) {
    yield { type: "line" as const, data: line }
  }
  yield { type: "done" as const, data: String(exitCode) }
}

function parseSseText(text: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = []
  const chunks = text.split("\n\n").filter(Boolean)
  for (const chunk of chunks) {
    const lines = chunk.split("\n")
    let event = "message"
    let data = ""
    for (const line of lines) {
      if (line.startsWith("event: ")) event = line.slice(7)
      if (line.startsWith("data: ")) data = line.slice(6)
    }
    events.push({ event, data })
  }
  return events
}

describe("POST /api/skills/install", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("Test 4: returns SSE stream with Content-Type text/event-stream", async () => {
    const { installSkill } = await import("@/lib/cae-skills-install")
    vi.mocked(installSkill).mockReturnValue(
      mockInstallIterator(["Installing...\n", "Done!\n"], 0)
    )

    const { POST } = await import("./route")
    const req = new NextRequest("http://localhost/api/skills/install", {
      method: "POST",
      body: JSON.stringify({ repo: "vercel-labs/agent-skills" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toContain("text/event-stream")
  })

  it("Test 4b: SSE body emits line events then done:0", async () => {
    const { installSkill } = await import("@/lib/cae-skills-install")
    vi.mocked(installSkill).mockReturnValue(
      mockInstallIterator(["line1\n"], 0)
    )

    const { POST } = await import("./route")
    const req = new NextRequest("http://localhost/api/skills/install", {
      method: "POST",
      body: JSON.stringify({ repo: "vercel-labs/agent-skills" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)

    // Read the stream
    const text = await res.text()
    const events = parseSseText(text)

    const lineEvent = events.find((e) => e.event === "line")
    const doneEvent = events.find((e) => e.event === "done")

    expect(lineEvent).toBeDefined()
    expect(doneEvent).toBeDefined()
    expect(JSON.parse(doneEvent!.data)).toBe("0")
  })

  it("Test 5: returns 400 for invalid repo (injection attempt)", async () => {
    const { installSkill } = await import("@/lib/cae-skills-install")
    vi.mocked(installSkill).mockImplementation(() => {
      throw new Error("invalid repo: ;rm -rf /")
    })

    const { POST } = await import("./route")
    const req = new NextRequest("http://localhost/api/skills/install", {
      method: "POST",
      body: JSON.stringify({ repo: ";rm -rf /" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it("Test 5b: returns 400 when repo is missing from body", async () => {
    const { POST } = await import("./route")
    const req = new NextRequest("http://localhost/api/skills/install", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})
