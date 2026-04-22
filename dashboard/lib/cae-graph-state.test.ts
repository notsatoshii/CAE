import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Stub cae-state.listProjects so regenerateGraph walks our temp project.
vi.mock("./cae-state", async (orig) => {
  const actual = (await orig()) as typeof import("./cae-state");
  return {
    ...actual,
    listProjects: vi.fn(),
  };
});

import {
  classifyNode,
  loadGraph,
  regenerateGraph,
  __resetCooldownForTests,
  type GraphPayload,
} from "./cae-graph-state";
import { listProjects } from "./cae-state";
import { __resetAllowedRootsCacheForTests } from "./cae-memory-sources";

const ORIGINAL_CAE_ROOT = process.env.CAE_ROOT;
let rootsToCleanup: string[] = [];

function seedCaeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "graphstate-"));
  rootsToCleanup.push(root);
  process.env.CAE_ROOT = root;
  return root;
}

describe("classifyNode", () => {
  it.each([
    [
      "/home/cae/proj/.planning/phases/08-memory/08-PLAN.md",
      "phases",
    ],
    ["/home/cae/proj/agents/cae-arch.md", "agents"],
    ["/home/cae/proj/.claude/agents/reviewer.md", "agents"],
    ["/home/cae/proj/docs/PRD.md", "PRDs"],
    ["/home/cae/proj/docs/ui-spec.md", "PRDs"],
    ["/home/cae/proj/ROADMAP.md", "PRDs"],
    ["/home/cae/proj/KNOWLEDGE/intro.md", "notes"],
    ["/home/cae/proj/AGENTS.md", "notes"],
    ["/home/cae/proj/random.md", "notes"],
  ])("classifies %s as %s", (id, expected) => {
    expect(classifyNode({ id })).toBe(expected);
  });

  it("never returns 'commits' — D-04 says commits nodes are OFF", () => {
    const hex40 = "a".repeat(40);
    const kind = classifyNode({ id: hex40 });
    expect(kind).not.toBe("commits");
  });
});

describe("loadGraph", () => {
  beforeEach(() => {
    __resetCooldownForTests();
    __resetAllowedRootsCacheForTests();
    (listProjects as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it("returns null when .cae/graph.json is missing", async () => {
    seedCaeRoot();
    const payload = await loadGraph();
    expect(payload).toBeNull();
  });

  it("reads, classifies, and shapes a crafted graph.json fixture", async () => {
    const caeRoot = seedCaeRoot();
    mkdirSync(join(caeRoot, ".cae"), { recursive: true });
    const fixture = {
      nodes: [
        {
          id: "/home/cae/proj/.planning/phases/08-memory/08-PLAN.md",
          label: "Phase 8 Plan",
          source_file: "/home/cae/proj/.planning/phases/08-memory/08-PLAN.md",
        },
        {
          id: "/home/cae/proj/agents/cae-arch.md",
          label: "cae-arch",
          source_file: "/home/cae/proj/agents/cae-arch.md",
        },
      ],
      links: [
        {
          source: "/home/cae/proj/.planning/phases/08-memory/08-PLAN.md",
          target: "/home/cae/proj/agents/cae-arch.md",
          relation: "markdown_link",
          confidence: "EXTRACTED",
        },
      ],
      generated_at: "2026-04-22T12:00:00Z",
    };
    writeFileSync(
      join(caeRoot, ".cae", "graph.json"),
      JSON.stringify(fixture),
      "utf8",
    );
    const payload = (await loadGraph()) as GraphPayload;
    expect(payload).not.toBeNull();
    expect(payload.nodes).toHaveLength(2);
    expect(payload.nodes.find((n) => n.kind === "phases")).toBeTruthy();
    expect(payload.nodes.find((n) => n.kind === "agents")).toBeTruthy();
    expect(payload.links).toHaveLength(1);
    expect(payload.links[0].relation).toBe("markdown_link");
    expect(payload.truncated).toBe(false);
    expect(payload.total_nodes).toBe(2);
    expect(payload.generated_at).toBe("2026-04-22T12:00:00Z");
  });
});

describe("regenerateGraph", () => {
  beforeEach(() => {
    __resetCooldownForTests();
    __resetAllowedRootsCacheForTests();
    (listProjects as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it("walks memory sources, extracts markdown + at-ref edges, writes .cae/graph.json", async () => {
    const caeRoot = seedCaeRoot();
    // Seed memory sources inside caeRoot so walker picks them up.
    const agentsPath = join(caeRoot, "AGENTS.md");
    writeFileSync(
      agentsPath,
      "# Agents\n\nSee [arch](./agents/cae-arch.md) and @agents/cae-scout.md for details.\n",
    );
    mkdirSync(join(caeRoot, "agents"), { recursive: true });
    writeFileSync(
      join(caeRoot, "agents", "cae-arch.md"),
      "# cae-arch\n\nReferenced by AGENTS.md\n",
    );
    writeFileSync(
      join(caeRoot, "agents", "cae-scout.md"),
      "# cae-scout\n\nReferenced via at-ref\n",
    );

    (listProjects as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: "proj", path: caeRoot, hasPlanning: false },
    ]);

    const result = await regenerateGraph();
    expect(result.ok).toBe(true);
    expect(result.total_nodes).toBeGreaterThanOrEqual(3);

    const written = readFileSync(join(caeRoot, ".cae", "graph.json"), "utf8");
    const parsed = JSON.parse(written) as {
      nodes: Array<{ id: string; kind: string }>;
      links: Array<{ source: string; target: string; relation: string }>;
      generated_at: string;
    };
    expect(parsed.nodes.map((n) => n.id)).toEqual(
      expect.arrayContaining([
        agentsPath,
        join(caeRoot, "agents", "cae-arch.md"),
        join(caeRoot, "agents", "cae-scout.md"),
      ]),
    );
    expect(parsed.links.some((l) => l.relation === "markdown_link")).toBe(true);
    expect(parsed.links.some((l) => l.relation === "at_ref")).toBe(true);
    const mdLink = parsed.links.find((l) => l.relation === "markdown_link");
    expect(mdLink?.source).toBe(agentsPath);
    expect(mdLink?.target).toBe(join(caeRoot, "agents", "cae-arch.md"));
    const atRef = parsed.links.find((l) => l.relation === "at_ref");
    expect(atRef?.source).toBe(agentsPath);
    expect(atRef?.target).toBe(join(caeRoot, "agents", "cae-scout.md"));
  });

  it("second call within 60s cooldown returns ok=false error=cooldown", async () => {
    const caeRoot = seedCaeRoot();
    writeFileSync(join(caeRoot, "AGENTS.md"), "# a");
    (listProjects as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: "proj", path: caeRoot, hasPlanning: false },
    ]);

    const first = await regenerateGraph();
    expect(first.ok).toBe(true);

    const second = await regenerateGraph();
    expect(second.ok).toBe(false);
    expect(second.error).toBe("cooldown");
    expect(typeof second.retry_after_ms).toBe("number");
    expect(second.retry_after_ms).toBeGreaterThan(0);
    expect(second.retry_after_ms).toBeLessThanOrEqual(60_000);
  });

  afterAll(() => {
    // Restore env; clean up all temp roots.
    if (ORIGINAL_CAE_ROOT === undefined) {
      delete process.env.CAE_ROOT;
    } else {
      process.env.CAE_ROOT = ORIGINAL_CAE_ROOT;
    }
    for (const r of rootsToCleanup) {
      try {
        if (existsSync(r)) rmSync(r, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    }
    rootsToCleanup = [];
  });
});
