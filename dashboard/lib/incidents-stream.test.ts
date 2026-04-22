/**
 * lib/incidents-stream.test.ts
 *
 * Tests for tailJsonl + filterLevel. Uses tmp files to avoid mocking fs.
 * All tests are async (file I/O).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { tailJsonl, filterLevel, type LogLine } from "./incidents-stream";

// Helper: write lines to a file, return path
function writeTmp(lines: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "incidents-test-"));
  const file = path.join(dir, "test.log.jsonl");
  fs.writeFileSync(file, lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
  return file;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

describe("filterLevel", () => {
  it('filterLevel("warn") passes warn, error, fatal; blocks info, debug', () => {
    const f = filterLevel("warn");
    expect(f({ level: "warn", time: 0, msg: "x" })).toBe(true);
    expect(f({ level: "error", time: 0, msg: "x" })).toBe(true);
    expect(f({ level: "fatal", time: 0, msg: "x" })).toBe(true);
    expect(f({ level: "info", time: 0, msg: "x" })).toBe(false);
    expect(f({ level: "debug", time: 0, msg: "x" })).toBe(false);
  });

  it('filterLevel("error") passes only error + fatal', () => {
    const f = filterLevel("error");
    expect(f({ level: "error", time: 0, msg: "x" })).toBe(true);
    expect(f({ level: "fatal", time: 0, msg: "x" })).toBe(true);
    expect(f({ level: "warn", time: 0, msg: "x" })).toBe(false);
    expect(f({ level: "info", time: 0, msg: "x" })).toBe(false);
  });
});

describe("tailJsonl – history", () => {
  it("emits last-N warn lines from file, skips info lines", async () => {
    const lines = [
      JSON.stringify({ level: "warn", time: 1, msg: "w1" }),
      JSON.stringify({ level: "info", time: 2, msg: "i1" }),
      JSON.stringify({ level: "warn", time: 3, msg: "w2" }),
      JSON.stringify({ level: "error", time: 4, msg: "e1" }),
      JSON.stringify({ level: "info", time: 5, msg: "i2" }),
    ];
    const file = writeTmp(lines);
    const received: LogLine[] = [];
    const ac = new AbortController();

    const close = await tailJsonl(file, {
      filter: filterLevel("warn"),
      historyLimit: 50,
      signal: ac.signal,
      onLine: (l) => received.push(l),
    });

    // Allow history flush (synchronous in impl, but give a tick)
    await sleep(50);
    ac.abort();
    close();

    expect(received.map((l) => l.msg)).toEqual(["w1", "w2", "e1"]);
  });

  it("respects historyLimit — emits only last N matching lines", async () => {
    const lines: string[] = [];
    for (let i = 0; i < 10; i++) {
      lines.push(JSON.stringify({ level: "warn", time: i, msg: `w${i}` }));
    }
    const file = writeTmp(lines);
    const received: LogLine[] = [];
    const ac = new AbortController();

    const close = await tailJsonl(file, {
      filter: filterLevel("warn"),
      historyLimit: 3,
      signal: ac.signal,
      onLine: (l) => received.push(l),
    });

    await sleep(50);
    ac.abort();
    close();

    expect(received).toHaveLength(3);
    expect(received[received.length - 1].msg).toBe("w9");
  });
});

describe("tailJsonl – real-time tail", () => {
  it("fires handler when a new warn line is appended after open", async () => {
    const file = writeTmp([]); // start empty
    const received: LogLine[] = [];
    const ac = new AbortController();

    const close = await tailJsonl(file, {
      filter: filterLevel("warn"),
      signal: ac.signal,
      onLine: (l) => received.push(l),
    });

    // Append a warn line after the watcher is set up
    await sleep(100);
    fs.appendFileSync(file, JSON.stringify({ level: "warn", time: 99, msg: "new-warn" }) + "\n");

    // Wait for poll interval (500ms) + buffer
    await sleep(700);

    ac.abort();
    close();

    expect(received.some((l) => l.msg === "new-warn")).toBe(true);
  });

  it("ignores info lines appended during tail", async () => {
    const file = writeTmp([]);
    const received: LogLine[] = [];
    const ac = new AbortController();

    const close = await tailJsonl(file, {
      filter: filterLevel("warn"),
      signal: ac.signal,
      onLine: (l) => received.push(l),
    });

    await sleep(100);
    fs.appendFileSync(file, JSON.stringify({ level: "info", time: 1, msg: "skip-me" }) + "\n");

    await sleep(700);
    ac.abort();
    close();

    expect(received).toHaveLength(0);
  });
});

describe("tailJsonl – error resilience", () => {
  it("skips malformed (non-JSON) lines without crashing", async () => {
    const file = writeTmp([
      JSON.stringify({ level: "warn", time: 1, msg: "before" }),
      "not json at all !!!",
      JSON.stringify({ level: "error", time: 2, msg: "after" }),
    ]);
    const received: LogLine[] = [];
    const ac = new AbortController();

    const close = await tailJsonl(file, {
      filter: filterLevel("warn"),
      signal: ac.signal,
      onLine: (l) => received.push(l),
    });

    await sleep(100);
    ac.abort();
    close();

    expect(received.map((l) => l.msg)).toEqual(["before", "after"]);
  });

  it("does not crash when file does not exist", async () => {
    const received: LogLine[] = [];
    const ac = new AbortController();

    const close = await tailJsonl("/tmp/definitely-does-not-exist-xyzzy.jsonl", {
      filter: filterLevel("warn"),
      signal: ac.signal,
      onLine: (l) => received.push(l),
    });

    await sleep(100);
    ac.abort();
    close();

    expect(received).toHaveLength(0);
  });

  it("stops firing after close() is called", async () => {
    const file = writeTmp([]);
    const received: LogLine[] = [];
    const ac = new AbortController();

    const close = await tailJsonl(file, {
      filter: filterLevel("warn"),
      signal: ac.signal,
      onLine: (l) => received.push(l),
    });

    // Close immediately
    close();

    // Append after close — should NOT fire
    await sleep(100);
    fs.appendFileSync(file, JSON.stringify({ level: "warn", time: 5, msg: "after-close" }) + "\n");
    await sleep(700);

    expect(received.filter((l) => l.msg === "after-close")).toHaveLength(0);
  });
});
