"use client";

/**
 * Phase 8 Wave 3 (plan 08-04) — BrowsePane.
 *
 * Tab-level composition for the Memory Browse view. Fetches the cross-
 * project memory tree from `/api/memory/tree` on mount and arranges:
 *
 *   ┌─────────────────────────────── left (300px) ──┬─ right (flex-1) ─┐
 *   │ SearchBar                                     │                  │
 *   │ SearchResults (hidden when q === "")          │ MarkdownView     │
 *   │ FileTree                                      │ (selected file)  │
 *   └───────────────────────────────────────────────┴──────────────────┘
 *
 * Prop contract (full signature declared in this plan so Wave 5 consumes
 * without refactor):
 *   - `initialPath`        — deep-link seed on first mount.
 *   - `selectedPath`       — if provided, BrowsePane runs controlled and
 *                            its local state mirrors this prop.
 *   - `onSelect`           — notifies the parent *before* local state
 *                            updates, so URL-syncing can stay ahead.
 *   - `onOpenGitTimeline`  — opens the Git-timeline drawer for a file
 *                            (Wave 5). When absent, the button hides.
 *
 * The SearchBar + SearchResults imports are wired in Task 2 of the same
 * plan. This file is created in Task 1 and extended in Task 2; references
 * are imported from the companion files so the module graph resolves
 * immediately (no import churn between tasks).
 *
 * Constraints honoured:
 *   - Starts with `"use client"`.
 *   - base-ui polymorphic render is not used (AGENTS.md p2-plA-t1-e81f6c).
 *   - Physical isolation from the sibling graph tab plan (08-05) — no
 *     cross-subdir imports in either direction.
 *   - All copy via `labels = labelFor(dev)`.
 */

import { useCallback, useEffect, useState } from "react";
import type { MemoryTreeNode } from "@/lib/cae-memory-sources";
import type { SearchHit } from "@/lib/cae-memory-search";
import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";
import { FileTree } from "./file-tree";
import { MarkdownView } from "./markdown-view";
import { SearchBar } from "./search-bar";
import { SearchResults } from "./search-results";

export interface BrowsePaneProps {
  initialPath?: string; // deep-link seed (Wave 5 `?path=<rel>`)
  selectedPath?: string | null; // controlled override from parent (Wave 5)
  onSelect?: (absPath: string) => void; // notify parent when user picks a file
  onOpenGitTimeline?: (absPath: string) => void; // open Git-timeline drawer (Wave 5)
}

type TreeState =
  | { status: "loading" }
  | { status: "loaded"; nodes: MemoryTreeNode[] }
  | { status: "error"; detail: string };

export function BrowsePane({
  initialPath,
  selectedPath: controlledSelectedPath,
  onSelect,
  onOpenGitTimeline,
}: BrowsePaneProps) {
  const { dev } = useDevMode();
  const labels = labelFor(dev);

  // Controlled vs uncontrolled mode. If parent passes `selectedPath`, we
  // mirror it; otherwise we seed from `initialPath` and own the state.
  const isControlled = controlledSelectedPath !== undefined;
  const [localSelectedPath, setLocalSelectedPath] = useState<string | null>(
    initialPath ?? null,
  );
  const selectedPath = isControlled
    ? (controlledSelectedPath ?? null)
    : localSelectedPath;

  const [treeState, setTreeState] = useState<TreeState>({ status: "loading" });
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [q, setQ] = useState<string>("");

  // Fetch tree once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/memory/tree", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled)
            setTreeState({ status: "error", detail: `HTTP ${res.status}` });
          return;
        }
        const data = (await res.json()) as { projects: MemoryTreeNode[] };
        if (!cancelled)
          setTreeState({ status: "loaded", nodes: data.projects });
      } catch (err) {
        if (!cancelled)
          setTreeState({
            status: "error",
            detail: err instanceof Error ? err.message : "network failure",
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = useCallback(
    (absPath: string) => {
      // Fire parent callback FIRST so controllers can cancel or sync URL
      // before the UI reflects the change.
      onSelect?.(absPath);
      if (!isControlled) setLocalSelectedPath(absPath);
    },
    [onSelect, isControlled],
  );

  const handleSearchResults = useCallback(
    (nextHits: SearchHit[], nextQ: string) => {
      setHits(nextHits);
      setQ(nextQ);
    },
    [],
  );

  return (
    <div
      className="flex h-full min-h-0 flex-row overflow-hidden border border-[color:var(--border)] bg-[color:var(--bg)]"
      data-testid="browse-pane"
    >
      <aside
        className="flex w-[300px] shrink-0 flex-col overflow-hidden border-r border-[color:var(--border)] bg-[color:var(--bg)]"
        aria-label="Memory browser"
      >
        <div className="border-b border-[color:var(--border)] px-3 py-2">
          <SearchBar onResults={handleSearchResults} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <SearchResults
            hits={hits}
            q={q}
            onSelectFile={handleSelect}
          />
          {treeState.status === "loading" && (
            <div
              data-testid="tree-loading"
              className="px-3 py-4 text-xs text-[color:var(--text-muted)]"
            >
              Loading…
            </div>
          )}
          {treeState.status === "error" && (
            <div
              data-testid="tree-error"
              className="px-3 py-4 text-xs text-[color:var(--text-muted)]"
            >
              {labels.memoryLoadFailed}
              {dev ? ` · ${treeState.detail}` : ""}
            </div>
          )}
          {treeState.status === "loaded" && (
            <div className="py-1">
              <FileTree
                nodes={treeState.nodes}
                selectedPath={selectedPath}
                onSelect={handleSelect}
              />
            </div>
          )}
        </div>
      </aside>
      <section className="min-h-0 flex-1 overflow-hidden bg-[color:var(--bg)]">
        <MarkdownView
          absPath={selectedPath}
          onOpenGitTimeline={onOpenGitTimeline}
        />
      </section>
    </div>
  );
}
