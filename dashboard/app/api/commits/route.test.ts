/**
 * /api/commits route.test.ts — Class 15C.
 *
 * Coverage:
 *   1. Local git log parse produces shape {sha, shortSha, subject, author, ts}.
 *   2. GitHub REST fetch skipped without GITHUB_TOKEN → local-only result.
 *   3. Limit param clamps to [1, 50].
 *   4. git log failure → empty commits, 200 response.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Fake execFile that satisfies promisify(execFile) contract but never
// shells out. The `util.promisify.custom` symbol makes promisify use our
// return value directly instead of trying to adapt a (err, result) cb.
//
// This is cleaner than patching the callback form — promisify-detection
// short-circuits to our async function and the test controls the return
// value via execImpl.
type ExecCall = { cmd: string; args: string[] }
type ExecImpl = (call: ExecCall) => Promise<{ stdout: string; stderr: string }>
const execImpl: ReturnType<typeof vi.fn> & ExecImpl =
  vi.fn() as ReturnType<typeof vi.fn> & ExecImpl
const calls: ExecCall[] = []

vi.mock("node:child_process", async () => {
  const util = await import("node:util")
  const fake = (cmd: string, args: string[]) => {
    const call = { cmd, args }
    calls.push(call)
    return execImpl(call)
  }
  // promisify(fn) returns fn[util.promisify.custom] when set — make ours
  // `fake` itself since it's already promise-returning.
  ;(fake as unknown as Record<symbol, unknown>)[util.promisify.custom] = fake
  return {
    default: { execFile: fake },
    execFile: fake,
  }
})

vi.mock("@/lib/with-log", () => ({
  withLog: (handler: (...args: unknown[]) => unknown) => handler,
}))

import { NextRequest } from "next/server"
import { GET } from "./route"

const SEP = "\x1f"

function makeLogLine(
  sha: string,
  shortSha: string,
  iso: string,
  author: string,
  subject: string,
) {
  return [sha, shortSha, iso, author, subject].join(SEP)
}

beforeEach(() => {
  execImpl.mockReset()
  calls.length = 0
  delete process.env.GITHUB_TOKEN
})

afterEach(() => {
  vi.clearAllMocks()
})

function makeReq(url = "http://localhost/api/commits"): NextRequest {
  return new NextRequest(url, { method: "GET" })
}

describe("GET /api/commits (Class 15C)", () => {
  it("parses local git log into the commit row shape", async () => {
    execImpl.mockImplementation(async ({ cmd, args }) => {
      if (cmd === "git" && args[0] === "remote") {
        return { stdout: "git@github.com:foo/bar.git\n", stderr: "" }
      }
      if (cmd === "git" && args[0] === "log") {
        return {
          stdout:
            makeLogLine(
              "abcdef1234567890",
              "abcdef1",
              "2026-04-23T12:00:00Z",
              "Eric",
              "feat: ship",
            ) + "\n",
          stderr: "",
        }
      }
      return { stdout: "", stderr: "" }
    })

    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.commits).toHaveLength(1)
    expect(body.commits[0]).toMatchObject({
      sha: "abcdef1234567890",
      shortSha: "abcdef1",
      author: "Eric",
      subject: "feat: ship",
      source: "local",
    })
    expect(body.commits[0].url).toBe(
      "https://github.com/foo/bar/commit/abcdef1234567890",
    )
    expect(body.repo).toBe("https://github.com/foo/bar")
  })

  it("returns empty commits when git log fails", async () => {
    execImpl.mockImplementation(async ({ args }) => {
      if (args[0] === "remote") return { stdout: "", stderr: "" }
      if (args[0] === "log") throw new Error("not a git repo")
      return { stdout: "", stderr: "" }
    })

    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.commits).toEqual([])
  })

  it("clamps limit to the range [1, 50]", async () => {
    execImpl.mockImplementation(async () => ({ stdout: "", stderr: "" }))

    await GET(makeReq("http://localhost/api/commits?limit=9999"))
    const logCall1 = calls.find((c) => c.args[0] === "log")
    expect(logCall1).toBeDefined()
    // git log -n <limit> → args[1] is "-n", args[2] is the numeric limit.
    expect(logCall1!.args[1]).toBe("-n")
    expect(logCall1!.args[2]).toBe("50")

    calls.length = 0
    await GET(makeReq("http://localhost/api/commits?limit=0"))
    const logCall2 = calls.find((c) => c.args[0] === "log")
    expect(logCall2!.args[2]).toBe("1")
  })

  it("parses a plain https remote URL too", async () => {
    execImpl.mockImplementation(async ({ args }) => {
      if (args[0] === "remote") {
        return { stdout: "https://github.com/owner/repo\n", stderr: "" }
      }
      return {
        stdout:
          makeLogLine("sha1", "sha1", "2026-04-23T12:00:00Z", "A", "s") + "\n",
        stderr: "",
      }
    })
    const res = await GET(makeReq())
    const body = await res.json()
    expect(body.repo).toBe("https://github.com/owner/repo")
  })
})
