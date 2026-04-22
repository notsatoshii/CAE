/**
 * spawn-mock.ts — vi-aware drop-in ChildProcess stub for tests.
 *
 * Returned object matches the subset of ChildProcess used by cae-skills.ts,
 * cae-schedule.ts, and cae-security-panel.ts:
 *   - .stdout: AsyncIterable<Buffer> (line-by-line via async generator)
 *   - .stderr: AsyncIterable<Buffer>
 *   - .on("close", cb) — fires on next microtask with exitCode
 *   - .kill() — no-op in tests
 *
 * Usage:
 *   vi.mock("child_process", () => ({
 *     spawn: vi.fn().mockReturnValue(mockSpawn({ stdout: ["line1\n"], exitCode: 0 }))
 *   }));
 */

type MockSpawnOpts = {
  stdout?: string[];
  stderr?: string[];
  exitCode?: number;
};

type CloseCallback = (code: number) => void;

export interface MockChildProcess {
  stdout: AsyncIterable<Buffer>;
  stderr: AsyncIterable<Buffer>;
  on(event: "close", cb: CloseCallback): this;
  on(event: string, cb: (...args: unknown[]) => void): this;
  kill(): void;
}

async function* toAsyncIterable(lines: string[]): AsyncIterable<Buffer> {
  for (const line of lines) {
    // Yield on next microtask so consumers get realistic async behaviour
    await Promise.resolve();
    yield Buffer.from(line);
  }
}

export function mockSpawn(opts: MockSpawnOpts = {}): MockChildProcess {
  const { stdout = [], stderr = [], exitCode = 0 } = opts;

  const closeHandlers: CloseCallback[] = [];

  const proc: MockChildProcess = {
    stdout: toAsyncIterable(stdout),
    stderr: toAsyncIterable(stderr),

    on(event: string, cb: (...args: unknown[]) => void): MockChildProcess {
      if (event === "close") {
        closeHandlers.push(cb as CloseCallback);
        // Fire on next microtask — after stdout/stderr are consumed
        queueMicrotask(() => {
          for (const handler of closeHandlers) {
            handler(exitCode);
          }
        });
      }
      return proc;
    },

    kill(): void {
      // no-op in tests
    },
  };

  return proc;
}
