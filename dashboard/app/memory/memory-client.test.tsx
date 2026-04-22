/**
 * Phase 8 Wave 5 (plan 08-07) — MemoryClient integration tests (4 cases).
 *
 * Covers:
 *   1. Default mount (no query params) — view=browse, Browse panel active,
 *      Graph panel hidden, no drawer open.
 *   2. Tab switch — clicking the Graph tab swaps which panel is active.
 *   3. Deep-link `?task=t1` — WhyDrawer opens on mount with that taskId.
 *   4. Deep-link `?timeline=/abs/file.md` — GitTimelineDrawer opens on
 *      mount with that path.
 *
 * Strategy:
 *   - `vi.mock("next/navigation", ...)` stubs `useSearchParams` so we can
 *     drive the URL programmatically per test.
 *   - BrowsePane, GraphPane, WhyDrawer, GitTimelineDrawer are all stubbed
 *     to lightweight test-doubles that render their key props into the DOM
 *     as data-* attributes. This isolates MemoryClient's integration logic
 *     (state wiring + URL reading) from the real components' internals.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { DevModeProvider } from "@/lib/providers/dev-mode";
import { ExplainModeProvider } from "@/lib/providers/explain-mode";

// ---------------------------------------------------------------------------
// next/navigation stub
// ---------------------------------------------------------------------------

let currentParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => currentParams,
}));

function setParams(init: Record<string, string>) {
  currentParams = new URLSearchParams(init);
}

// ---------------------------------------------------------------------------
// Component stubs — each asserts its props into the DOM so the integration
// test can verify wiring without depending on the real pane/drawer code.
// ---------------------------------------------------------------------------

vi.mock("@/components/memory/browse/browse-pane", () => ({
  BrowsePane: (props: {
    initialPath?: string;
    selectedPath?: string | null;
    onOpenGitTimeline?: (p: string) => void;
  }) => (
    <div
      data-testid="stub-browse-pane"
      data-initial-path={props.initialPath ?? ""}
      data-selected-path={props.selectedPath ?? ""}
    >
      browse-stub
      <button
        type="button"
        data-testid="stub-browse-open-timeline"
        onClick={() => props.onOpenGitTimeline?.("/abs/from-browse.md")}
      >
        open-timeline-from-browse
      </button>
    </div>
  ),
}));

vi.mock("@/components/memory/graph/graph-pane", () => ({
  GraphPane: (props: { onOpenGitTimeline?: (p: string) => void }) => (
    <div data-testid="stub-graph-pane">
      graph-stub
      <button
        type="button"
        data-testid="stub-graph-open-timeline"
        onClick={() => props.onOpenGitTimeline?.("/abs/from-graph.md")}
      >
        open-timeline-from-graph
      </button>
    </div>
  ),
}));

vi.mock("@/components/memory/why-drawer", () => ({
  WhyDrawer: (props: {
    open: boolean;
    taskId: string | null;
    filesModified?: string[];
  }) =>
    props.open ? (
      <div
        data-testid="stub-why-drawer"
        data-task-id={props.taskId ?? ""}
        data-files-modified={(props.filesModified ?? []).join("|")}
      >
        why-drawer-stub
      </div>
    ) : null,
}));

vi.mock("@/components/memory/git-timeline-drawer", () => ({
  GitTimelineDrawer: (props: {
    open: boolean;
    absFilePath: string | null;
  }) =>
    props.open ? (
      <div
        data-testid="stub-git-drawer"
        data-abs-path={props.absFilePath ?? ""}
      >
        git-drawer-stub
      </div>
    ) : null,
}));

// ---------------------------------------------------------------------------
// Imports AFTER the mocks so the stubs apply.
// ---------------------------------------------------------------------------

import MemoryClient from "./memory-client";

function renderClient() {
  return render(
    <ExplainModeProvider>
      <DevModeProvider>
        <MemoryClient />
      </DevModeProvider>
    </ExplainModeProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  setParams({});
});

describe("MemoryClient", () => {
  it("default mount renders Browse panel and no drawers", () => {
    renderClient();

    // Both panels render in the DOM (base-ui renders both, hides the
    // inactive one via CSS). Verify the active one via aria-selected,
    // which is base-ui Tabs' canonical selection attribute.
    expect(screen.getByTestId("memory-panel-browse")).toBeInTheDocument();
    expect(screen.getByTestId("stub-browse-pane")).toBeInTheDocument();

    const browseTab = screen.getByTestId("memory-tab-browse");
    const graphTab = screen.getByTestId("memory-tab-graph");
    expect(browseTab.getAttribute("aria-selected")).toBe("true");
    expect(graphTab.getAttribute("aria-selected")).toBe("false");

    // No drawer open.
    expect(screen.queryByTestId("stub-why-drawer")).toBeNull();
    expect(screen.queryByTestId("stub-git-drawer")).toBeNull();
  });

  it("clicking the Graph tab switches the active panel", async () => {
    renderClient();

    const graphTab = screen.getByTestId("memory-tab-graph");
    const browseTab = screen.getByTestId("memory-tab-browse");

    // Sanity check starting state.
    expect(browseTab.getAttribute("aria-selected")).toBe("true");

    await act(async () => {
      fireEvent.click(graphTab);
    });

    await waitFor(() => {
      expect(graphTab.getAttribute("aria-selected")).toBe("true");
    });
    expect(browseTab.getAttribute("aria-selected")).toBe("false");
  });

  it("deep-link ?task=t1 opens WhyDrawer with that taskId on mount", () => {
    setParams({ task: "t1" });

    renderClient();

    const drawer = screen.getByTestId("stub-why-drawer");
    expect(drawer).toBeInTheDocument();
    expect(drawer.getAttribute("data-task-id")).toBe("t1");
  });

  it("deep-link ?timeline=<path> opens GitTimelineDrawer with that path on mount", () => {
    setParams({ timeline: "/abs/AGENTS.md" });

    renderClient();

    const drawer = screen.getByTestId("stub-git-drawer");
    expect(drawer).toBeInTheDocument();
    expect(drawer.getAttribute("data-abs-path")).toBe("/abs/AGENTS.md");
  });

  it("clicking open-timeline from the Browse stub opens the shared GitTimelineDrawer", async () => {
    renderClient();

    // Drawer starts closed.
    expect(screen.queryByTestId("stub-git-drawer")).toBeNull();

    const trigger = screen.getByTestId("stub-browse-open-timeline");

    await act(async () => {
      fireEvent.click(trigger);
    });

    const drawer = await screen.findByTestId("stub-git-drawer");
    expect(drawer.getAttribute("data-abs-path")).toBe("/abs/from-browse.md");
  });
});
