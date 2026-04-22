import { describe, it, expect, vi } from "vitest"
import { installSkill } from "./cae-skills-install"
import { mockSpawn } from "../tests/helpers/spawn-mock"

describe("installSkill", () => {
  it("Test 1: yields line events then done:0 on success", async () => {
    const spawnMock = vi.fn().mockReturnValue(
      mockSpawn({
        stdout: ["Installing skill...\n", "Done!\n"],
        stderr: [],
        exitCode: 0,
      })
    )

    const events: Array<{ type: string; data: string }> = []
    for await (const ev of installSkill("vercel-labs/agent-skills", spawnMock)) {
      events.push(ev)
    }

    const lineEvents = events.filter((e) => e.type === "line")
    const doneEvent = events.find((e) => e.type === "done")

    expect(lineEvents.length).toBeGreaterThan(0)
    expect(doneEvent).toBeDefined()
    expect(doneEvent?.data).toBe("0")
  })

  it("Test 1b: spawn called with correct argv array (not shell string)", async () => {
    const spawnMock = vi.fn().mockReturnValue(
      mockSpawn({ stdout: [], exitCode: 0 })
    )

    // Consume iterator
    for await (const _ of installSkill("vercel-labs/agent-skills", spawnMock)) {
      // drain
    }

    expect(spawnMock).toHaveBeenCalledWith(
      "npx",
      ["-y", "skills", "add", "vercel-labs/agent-skills"],
      expect.objectContaining({
        env: expect.objectContaining({ SKILLS_TELEMETRY_DISABLED: "1" }),
      })
    )
    // Critically: options must NOT include shell:true
    const callOpts = spawnMock.mock.calls[0][2]
    expect(callOpts.shell).toBeFalsy()
  })

  it("Test 2: exitCode != 0 yields done with non-zero data + stderr as err events", async () => {
    const spawnMock = vi.fn().mockReturnValue(
      mockSpawn({
        stdout: ["partial output\n"],
        stderr: ["Error: package not found\n"],
        exitCode: 1,
      })
    )

    const events: Array<{ type: string; data: string }> = []
    for await (const ev of installSkill("bad-org/missing-skill", spawnMock)) {
      events.push(ev)
    }

    const doneEvent = events.find((e) => e.type === "done")
    expect(doneEvent?.data).toBe("1")

    const errEvents = events.filter((e) => e.type === "err")
    expect(errEvents.length).toBeGreaterThan(0)
  })

  it("Test injection: throws before spawn on invalid repo (semicolon injection)", async () => {
    const spawnMock = vi.fn()

    await expect(async () => {
      for await (const _ of installSkill(";rm -rf /", spawnMock)) {
        // should not reach here
      }
    }).rejects.toThrow(/invalid repo/)

    expect(spawnMock).not.toHaveBeenCalled()
  })

  it("Test injection: throws before spawn on pipe injection", async () => {
    const spawnMock = vi.fn()

    await expect(async () => {
      for await (const _ of installSkill("owner/repo | cat /etc/passwd", spawnMock)) {
        // nope
      }
    }).rejects.toThrow(/invalid repo/)
  })

  it("Test injection: accepts valid https github URL", async () => {
    const spawnMock = vi.fn().mockReturnValue(
      mockSpawn({ stdout: [], exitCode: 0 })
    )

    const events: Array<{ type: string; data: string }> = []
    for await (const ev of installSkill(
      "https://github.com/vercel-labs/agent-skills",
      spawnMock
    )) {
      events.push(ev)
    }

    expect(spawnMock).toHaveBeenCalled()
    expect(events.find((e) => e.type === "done")).toBeDefined()
  })
})
