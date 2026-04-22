/**
 * build-index.test.ts — PAL-02 fallback + D-04
 *
 * Tests 5-source Promise.allSettled orchestration, group ordering,
 * resilience to source failures, and id de-duplication.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildPaletteIndex } from "./build-index";
import * as indexSources from "./index-sources";
import type { PaletteItem, PaletteGroupKey } from "./types";
import type { PaletteSourceContext } from "./index-sources";
import type { BuildIndexToggles } from "./build-index";

const mockRouter = { push: vi.fn() };
const mockClose = vi.fn();
const ctx: PaletteSourceContext = { router: mockRouter, close: mockClose };
const toggles: BuildIndexToggles = {
  toggleExplain: vi.fn(),
  toggleDev: vi.fn(),
  openShortcuts: vi.fn(),
};

function makeItem(id: string, group: PaletteGroupKey): PaletteItem {
  return { id, group, label: id, hint: "", run: () => {} };
}

describe("buildPaletteIndex", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns items in PALETTE_GROUP_ORDER when all sources resolve", async () => {
    vi.spyOn(indexSources, "fetchProjectItems").mockResolvedValue([makeItem("project:a", "projects")]);
    vi.spyOn(indexSources, "fetchTaskItems").mockResolvedValue([makeItem("task:b", "tasks")]);
    vi.spyOn(indexSources, "fetchAgentItems").mockResolvedValue([makeItem("agent:c", "agents")]);
    vi.spyOn(indexSources, "fetchWorkflowItems").mockResolvedValue([makeItem("workflow:d", "workflows")]);
    vi.spyOn(indexSources, "fetchMemoryItems").mockResolvedValue([makeItem("memory:e", "memory")]);
    vi.spyOn(indexSources, "staticCommandItems").mockReturnValue([makeItem("cmd:test", "commands")]);

    const items = await buildPaletteIndex(ctx, toggles);

    // verify all groups present
    const groups = [...new Set(items.map((i) => i.group))];
    expect(groups).toContain("projects");
    expect(groups).toContain("tasks");
    expect(groups).toContain("agents");
    expect(groups).toContain("workflows");
    expect(groups).toContain("memory");
    expect(groups).toContain("commands");

    // verify order: all projects come before tasks, tasks before agents, etc.
    const projectIdx = items.findIndex((i) => i.group === "projects");
    const taskIdx = items.findIndex((i) => i.group === "tasks");
    const agentIdx = items.findIndex((i) => i.group === "agents");
    const workflowIdx = items.findIndex((i) => i.group === "workflows");
    const memoryIdx = items.findIndex((i) => i.group === "memory");
    const commandIdx = items.findIndex((i) => i.group === "commands");

    expect(projectIdx).toBeLessThan(taskIdx);
    expect(taskIdx).toBeLessThan(agentIdx);
    expect(agentIdx).toBeLessThan(workflowIdx);
    expect(workflowIdx).toBeLessThan(memoryIdx);
    expect(memoryIdx).toBeLessThan(commandIdx);
  });

  it("excludes projects group and logs warning when fetchProjectItems rejects", async () => {
    vi.spyOn(indexSources, "fetchProjectItems").mockRejectedValue(new Error("projects fetch fail"));
    vi.spyOn(indexSources, "fetchTaskItems").mockResolvedValue([makeItem("task:b", "tasks")]);
    vi.spyOn(indexSources, "fetchAgentItems").mockResolvedValue([makeItem("agent:c", "agents")]);
    vi.spyOn(indexSources, "fetchWorkflowItems").mockResolvedValue([makeItem("workflow:d", "workflows")]);
    vi.spyOn(indexSources, "fetchMemoryItems").mockResolvedValue([makeItem("memory:e", "memory")]);
    vi.spyOn(indexSources, "staticCommandItems").mockReturnValue([makeItem("cmd:test", "commands")]);

    const items = await buildPaletteIndex(ctx, toggles);

    // projects must be absent
    expect(items.some((i) => i.group === "projects")).toBe(false);
    // other groups still present
    expect(items.some((i) => i.group === "tasks")).toBe(true);
    expect(items.some((i) => i.group === "commands")).toBe(true);

    // console.warn must have been called with "projects" in message
    const warnCalls = (console.warn as ReturnType<typeof vi.fn>).mock.calls;
    const hasProjectsWarn = warnCalls.some((args: unknown[]) =>
      args.some((a) => typeof a === "string" && a.includes("projects"))
    );
    expect(hasProjectsWarn).toBe(true);
  });

  it("returns only commands when all 5 fetch sources reject", async () => {
    vi.spyOn(indexSources, "fetchProjectItems").mockRejectedValue(new Error("fail"));
    vi.spyOn(indexSources, "fetchTaskItems").mockRejectedValue(new Error("fail"));
    vi.spyOn(indexSources, "fetchAgentItems").mockRejectedValue(new Error("fail"));
    vi.spyOn(indexSources, "fetchWorkflowItems").mockRejectedValue(new Error("fail"));
    vi.spyOn(indexSources, "fetchMemoryItems").mockRejectedValue(new Error("fail"));
    vi.spyOn(indexSources, "staticCommandItems").mockReturnValue([makeItem("cmd:test", "commands")]);

    const items = await buildPaletteIndex(ctx, toggles);
    expect(items.every((i) => i.group === "commands")).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });

  it("never throws even when every source throws", async () => {
    vi.spyOn(indexSources, "fetchProjectItems").mockRejectedValue(new Error("fail"));
    vi.spyOn(indexSources, "fetchTaskItems").mockRejectedValue(new Error("fail"));
    vi.spyOn(indexSources, "fetchAgentItems").mockRejectedValue(new Error("fail"));
    vi.spyOn(indexSources, "fetchWorkflowItems").mockRejectedValue(new Error("fail"));
    vi.spyOn(indexSources, "fetchMemoryItems").mockRejectedValue(new Error("fail"));

    await expect(buildPaletteIndex(ctx, toggles)).resolves.toBeTruthy();
  });

  it("de-duplicates items by id (last writer wins)", async () => {
    const dupItem1 = makeItem("project:dup", "projects");
    const dupItem2 = { ...makeItem("project:dup", "projects"), label: "REPLACED" };
    vi.spyOn(indexSources, "fetchProjectItems").mockResolvedValue([dupItem1]);
    vi.spyOn(indexSources, "fetchTaskItems").mockResolvedValue([dupItem2]);
    vi.spyOn(indexSources, "fetchAgentItems").mockResolvedValue([]);
    vi.spyOn(indexSources, "fetchWorkflowItems").mockResolvedValue([]);
    vi.spyOn(indexSources, "fetchMemoryItems").mockResolvedValue([]);
    vi.spyOn(indexSources, "staticCommandItems").mockReturnValue([]);

    const items = await buildPaletteIndex(ctx, toggles);
    const dupItems = items.filter((i) => i.id === "project:dup");
    expect(dupItems.length).toBe(1);
    expect(dupItems[0].label).toBe("REPLACED");
  });
});
