import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Stub listProjects so tests drive the allowlist + tree via temp dirs.
vi.mock("./cae-state", async (orig) => {
  const actual = (await orig()) as typeof import("./cae-state");
  return {
    ...actual,
    listProjects: vi.fn(),
  };
});

import {
  isMemorySourcePath,
  listMemorySources,
  buildMemoryTree,
  getAllowedRoots,
  __resetAllowedRootsCacheForTests,
} from "./cae-memory-sources";
import { listProjects } from "./cae-state";

describe("isMemorySourcePath", () => {
  beforeEach(() => {
    __resetAllowedRootsCacheForTests();
    (listProjects as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it.each([
    "/home/cae/ctrl-alt-elite/AGENTS.md",
    "/home/cae/p/KNOWLEDGE/notes/onboarding.md",
    "/home/cae/p/KNOWLEDGE/deep/nested/x.md",
    "/home/cae/p/.claude/agents/reviewer.md",
    "/home/cae/p/agents/cae-arch.md",
    "/home/cae/p/.planning/phases/08-memory/08-PLAN.md",
  ])("matches the D-10 glob: %s", (p) => {
    expect(isMemorySourcePath(p)).toBe(true);
  });

  it.each([
    ["/etc/passwd", "non-md, non-memory"],
    ["/tmp/foo.md", "md but outside any memory glob"],
    ["/some/random/KNOWLEDGE/things.txt", ".txt extension rejected"],
    ["/p/AGENTS.mdx", ".mdx rejected"],
    ["/p/AGENTS.md/", "trailing slash rejected"],
    ["relative/AGENTS.md", "non-absolute rejected"],
    ["", "empty string rejected"],
    ["/p/agents/other.md", "agents/ non-cae-* rejected"],
    ["/p/.planning/phases/08/deep/nested/file.md", "3-level planning nesting rejected"],
  ])("rejects %s (%s)", (p) => {
    expect(isMemorySourcePath(p)).toBe(false);
  });

  it("enforces allowed-root prefix once the allowlist is warmed", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "memsrc-roots-"));
    (listProjects as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: "proj", path: tmp, hasPlanning: false },
    ]);
    await getAllowedRoots();
    expect(isMemorySourcePath(tmp + "/AGENTS.md")).toBe(true);
    // Outside the allowlist after warming → reject even though the pattern
    // matches.
    expect(isMemorySourcePath("/home/other/AGENTS.md")).toBe(false);
    rmSync(tmp, { recursive: true, force: true });
  });
});

describe("listMemorySources", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "memsrc-"));
    __resetAllowedRootsCacheForTests();
    (listProjects as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it("returns every D-10 glob hit and excludes node_modules + non-.md", async () => {
    // AGENTS.md at root
    writeFileSync(join(tmp, "AGENTS.md"), "# agents");
    // KNOWLEDGE
    mkdirSync(join(tmp, "KNOWLEDGE", "sub"), { recursive: true });
    writeFileSync(join(tmp, "KNOWLEDGE", "top.md"), "# k");
    writeFileSync(join(tmp, "KNOWLEDGE", "sub", "nested.md"), "# kn");
    writeFileSync(join(tmp, "KNOWLEDGE", "skip.txt"), "not markdown");
    // .claude/agents
    mkdirSync(join(tmp, ".claude", "agents"), { recursive: true });
    writeFileSync(join(tmp, ".claude", "agents", "reviewer.md"), "# r");
    // agents/cae-*
    mkdirSync(join(tmp, "agents"), { recursive: true });
    writeFileSync(join(tmp, "agents", "cae-arch.md"), "# a");
    writeFileSync(join(tmp, "agents", "other.md"), "# not cae"); // should be filtered
    // .planning/phases
    mkdirSync(join(tmp, ".planning", "phases", "08-memory"), { recursive: true });
    writeFileSync(
      join(tmp, ".planning", "phases", "08-memory", "08-PLAN.md"),
      "# plan",
    );
    // node_modules — must be skipped
    mkdirSync(join(tmp, "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(tmp, "node_modules", "pkg", "AGENTS.md"), "# noise");

    const files = await listMemorySources(tmp);
    const names = files.map((f) => f.replace(tmp, ""));
    expect(names).toEqual(
      expect.arrayContaining([
        "/AGENTS.md",
        "/KNOWLEDGE/top.md",
        "/KNOWLEDGE/sub/nested.md",
        "/.claude/agents/reviewer.md",
        "/agents/cae-arch.md",
        "/.planning/phases/08-memory/08-PLAN.md",
      ]),
    );
    expect(names).not.toContain("/node_modules/pkg/AGENTS.md");
    expect(names).not.toContain("/KNOWLEDGE/skip.txt");
    expect(names).not.toContain("/agents/other.md");
  });

  afterAll(() => {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  });
});

describe("buildMemoryTree", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "memsrc-tree-"));
    __resetAllowedRootsCacheForTests();
    (listProjects as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it("shapes projects → groups → files with empty groups omitted", async () => {
    const projRoot = join(tmp, "proj-a");
    mkdirSync(projRoot, { recursive: true });
    writeFileSync(join(projRoot, "AGENTS.md"), "# a");
    mkdirSync(join(projRoot, "KNOWLEDGE"), { recursive: true });
    writeFileSync(join(projRoot, "KNOWLEDGE", "b.md"), "# b");
    writeFileSync(join(projRoot, "KNOWLEDGE", "a.md"), "# a");

    const emptyProj = join(tmp, "proj-empty");
    mkdirSync(emptyProj, { recursive: true });

    (listProjects as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: "proj-a", path: projRoot, hasPlanning: true },
      { name: "proj-empty", path: emptyProj, hasPlanning: false },
    ]);

    const tree = await buildMemoryTree();
    // proj-empty has no files → must be absent from tree.
    expect(tree.map((n) => n.label)).toEqual(["proj-a"]);
    const proj = tree[0];
    expect(proj.kind).toBe("project");

    const children = proj.children ?? [];
    const labels = children.map((c) => c.label);
    // AGENTS.md (single leaf, flattened) + KNOWLEDGE group
    expect(labels).toContain("AGENTS.md");
    expect(labels).toContain("KNOWLEDGE");
    const agentsLeaf = children.find((c) => c.label === "AGENTS.md");
    expect(agentsLeaf?.kind).toBe("file");
    expect(agentsLeaf?.absPath).toBe(join(projRoot, "AGENTS.md"));
    const kGroup = children.find((c) => c.label === "KNOWLEDGE");
    expect(kGroup?.kind).toBe("group");
    // Alphabetical sort within group
    expect((kGroup?.children ?? []).map((c) => c.label)).toEqual([
      "a.md",
      "b.md",
    ]);
  });

  afterAll(() => {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  });
});
