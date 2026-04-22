import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Stub the allowlist so tests control the root set.
vi.mock("./cae-memory-sources", () => ({
  getAllowedRoots: vi.fn(async () => ["/allowed"]),
}));

import {
  searchMemory,
  __setExecFileForTests,
} from "./cae-memory-search";

type ExecFileStub = ReturnType<typeof vi.fn>;

let execFileMock: ExecFileStub;

function installResolve(stdout: string): void {
  execFileMock = vi.fn(async () => ({ stdout, stderr: "" }));
  __setExecFileForTests(execFileMock as unknown as Parameters<typeof __setExecFileForTests>[0]);
}

function installReject(code: number, stderr = ""): void {
  execFileMock = vi.fn(async () => {
    const err = new Error("rg exit " + code) as Error & {
      code?: number;
      stdout?: string;
      stderr?: string;
    };
    err.code = code;
    err.stdout = "";
    err.stderr = stderr;
    throw err;
  });
  __setExecFileForTests(execFileMock as unknown as Parameters<typeof __setExecFileForTests>[0]);
}

describe("searchMemory", () => {
  beforeEach(() => {
    execFileMock = vi.fn();
    __setExecFileForTests(execFileMock as unknown as Parameters<typeof __setExecFileForTests>[0]);
  });

  afterEach(() => {
    __setExecFileForTests(null);
  });

  it("returns [] for empty query without spawning", async () => {
    const hits = await searchMemory("");
    expect(hits).toEqual([]);
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("throws on overly long query (>200 chars)", async () => {
    const long = "x".repeat(201);
    await expect(searchMemory(long)).rejects.toThrow(/too long/i);
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("parses rg JSONL match events into SearchHits", async () => {
    const stdout = [
      JSON.stringify({ type: "begin", data: { path: { text: "/allowed/a.md" } } }),
      JSON.stringify({
        type: "match",
        data: {
          path: { text: "/allowed/a.md" },
          line_number: 7,
          lines: { text: "foo bar baz\n" },
        },
      }),
      JSON.stringify({
        type: "match",
        data: {
          path: { text: "/allowed/b.md" },
          line_number: 42,
          lines: { text: "another hit line" },
        },
      }),
      JSON.stringify({ type: "end", data: { path: { text: "/allowed/a.md" } } }),
    ].join("\n");

    installResolve(stdout);
    const hits = await searchMemory("bar", ["/allowed"]);
    expect(hits).toEqual([
      { file: "/allowed/a.md", line: 7, preview: "foo bar baz" },
      { file: "/allowed/b.md", line: 42, preview: "another hit line" },
    ]);
    // Verify execFile got the expected safe-spawn args
    const call = execFileMock.mock.calls[0];
    expect(call[0]).toBe("rg");
    expect(call[1]).toEqual(
      expect.arrayContaining([
        "--json",
        "--max-count=20",
        "--max-columns=200",
        "--glob=*.md",
        "--smart-case",
        "--",
        "bar",
        "/allowed",
      ]),
    );
    expect(call[2]).toMatchObject({ timeout: 5_000 });
  });

  it("treats rg exit code 1 (no match) as empty array", async () => {
    installReject(1);
    const hits = await searchMemory("needle", ["/allowed"]);
    expect(hits).toEqual([]);
  });

  it("re-throws rg exit code 2 (genuine error)", async () => {
    installReject(2, "regex parse error");
    await expect(searchMemory("bad(", ["/allowed"])).rejects.toThrow();
  });

  it("intersects caller roots with the allowlist (unknown root → empty)", async () => {
    // Allowed is ["/allowed"]; caller requests a non-allowed root →
    // intersection is empty → function returns [] without spawning.
    const hits = await searchMemory("q", ["/not-allowed"]);
    expect(hits).toEqual([]);
    expect(execFileMock).not.toHaveBeenCalled();
  });
});
