/**
 * Phase 8 Wave 4 (plan 08-06 Task 1) — WhyDrawer tests (5 cases).
 *
 * Covers the D-03 decision ladder:
 *   1. Path A (live trace) — fetch returns found:true + 1 entry.
 *   2. Path B (heuristic) — fetch returns found:false + filesModified
 *      supplied, heuristic returns exactly the memory-source paths.
 *   3. Path C (empty) — fetch returns found:false and no filesModified.
 *   4. Error — fetch returns 500.
 *   5. ESC keypress — calls onClose.
 *
 * Uses the D-13 injection pattern (spy on globalThis.fetch per test).
 * Mocks `@/lib/cae-memory-whytrace` so the heuristic list is deterministic.
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

// Mock the heuristic module so tests don't depend on the real
// isMemorySourcePath (which reads the project allowlist from disk).
vi.mock("@/lib/cae-memory-whytrace", () => ({
  getHeuristicWhyTrace: vi.fn(),
}));

import { WhyDrawer } from "./why-drawer";
import { getHeuristicWhyTrace } from "@/lib/cae-memory-whytrace";

function renderDrawer(
  props: Partial<React.ComponentProps<typeof WhyDrawer>> = {},
) {
  const onClose = props.onClose ?? vi.fn();
  const result = render(
    <ExplainModeProvider>
      <DevModeProvider>
        <WhyDrawer
          open={props.open ?? true}
          onClose={onClose}
          taskId={props.taskId ?? "t-abc"}
          filesModified={props.filesModified}
          onSelectFile={props.onSelectFile}
        />
      </DevModeProvider>
    </ExplainModeProvider>,
  );
  return { ...result, onClose };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(getHeuristicWhyTrace).mockReturnValue([]);
});

describe("WhyDrawer", () => {
  it("Path A: renders live-trace pill + entry when fetch returns found:true", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          task_id: "t-abc",
          entries: [
            {
              source_path: "/x/AGENTS.md",
              ts: "2026-04-22T00:00:00Z",
            },
          ],
          found: true,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    renderDrawer();

    const pill = await screen.findByTestId("why-drawer-pill-live");
    expect(pill.textContent ?? "").toMatch(/live trace/i);

    const list = await screen.findByTestId("why-drawer-entries-live");
    expect(list.textContent ?? "").toContain("/x/AGENTS.md");
    expect(list.textContent ?? "").toContain("AGENTS.md");

    // Heuristic list must NOT appear.
    expect(screen.queryByTestId("why-drawer-entries-heuristic")).toBeNull();
    // Empty state must NOT appear.
    expect(screen.queryByTestId("why-drawer-empty")).toBeNull();
  });

  it("Path B: renders heuristic pill + filtered list when fetch returns found:false AND filesModified is non-empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ task_id: "t-abc", entries: [], found: false }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    // Heuristic returns /x/AGENTS.md only (simulating the allowlist filter
    // that drops /x/foo.txt).
    vi.mocked(getHeuristicWhyTrace).mockReturnValue([
      { source_path: "/x/AGENTS.md", basis: "files_modified_intersect" },
    ]);

    renderDrawer({
      filesModified: ["/x/AGENTS.md", "/x/foo.txt"],
    });

    const pill = await screen.findByTestId("why-drawer-pill-heuristic");
    expect(pill.textContent ?? "").toMatch(/heuristic/i);

    const list = await screen.findByTestId("why-drawer-entries-heuristic");
    expect(list.textContent ?? "").toContain("/x/AGENTS.md");
    expect(list.textContent ?? "").not.toContain("/x/foo.txt");

    // Live list must NOT appear.
    expect(screen.queryByTestId("why-drawer-entries-live")).toBeNull();
  });

  it("Path C: renders empty-state copy when fetch returns found:false and no filesModified is supplied", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ task_id: "t-abc", entries: [], found: false }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.mocked(getHeuristicWhyTrace).mockReturnValue([]);

    renderDrawer({ filesModified: undefined });

    const empty = await screen.findByTestId("why-drawer-empty");
    expect(empty).toBeInTheDocument();
    expect(empty.textContent ?? "").toMatch(/no memory|0 memory_consult/i);

    expect(screen.queryByTestId("why-drawer-entries-live")).toBeNull();
    expect(screen.queryByTestId("why-drawer-entries-heuristic")).toBeNull();
  });

  it("renders the error banner when the consult API responds 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "internal" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );

    renderDrawer();

    const err = await screen.findByTestId("why-drawer-error");
    expect(err).toBeInTheDocument();

    expect(screen.queryByTestId("why-drawer-entries-live")).toBeNull();
    expect(screen.queryByTestId("why-drawer-entries-heuristic")).toBeNull();
    expect(screen.queryByTestId("why-drawer-empty")).toBeNull();
  });

  it("calls onClose when ESC is pressed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ task_id: "t-abc", entries: [], found: false }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const onClose = vi.fn();
    renderDrawer({ onClose });

    await waitFor(() => {
      expect(screen.getByTestId("memory-why-drawer")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
