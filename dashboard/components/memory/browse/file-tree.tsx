"use client";

/**
 * Phase 8 Wave 3 (plan 08-04) — FileTree.
 *
 * Recursive nested tree of memory-source files across all projects. Consumed
 * by `BrowsePane`; data comes from `/api/memory/tree` (shape declared in
 * `lib/cae-memory-sources.ts` → `MemoryTreeNode`).
 *
 * Behaviour:
 *  - Branch nodes (`project` | `group`) show an expand / collapse chevron
 *    and their `children` nested below.
 *  - Leaf nodes (`file`) render as a `<button>` whose click fires
 *    `onSelect(absPath)`. The full absolute path is exposed via `title`
 *    attribute for tooltip discovery; the visible label is the basename.
 *  - Default expansion: top-level projects + their first-level groups are
 *    expanded on first render; deeper nested groups (should they appear)
 *    start collapsed. Users toggle via click on the chevron or Right/Left
 *    arrow keys when focused.
 *  - Selected leaf carries `data-selected="true"` + an accent-border style
 *    so `MarkdownView` stays visually anchored to the currently-open file.
 *  - Empty-nodes state renders `labels.memoryEmptyBrowse` (founder/dev
 *    aware via `useDevMode`).
 *  - Keyboard nav: ArrowDown/ArrowUp walks the flat focusable leaf list,
 *    Enter/Space selects the focused leaf, ArrowRight expands a collapsed
 *    group, ArrowLeft collapses an expanded group.
 *
 * Constraints honoured (plan 08-04 Task 1.E):
 *  - base-ui polymorphic render is not used (see AGENTS.md p2-plA-t1-e81f6c).
 *  - Physical isolation from plan 08-05's graph tab — no cross-subdir imports.
 *  - All user-visible strings flow through `labelFor(dev)`.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import type { MemoryTreeNode } from "@/lib/cae-memory-sources";
import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";
import { EmptyState, EmptyStateActions } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export interface FileTreeProps {
  nodes: MemoryTreeNode[];
  selectedPath: string | null;
  onSelect: (absPath: string) => void;
}

function collectLeafIds(nodes: MemoryTreeNode[], acc: string[] = []): string[] {
  for (const n of nodes) {
    if (n.kind === "file") acc.push(n.id);
    else if (n.children) collectLeafIds(n.children, acc);
  }
  return acc;
}

function collectDefaultExpanded(
  nodes: MemoryTreeNode[],
  depth = 0,
  acc: Set<string> = new Set(),
): Set<string> {
  for (const n of nodes) {
    if (n.kind === "file") continue;
    if (depth <= 1) acc.add(n.id);
    if (n.children) collectDefaultExpanded(n.children, depth + 1, acc);
  }
  return acc;
}

export function FileTree({ nodes, selectedPath, onSelect }: FileTreeProps) {
  const { dev } = useDevMode();
  const labels = labelFor(dev);
  const router = useRouter();

  const [expanded, setExpanded] = useState<Set<string>>(() =>
    collectDefaultExpanded(nodes),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleNode = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setNodeExpanded = useCallback((id: string, open: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // Flat list of leaf ids in visual order — used for arrow-key navigation.
  const leafOrder = useMemo(() => collectLeafIds(nodes), [nodes]);

  const focusLeaf = useCallback((leafId: string) => {
    const root = containerRef.current;
    if (!root) return;
    const btn = root.querySelector<HTMLButtonElement>(
      `button[data-leaf-id="${CSS.escape(leafId)}"]`,
    );
    btn?.focus();
  }, []);

  if (nodes.length === 0) {
    return (
      <EmptyState
        testId="file-tree-empty"
        icon={FolderOpen}
        heading={labels.emptyMemoryBrowseHeading}
        body={labels.emptyMemoryBrowseBody}
        actions={
          <EmptyStateActions>
            <Button
              variant="secondary"
              onClick={() => router.push("/memory?view=graph")}
            >
              {labels.emptyMemoryBrowseCtaRegenerate}
            </Button>
          </EmptyStateActions>
        }
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="select-none text-[color:var(--text)]"
      role="tree"
      data-testid="file-tree"
    >
      <ul className="flex flex-col">
        {nodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            expanded={expanded}
            selectedPath={selectedPath}
            toggle={toggleNode}
            setExpanded={setNodeExpanded}
            onSelect={onSelect}
            leafOrder={leafOrder}
            focusLeaf={focusLeaf}
          />
        ))}
      </ul>
    </div>
  );
}

interface TreeNodeProps {
  node: MemoryTreeNode;
  depth: number;
  expanded: Set<string>;
  selectedPath: string | null;
  toggle: (id: string) => void;
  setExpanded: (id: string, open: boolean) => void;
  onSelect: (absPath: string) => void;
  leafOrder: string[];
  focusLeaf: (leafId: string) => void;
}

function TreeNode({
  node,
  depth,
  expanded,
  selectedPath,
  toggle,
  setExpanded,
  onSelect,
  leafOrder,
  focusLeaf,
}: TreeNodeProps) {
  const indentPx = 8 + depth * 12;

  if (node.kind === "file") {
    const isSelected = node.absPath != null && node.absPath === selectedPath;
    return (
      <li role="none">
        <button
          type="button"
          role="treeitem"
          aria-selected={isSelected}
          data-leaf-id={node.id}
          data-selected={isSelected ? "true" : undefined}
          title={node.absPath ?? node.label}
          onClick={() => node.absPath && onSelect(node.absPath)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const idx = leafOrder.indexOf(node.id);
              if (idx < 0) return;
              const nextIdx =
                e.key === "ArrowDown"
                  ? Math.min(leafOrder.length - 1, idx + 1)
                  : Math.max(0, idx - 1);
              const target = leafOrder[nextIdx];
              if (target) focusLeaf(target);
            } else if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (node.absPath) onSelect(node.absPath);
            }
          }}
          className={
            "flex w-full items-center gap-1 rounded-sm px-2 py-1 text-left font-mono text-[12px] leading-tight transition-colors hover:bg-[color:var(--surface)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--accent)] " +
            (isSelected
              ? "border border-[color:var(--accent)] bg-[color:var(--surface)] text-[color:var(--text)]"
              : "border border-transparent text-[color:var(--text-muted)]")
          }
          style={{ paddingLeft: indentPx + 12 }}
        >
          <span className="truncate">{node.label}</span>
        </button>
      </li>
    );
  }

  // Branch (project | group)
  const isOpen = expanded.has(node.id);
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  const childCount = node.children?.length ?? 0;

  return (
    <li role="none">
      <button
        type="button"
        role="treeitem"
        aria-expanded={isOpen}
        data-branch-id={node.id}
        data-testid={`tree-branch-${node.id}`}
        onClick={() => toggle(node.id)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            setExpanded(node.id, true);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            setExpanded(node.id, false);
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle(node.id);
          }
        }}
        className={
          "flex w-full items-center gap-1 rounded-sm px-2 py-1 text-left text-[13px] font-medium transition-colors hover:bg-[color:var(--surface)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--accent)] " +
          (node.kind === "project"
            ? "text-[color:var(--text)]"
            : "text-[color:var(--text-muted)]")
        }
        style={{ paddingLeft: indentPx }}
      >
        <Chevron className="size-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{node.label}</span>
        {childCount > 0 && (
          <span className="ml-auto pr-1 text-[10px] text-[color:var(--text-muted)]">
            {childCount}
          </span>
        )}
      </button>
      {isOpen && node.children && node.children.length > 0 && (
        <ul className="flex flex-col">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedPath={selectedPath}
              toggle={toggle}
              setExpanded={setExpanded}
              onSelect={onSelect}
              leafOrder={leafOrder}
              focusLeaf={focusLeaf}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
