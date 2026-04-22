// RED-phase scaffold for Phase 10 plan 01. Fails until lib/cae-plan-home.ts lands in wave 1.

import { describe, it, expect, vi, beforeEach } from "vitest";

import { getPlanHomeState } from "./cae-plan-home";

// Mock cae-state so getPlanHomeState doesn't depend on the filesystem
vi.mock("./cae-state", () => ({
  listProjects: vi.fn(),
}));

import { listProjects } from "./cae-state";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPlanHomeState", () => {
  it("returns { projects, emptyState } shape", async () => {
    vi.mocked(listProjects).mockResolvedValue([
      {
        name: "my-project",
        path: "/home/cae/my-project",
        hasPlanning: true,
        shiftPhase: "prd",
        shiftUpdated: "2026-04-23T10:15:00Z",
      },
    ]);

    const result = await getPlanHomeState();
    expect(result).toHaveProperty("projects");
    expect(result).toHaveProperty("emptyState");
    expect(Array.isArray(result.projects)).toBe(true);
  });

  it("marks emptyState=true when no projects exist", async () => {
    vi.mocked(listProjects).mockResolvedValue([]);

    const result = await getPlanHomeState();
    expect(result.emptyState).toBe(true);
    expect(result.projects).toHaveLength(0);
  });

  it("attaches lifecycleBadge derived from shiftPhase", async () => {
    vi.mocked(listProjects).mockResolvedValue([
      {
        name: "my-project",
        path: "/home/cae/my-project",
        hasPlanning: true,
        shiftPhase: "prd",
        shiftUpdated: "2026-04-23T10:15:00Z",
      },
      {
        name: "other-project",
        path: "/home/cae/other-project",
        hasPlanning: false,
        shiftPhase: null,
        shiftUpdated: null,
      },
    ]);

    const result = await getPlanHomeState();
    const withShift = result.projects.find((p: { name: string }) => p.name === "my-project");
    expect(withShift?.lifecycleBadge).toBeDefined();
    expect(typeof withShift?.lifecycleBadge).toBe("string");
  });

  it("returns the mostRecentSlug for default project selection", async () => {
    vi.mocked(listProjects).mockResolvedValue([
      {
        name: "old-project",
        path: "/home/cae/old-project",
        hasPlanning: true,
        shiftPhase: "idea",
        shiftUpdated: "2026-04-22T08:00:00Z",
      },
      {
        name: "new-project",
        path: "/home/cae/new-project",
        hasPlanning: true,
        shiftPhase: "roadmap",
        shiftUpdated: "2026-04-23T10:30:00Z",
      },
    ]);

    const result = await getPlanHomeState();
    expect(result.mostRecentSlug).toBe("new-project");
  });
});
