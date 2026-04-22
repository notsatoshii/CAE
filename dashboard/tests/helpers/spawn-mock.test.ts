/**
 * spawn-mock.test.ts — verifies the MockChildProcess helper works as expected.
 *
 * Tests:
 * 1. stdout is async-iterable and yields all provided lines as Buffers
 * 2. "close" event fires with the specified exit code after iteration
 */

import { describe, it, expect, vi } from "vitest";
import { mockSpawn } from "./spawn-mock";

describe("mockSpawn", () => {
  it("1. stdout is async-iterable and yields lines as Buffers", async () => {
    const proc = mockSpawn({ stdout: ["line one\n", "line two\n"], exitCode: 0 });
    const lines: string[] = [];
    for await (const chunk of proc.stdout) {
      lines.push(chunk.toString());
    }
    expect(lines).toEqual(["line one\n", "line two\n"]);
  });

  it("2. close event fires with specified exit code", async () => {
    const closeSpy = vi.fn();
    const proc = mockSpawn({ stdout: ["output\n"], exitCode: 42 });

    proc.on("close", closeSpy);

    // Let microtasks drain
    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    expect(closeSpy).toHaveBeenCalledWith(42);
  });
});
