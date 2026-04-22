import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock listProjects to point at per-test temp dirs.
// `tailJsonl` stays real so we exercise the actual jsonl-reading path.
vi.mock("./cae-state", async (orig) => {
  const actual = (await orig()) as typeof import("./cae-state");
  return {
    ...actual,
    listProjects: vi.fn(),
  };
});

import {
  getMemoryConsultEntries,
  __clearMemoryConsultCacheForTests,
} from "./cae-memory-consult";
import { listProjects } from "./cae-state";

describe("getMemoryConsultEntries", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "memconsult-"));
    __clearMemoryConsultCacheForTests();
    (listProjects as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  function seedProject(name: string, lines: string[]): string {
    const root = join(tmp, name);
    mkdirSync(join(root, ".cae", "metrics"), { recursive: true });
    writeFileSync(
      join(root, ".cae", "metrics", "memory-consult.jsonl"),
      lines.join("\n") + (lines.length ? "\n" : ""),
    );
    return root;
  }

  it("returns found=false when no rows match task id", async () => {
    const p = seedProject("a", [
      JSON.stringify({
        ts: "2026-04-22T00:00:00Z",
        event: "memory_consult",
        source_path: "/x/AGENTS.md",
        task_id: "other-task",
      }),
    ]);
    (listProjects as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: "a", path: p, hasPlanning: false },
    ]);
    const r = await getMemoryConsultEntries("needle");
    expect(r.found).toBe(false);
    expect(r.entries).toEqual([]);
    expect(r.task_id).toBe("needle");
  });

  it("aggregates across projects + dedupes by source_path", async () => {
    const p1 = seedProject("a", [
      JSON.stringify({
        ts: "2026-04-22T00:00:00Z",
        event: "memory_consult",
        source_path: "/x/AGENTS.md",
        task_id: "t1",
      }),
      JSON.stringify({
        ts: "2026-04-22T01:00:00Z",
        event: "memory_consult",
        source_path: "/x/AGENTS.md",
        task_id: "t1",
      }),
    ]);
    const p2 = seedProject("b", [
      JSON.stringify({
        ts: "2026-04-22T02:00:00Z",
        event: "memory_consult",
        source_path: "/y/KNOWLEDGE/n.md",
        task_id: "t1",
      }),
    ]);
    (listProjects as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: "a", path: p1, hasPlanning: false },
      { name: "b", path: p2, hasPlanning: false },
    ]);
    const r = await getMemoryConsultEntries("t1");
    expect(r.found).toBe(true);
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0].source_path).toBe("/x/AGENTS.md");
    expect(r.entries[0].ts).toBe("2026-04-22T01:00:00Z"); // latest of the two duplicates
    expect(r.entries[1].source_path).toBe("/y/KNOWLEDGE/n.md");
  });

  it("ignores malformed rows + non-memory_consult events", async () => {
    const p = seedProject("a", [
      "not json",
      JSON.stringify({
        ts: "2026-04-22T00:00:00Z",
        event: "forge_begin",
        task_id: "t1",
      }),
      JSON.stringify({
        ts: "2026-04-22T01:00:00Z",
        event: "memory_consult",
        source_path: "/x.md" /* missing task_id */,
      }),
      JSON.stringify({
        ts: "2026-04-22T02:00:00Z",
        event: "memory_consult",
        source_path: "/x/AGENTS.md",
        task_id: "t1",
      }),
    ]);
    (listProjects as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: "a", path: p, hasPlanning: false },
    ]);
    const r = await getMemoryConsultEntries("t1");
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].source_path).toBe("/x/AGENTS.md");
  });

  it("caches within TTL", async () => {
    const p = seedProject("a", [
      JSON.stringify({
        ts: "2026-04-22T00:00:00Z",
        event: "memory_consult",
        source_path: "/x/AGENTS.md",
        task_id: "t1",
      }),
    ]);
    const mock = listProjects as unknown as ReturnType<typeof vi.fn>;
    mock.mockResolvedValue([{ name: "a", path: p, hasPlanning: false }]);
    await getMemoryConsultEntries("t1");
    await getMemoryConsultEntries("t1");
    expect(mock).toHaveBeenCalledTimes(1);
  });

  // `rmSync` cleanup — vitest doesn't parallelize files by default in CI,
  // so letting the tmp dirs age out is acceptable, but we do a best-effort
  // cleanup here to keep tmpdir tidy.
  afterAll(() => {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  });
});
