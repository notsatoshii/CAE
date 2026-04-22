/**
 * Phase 8 Wave 3 (plan 08-04) — FileTree tests (4 cases per plan Task 1.D).
 *
 * Cases:
 *   1. Empty nodes array → renders empty-state copy.
 *   2. Two-level tree (project > group > file) → renders both levels;
 *      clicking a leaf fires `onSelect(absPath)` with correct arg.
 *   3. Clicking a branch chevron collapses / re-expands a group; the leaf
 *      vanishes from the DOM when collapsed.
 *   4. ArrowDown from a focused leaf moves focus to the next leaf.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import { FileTree } from "./file-tree";
import type { MemoryTreeNode } from "@/lib/cae-memory-sources";

// Minimal DevModeProvider mock so labels render without wiring the real
// provider tree — the real provider throws if a consumer renders outside it.
vi.mock("@/lib/providers/dev-mode", () => ({
  useDevMode: () => ({ dev: false, toggle: () => {}, setDev: () => {} }),
}));

// Mock next/navigation: useRouter used by EmptyState CTA in the empty branch.
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("FileTree", () => {
  it("renders the empty state when nodes is an empty array", () => {
    render(<FileTree nodes={[]} selectedPath={null} onSelect={() => {}} />);
    const empty = screen.getByTestId("file-tree-empty");
    expect(empty.textContent?.length).toBeGreaterThan(0);
  });

  it("renders a two-level tree and fires onSelect(absPath) with the correct arg on leaf click", () => {
    const onSelect = vi.fn();
    const nodes: MemoryTreeNode[] = [
      {
        id: "project:alpha",
        label: "alpha",
        kind: "project",
        children: [
          {
            id: "group:alpha:KNOWLEDGE",
            label: "KNOWLEDGE",
            kind: "group",
            children: [
              {
                id: "/projects/alpha/KNOWLEDGE/notes.md",
                label: "notes.md",
                absPath: "/projects/alpha/KNOWLEDGE/notes.md",
                kind: "file",
              },
            ],
          },
        ],
      },
    ];

    render(
      <FileTree nodes={nodes} selectedPath={null} onSelect={onSelect} />,
    );

    // Both branch levels rendered.
    expect(screen.getByTestId("tree-branch-project:alpha")).toBeInTheDocument();
    expect(
      screen.getByTestId("tree-branch-group:alpha:KNOWLEDGE"),
    ).toBeInTheDocument();

    // Leaf rendered and clickable.
    const leafBtn = screen.getByTitle("/projects/alpha/KNOWLEDGE/notes.md");
    expect(leafBtn).toHaveTextContent("notes.md");

    fireEvent.click(leafBtn);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("/projects/alpha/KNOWLEDGE/notes.md");
  });

  it("collapses and re-expands a group when its chevron is clicked — leaf disappears when collapsed", () => {
    const nodes: MemoryTreeNode[] = [
      {
        id: "project:alpha",
        label: "alpha",
        kind: "project",
        children: [
          {
            id: "group:alpha:KNOWLEDGE",
            label: "KNOWLEDGE",
            kind: "group",
            children: [
              {
                id: "/projects/alpha/KNOWLEDGE/notes.md",
                label: "notes.md",
                absPath: "/projects/alpha/KNOWLEDGE/notes.md",
                kind: "file",
              },
            ],
          },
        ],
      },
    ];

    render(<FileTree nodes={nodes} selectedPath={null} onSelect={() => {}} />);

    // Default: both levels expanded → leaf is visible.
    expect(
      screen.getByTitle("/projects/alpha/KNOWLEDGE/notes.md"),
    ).toBeInTheDocument();

    const groupBtn = screen.getByTestId("tree-branch-group:alpha:KNOWLEDGE");
    fireEvent.click(groupBtn);

    // After collapse → leaf removed from DOM.
    expect(
      screen.queryByTitle("/projects/alpha/KNOWLEDGE/notes.md"),
    ).not.toBeInTheDocument();

    fireEvent.click(groupBtn);
    // After re-expand → leaf reappears.
    expect(
      screen.getByTitle("/projects/alpha/KNOWLEDGE/notes.md"),
    ).toBeInTheDocument();
  });

  it("ArrowDown from a focused leaf moves focus to the next leaf in order", () => {
    const nodes: MemoryTreeNode[] = [
      {
        id: "project:alpha",
        label: "alpha",
        kind: "project",
        children: [
          {
            id: "group:alpha:KNOWLEDGE",
            label: "KNOWLEDGE",
            kind: "group",
            children: [
              {
                id: "/projects/alpha/KNOWLEDGE/a.md",
                label: "a.md",
                absPath: "/projects/alpha/KNOWLEDGE/a.md",
                kind: "file",
              },
              {
                id: "/projects/alpha/KNOWLEDGE/b.md",
                label: "b.md",
                absPath: "/projects/alpha/KNOWLEDGE/b.md",
                kind: "file",
              },
            ],
          },
        ],
      },
    ];

    const { container } = render(
      <FileTree nodes={nodes} selectedPath={null} onSelect={() => {}} />,
    );

    const treeRoot = within(container);
    const firstLeaf = treeRoot.getByTitle("/projects/alpha/KNOWLEDGE/a.md");
    const secondLeaf = treeRoot.getByTitle("/projects/alpha/KNOWLEDGE/b.md");

    act(() => {
      firstLeaf.focus();
    });
    expect(document.activeElement).toBe(firstLeaf);

    fireEvent.keyDown(firstLeaf, { key: "ArrowDown" });

    expect(document.activeElement).toBe(secondLeaf);
  });
});
