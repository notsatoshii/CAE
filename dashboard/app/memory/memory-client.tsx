"use client";

/**
 * Phase 8 Wave 5 (plan 08-07, MEM-01, D-16) — MemoryClient integrator.
 *
 * Single client island that hosts:
 *   - base-ui <Tabs> with triggers "Browse" / "Graph"
 *   - <BrowsePane> + <GraphPane> inside the respective tab panels
 *   - <WhyDrawer> + <GitTimelineDrawer> mounted ONCE (shared across tabs)
 *   - Deep-link query reading: ?view, ?path, ?task, ?timeline
 *
 * Drawer mount rule (D-16): both drawers live HERE, never inside a pane.
 * Either pane can trigger either drawer; mounting them per-pane would
 * duplicate state and break cross-tab usage.
 *
 * Deep-link contract (v1 one-way — URL → state, never state → URL):
 *   /memory                                 → view=browse, no selection
 *   /memory?view=graph                      → view=graph
 *   /memory?view=browse&path=<rel-or-abs>   → preselects file in Browse tab
 *   /memory?task=<task_id>                  → opens WhyDrawer immediately
 *   /memory?timeline=<absPath>              → opens GitTimelineDrawer
 *
 * Accessibility / constraints:
 *   - base-ui Tabs.Tab uses `className` styling only. Polymorphic
 *     render via the render-as-child prop is not supported (AGENTS.md
 *     p2-plA-t1-e81f6c).
 *   - ExplainTooltip adjacent to the tabs list so both founders and devs
 *     can get a one-liner on what Browse/Graph mean.
 *   - Drawer focus trap + ESC is already handled by the drawers themselves
 *     (08-06 implementation).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs } from "@base-ui/react/tabs";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { BrowsePane } from "@/components/memory/browse/browse-pane";
import { GraphPane } from "@/components/memory/graph/graph-pane";
import { WhyDrawer } from "@/components/memory/why-drawer";
import { GitTimelineDrawer } from "@/components/memory/git-timeline-drawer";
import { ExplainTooltip } from "@/components/ui/explain-tooltip";

type View = "browse" | "graph";

function normalizeView(raw: string | null): View {
  return raw === "graph" ? "graph" : "browse";
}

export default function MemoryClient() {
  const { dev } = useDevMode();
  const L = labelFor(dev);
  const sp = useSearchParams();
  const spKey = sp.toString(); // stable stringified dep for effect

  // Seed initial state from the URL on first render so deep-links land
  // correctly without a post-mount flicker.
  const initialView = normalizeView(sp.get("view"));
  const initialPath = sp.get("path");
  const initialTask = sp.get("task");
  const initialTimeline = sp.get("timeline");

  const [view, setView] = useState<View>(initialView);
  const [selectedPath, setSelectedPath] = useState<string | null>(initialPath);

  // Why drawer state (MEM-09 — see 08-06 SUMMARY Wave-7 flag).
  const [whyOpen, setWhyOpen] = useState<boolean>(Boolean(initialTask));
  const [whyTaskId, setWhyTaskId] = useState<string | null>(initialTask);
  // CRITICAL (from 08-06 flag): filesModified must flow to WhyDrawer so the
  // heuristic fallback (Path B) fires for pre-hook tasks. In this plan the
  // value is wired via `openWhy(taskId, filesModified)`; future callers
  // (e.g. a task row somewhere in the page) supply it from the task's
  // DONE.md. When absent, the drawer falls through to Path C (empty).
  const [whyFilesModified, setWhyFilesModified] = useState<
    string[] | undefined
  >(undefined);

  // Git timeline drawer state (MEM-10).
  const [gitOpen, setGitOpen] = useState<boolean>(Boolean(initialTimeline));
  const [gitPath, setGitPath] = useState<string | null>(initialTimeline);

  // Respond to URL changes post-mount (e.g. TopNav Memory icon with a
  // fresh query, a client-side link inside the shell, back/forward nav).
  // Deliberately keyed on `spKey` only — searchParams reference changes on
  // every render, which would otherwise thrash this effect.
  useEffect(() => {
    const nextView = normalizeView(sp.get("view"));
    setView((prev) => (prev === nextView ? prev : nextView));

    const nextPath = sp.get("path");
    setSelectedPath((prev) => (prev === nextPath ? prev : nextPath));

    const nextTask = sp.get("task");
    if (nextTask && nextTask !== whyTaskId) {
      setWhyTaskId(nextTask);
      setWhyFilesModified(undefined); // URL-driven = no DONE.md context
      setWhyOpen(true);
    }

    const nextTimeline = sp.get("timeline");
    if (nextTimeline && nextTimeline !== gitPath) {
      setGitPath(nextTimeline);
      setGitOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spKey]);

  // Stable callbacks so child panes don't re-render on every parent update.
  const openWhy = useCallback(
    (taskId: string, filesModified?: string[]) => {
      setWhyTaskId(taskId);
      setWhyFilesModified(filesModified);
      setWhyOpen(true);
    },
    [],
  );

  const openGitTimeline = useCallback((absPath: string) => {
    setGitPath(absPath);
    setGitOpen(true);
  }, []);

  const closeWhy = useCallback(() => setWhyOpen(false), []);
  const closeGit = useCallback(() => setGitOpen(false), []);

  const handleBrowseSelect = useCallback((absPath: string) => {
    setSelectedPath(absPath);
  }, []);

  // Surface the selected-file path to the WhyDrawer's onSelectFile callback
  // so clicking a memory-consult row switches the user to Browse + selects
  // the file. This closes the "live trace → open file" loop without any
  // extra plumbing from the drawer.
  const handleDrawerSelectFile = useCallback((absPath: string) => {
    setSelectedPath(absPath);
    setView("browse");
    setWhyOpen(false);
  }, []);

  const tabTriggerClass = useMemo(
    () =>
      "rounded px-3 py-1 text-[color:var(--text-muted)] transition-colors " +
      "data-[selected]:bg-[color:var(--surface-hover)] " +
      "data-[selected]:text-[color:var(--accent)] " +
      "hover:text-[color:var(--text)] " +
      "focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]",
    [],
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
      data-testid="memory-client"
    >
      <Tabs.Root
        value={view}
        onValueChange={(v) => setView(v as View)}
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <div className="flex items-center gap-2">
          <Tabs.List className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-1 text-sm">
            <Tabs.Tab
              value="browse"
              data-testid="memory-tab-browse"
              className={tabTriggerClass}
            >
              {L.memoryTabBrowse}
            </Tabs.Tab>
            <Tabs.Tab
              value="graph"
              data-testid="memory-tab-graph"
              className={tabTriggerClass}
            >
              {L.memoryTabGraph}
            </Tabs.Tab>
          </Tabs.List>
          <ExplainTooltip
            text={L.memoryExplainGraph}
            ariaLabel="Explain memory tabs"
          />
        </div>

        <Tabs.Panel
          value="browse"
          className="min-h-0 flex-1 overflow-hidden focus-visible:outline-none"
          data-testid="memory-panel-browse"
        >
          <BrowsePane
            initialPath={initialPath ?? undefined}
            selectedPath={selectedPath}
            onSelect={handleBrowseSelect}
            onOpenGitTimeline={openGitTimeline}
          />
        </Tabs.Panel>
        <Tabs.Panel
          value="graph"
          className="min-h-0 flex-1 overflow-hidden focus-visible:outline-none"
          data-testid="memory-panel-graph"
        >
          <GraphPane onOpenGitTimeline={openGitTimeline} />
        </Tabs.Panel>
      </Tabs.Root>

      {/* Shared drawers — mounted ONCE, reachable from either tab. */}
      <WhyDrawer
        open={whyOpen}
        onClose={closeWhy}
        taskId={whyTaskId}
        filesModified={whyFilesModified}
        onSelectFile={handleDrawerSelectFile}
      />
      <GitTimelineDrawer
        open={gitOpen}
        onClose={closeGit}
        absFilePath={gitPath}
      />
    </div>
  );
}

// Exposed for unit tests / other client call-sites that want to programmatically
// open the Why drawer. Kept on the same module because React hooks APIs can't
// round-trip through a separate imperative shim without a ref forwarding layer,
// and v1 doesn't need that level of ceremony.
export type { View };
// Re-export openWhy signature intent so consumers documenting the contract
// have a single surface to cite. (No runtime export — see comment.)
export type OpenWhy = (taskId: string, filesModified?: string[]) => void;
