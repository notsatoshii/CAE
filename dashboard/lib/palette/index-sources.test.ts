/**
 * index-sources.test.ts — PAL-02
 *
 * Tests each fetch*Items function against mocked fetch responses.
 * Verifies shape, group tags, error rejection, and static commands.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchProjectItems,
  fetchTaskItems,
  fetchAgentItems,
  fetchWorkflowItems,
  fetchMemoryItems,
  staticCommandItems,
  type PaletteSourceContext,
} from "./index-sources";

const mockRouter = { push: vi.fn() };
const mockClose = vi.fn();
const ctx: PaletteSourceContext = { router: mockRouter, close: mockClose };

// Minimal valid API response shapes
const STATE_RESPONSE = {
  home_phases: [{ project: "cae-dashboard", projectName: "CAE Dashboard" }],
  phases: [{ number: 1, name: "Foundation", status: "done", planFiles: [] }],
};

const QUEUE_RESPONSE = {
  columns: {
    waiting: [{ taskId: "task-001", title: "Fix bug", agent: "forge", project: "cae", status: "waiting", ts: 1 , tags: [] }],
    in_progress: [{ taskId: "task-002", title: "Add feature", agent: "forge", project: "cae", status: "in_progress", ts: 2, tags: ["phase:03"] }],
    double_checking: [],
    stuck: [],
    shipped: [],
  },
};

const AGENTS_RESPONSE = {
  agents: [
    { name: "forge", label: "Forge", founder_label: "Builder", emoji: "🔨", color: "#f00", model: "claude-3", group: "active", last_run_days_ago: 1, stats_7d: { tokens_per_hour: [], tokens_total: 0, success_rate: 1, success_history: [], avg_wall_ms: 0, wall_history: [] }, current: { concurrent: 0, queued: 0, last_24h_count: 0 }, drift_warning: false },
    { name: "sentinel", label: "Sentinel", founder_label: "Checker", emoji: "👁", color: "#0f0", model: "claude-3", group: "recently_used", last_run_days_ago: 3, stats_7d: { tokens_per_hour: [], tokens_total: 0, success_rate: 0.9, success_history: [], avg_wall_ms: 0, wall_history: [] }, current: { concurrent: 0, queued: 0, last_24h_count: 0 }, drift_warning: false },
  ],
};

const WORKFLOWS_RESPONSE = {
  workflows: [
    { slug: "my-workflow", name: "My Workflow", description: "Does things", mtime: 1, spec: { name: "My Workflow", steps: [] }, yaml: "" },
  ],
};

const MEMORY_RESPONSE = {
  projects: [
    {
      id: "project:cae-dashboard",
      label: "CAE Dashboard",
      kind: "project",
      children: [
        { id: "group:planning", label: "Planning", kind: "group", children: [
          { id: ".planning/phases/01/01-PLAN.md", label: "01-PLAN.md", kind: "file", absPath: "/home/cae/.planning/phases/01/01-PLAN.md" },
        ]},
      ],
    },
  ],
};

function mockFetch(data: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

describe("fetchProjectItems", () => {
  it("maps /api/state home_phases to group=projects items", async () => {
    vi.stubGlobal("fetch", mockFetch(STATE_RESPONSE));
    const items = await fetchProjectItems(ctx);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.group).toBe("projects");
      expect(item.id.startsWith("project:")).toBe(true);
      expect(item.hint).toBeDefined();
    }
  });

  it("rejects with error including endpoint path on non-OK response", async () => {
    vi.stubGlobal("fetch", mockFetch({}, 500));
    await expect(fetchProjectItems(ctx)).rejects.toThrow(/\/api\/state/);
  });

  it("propagates fetch throw without swallowing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    await expect(fetchProjectItems(ctx)).rejects.toThrow("network error");
  });
});

describe("fetchTaskItems", () => {
  it("maps /api/queue tasks to group=tasks items", async () => {
    vi.stubGlobal("fetch", mockFetch(QUEUE_RESPONSE));
    const items = await fetchTaskItems(ctx);
    expect(items.length).toBeGreaterThanOrEqual(2); // waiting + in_progress
    for (const item of items) {
      expect(item.group).toBe("tasks");
      expect(item.id.startsWith("task:")).toBe(true);
    }
  });

  it("rejects with error including endpoint path on non-OK response", async () => {
    vi.stubGlobal("fetch", mockFetch({}, 500));
    await expect(fetchTaskItems(ctx)).rejects.toThrow(/\/api\/queue/);
  });
});

describe("fetchAgentItems", () => {
  it("maps /api/agents to group=agents items", async () => {
    vi.stubGlobal("fetch", mockFetch(AGENTS_RESPONSE));
    const items = await fetchAgentItems(ctx);
    expect(items.length).toBe(2);
    for (const item of items) {
      expect(item.group).toBe("agents");
      expect(item.id.startsWith("agent:")).toBe(true);
    }
  });

  it("rejects with error including endpoint path on non-OK response", async () => {
    vi.stubGlobal("fetch", mockFetch({}, 500));
    await expect(fetchAgentItems(ctx)).rejects.toThrow(/\/api\/agents/);
  });
});

describe("fetchWorkflowItems", () => {
  it("maps /api/workflows to group=workflows items", async () => {
    vi.stubGlobal("fetch", mockFetch(WORKFLOWS_RESPONSE));
    const items = await fetchWorkflowItems(ctx);
    expect(items.length).toBe(1);
    expect(items[0].group).toBe("workflows");
    expect(items[0].id).toBe("workflow:my-workflow");
    expect(items[0].label).toBe("My Workflow");
  });

  it("rejects with error including endpoint path on non-OK response", async () => {
    vi.stubGlobal("fetch", mockFetch({}, 500));
    await expect(fetchWorkflowItems(ctx)).rejects.toThrow(/\/api\/workflows/);
  });
});

describe("fetchMemoryItems", () => {
  it("maps /api/memory/tree nodes to group=memory items", async () => {
    vi.stubGlobal("fetch", mockFetch(MEMORY_RESPONSE));
    const items = await fetchMemoryItems(ctx);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.group).toBe("memory");
      expect(item.id.startsWith("memory:")).toBe(true);
    }
  });

  it("rejects with error including endpoint path on non-OK response", async () => {
    vi.stubGlobal("fetch", mockFetch({}, 500));
    await expect(fetchMemoryItems(ctx)).rejects.toThrow(/\/api\/memory\/tree/);
  });
});

describe("staticCommandItems", () => {
  it("returns non-empty array with required command IDs", () => {
    const items = staticCommandItems(ctx);
    expect(items.length).toBeGreaterThan(0);

    const ids = items.map((i) => i.id);
    expect(ids).toContain("cmd:goto-home");
    expect(ids).toContain("cmd:goto-build");
    expect(ids).toContain("cmd:goto-plan");
    expect(ids).toContain("cmd:toggle-explain");
    expect(ids).toContain("cmd:toggle-dev");
    expect(ids).toContain("cmd:open-shortcuts");
    expect(ids).toContain("cmd:regenerate-memory");
  });

  it("all items have group=commands and non-empty label", () => {
    const items = staticCommandItems(ctx);
    for (const item of items) {
      expect(item.group).toBe("commands");
      expect(item.label.length).toBeGreaterThan(0);
    }
  });
});
