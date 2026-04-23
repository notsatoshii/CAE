import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";

// Shared state for the hoisted mock factory to push into.
const mockState = vi.hoisted(() => ({
  spawnArgs: [] as Array<{ cmd: string; args: string[]; opts: unknown }>,
}));

// Mock child_process at the top of the file (vi.mock is hoisted above all
// imports). We enumerate every export chat-spawn.ts could touch rather than
// spreading `...actual` — vitest's spread merge has been observed to clobber
// the `spawn` override in this setup, leaving the real binary in place and
// the test silently passing OR timing out.
vi.mock("child_process", () => {
  const mockSpawn = (cmd: string, args: string[], opts: unknown) => {
    mockState.spawnArgs.push({ cmd, args, opts });
    // Minimal ChildProcess-like shape. chat-spawn.ts only uses stdin (write,
    // end), stdout/stderr (no handlers attached in the SUT's own module; the
    // route's start() attaches `.on('data')` handlers but those are outside
    // this test's scope), kill, and `.on('exit' | 'error')`.
    const ee: EventEmitter & {
      stdin: { write: (s: string) => void; end: () => void };
      stdout: { on: (...a: unknown[]) => void; pipe: (...a: unknown[]) => void };
      stderr: { on: (...a: unknown[]) => void; pipe: (...a: unknown[]) => void };
      kill: (sig?: string) => void;
    } = Object.assign(new EventEmitter(), {
      stdin: {
        write: () => undefined,
        end: () => undefined,
      },
      stdout: { on: () => undefined, pipe: () => undefined },
      stderr: { on: () => undefined, pipe: () => undefined },
      kill: () => undefined,
    });
    // Fire exit on a macrotask so the SUT's `.on("exit", ...)` handler is
    // attached before the event is emitted.
    setImmediate(() => ee.emit("exit", 0));
    return ee;
  };
  return {
    spawn: mockSpawn,
    default: { spawn: mockSpawn },
    exec: () => undefined,
    execFile: () => undefined,
    execFileSync: () => Buffer.from(""),
    execSync: () => Buffer.from(""),
    fork: () => undefined,
    spawnSync: () => ({
      status: 0,
      stdout: Buffer.from(""),
      stderr: Buffer.from(""),
    }),
    ChildProcess: class {},
  };
});

// Import AFTER the mock is registered.
import { spawnClaudeChat } from "./chat-spawn";

describe("spawnClaudeChat — Class-18 root/sudo wrapper", () => {
  beforeEach(() => {
    mockState.spawnArgs.length = 0;
  });

  it("invokes `sudo -u cae -E env HOME=/home/cae claude ...` with the CLI flags", async () => {
    const handle = spawnClaudeChat({
      sessionId: "abc123-session",
      voiceFile: "/home/cae/ctrl-alt-elite/dashboard/docs/voices/nexus.md",
      model: "claude-opus-4-7",
      messageText: "hello",
      cwd: "/home/cae/ctrl-alt-elite",
    });
    await handle.wait();

    expect(mockState.spawnArgs).toHaveLength(1);
    const call = mockState.spawnArgs[0];

    // The CRITICAL invariant: the command is `sudo`, not `claude`.
    expect(call.cmd).toBe("sudo");

    // The first six argv entries must drop to cae with HOME override.
    expect(call.args.slice(0, 6)).toEqual([
      "-u",
      "cae",
      "-E",
      "env",
      "HOME=/home/cae",
      "claude",
    ]);

    // The claude CLI flags follow in order after the sudo prefix.
    expect(call.args.slice(6)).toEqual([
      "--print",
      "--resume",
      "abc123-session",
      "--append-system-prompt-file",
      "/home/cae/ctrl-alt-elite/dashboard/docs/voices/nexus.md",
      "--output-format",
      "stream-json",
      "--include-partial-messages",
      "--model",
      "claude-opus-4-7",
    ]);
  });

  it("preserves cwd = CAE_ROOT (required so --resume finds the session jsonl)", async () => {
    const handle = spawnClaudeChat({
      sessionId: "sid",
      voiceFile: "/tmp/voice.md",
      model: "claude-sonnet-4-6",
      messageText: "msg",
      cwd: "/home/cae/ctrl-alt-elite",
    });
    await handle.wait();

    expect(mockState.spawnArgs).toHaveLength(1);
    const opts = mockState.spawnArgs[0].opts as { cwd: string };
    expect(opts.cwd).toBe("/home/cae/ctrl-alt-elite");
  });
});
