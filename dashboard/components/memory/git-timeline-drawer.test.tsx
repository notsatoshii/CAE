/**
 * Phase 8 Wave 4 (plan 08-06 Task 2) — GitTimelineDrawer tests (4 cases).
 *
 *   1. Opens with abs file + log fetch returns 3 commits → renders 3 rows.
 *   2. Picking one commit leaves Show-diff disabled; picking two enables it.
 *   3. Clicking Show-diff mounts the DiffView child.
 *   4. ESC keypress → calls onClose.
 *
 * Uses the D-13 injection pattern (spy on globalThis.fetch per test).
 * DiffView is NOT mocked — we intercept its POST /api/memory/diff fetch
 * via the same spy, so we don't need to know the DiffView internals.
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
import { GitTimelineDrawer } from "./git-timeline-drawer";

const FIXTURE_LOG = [
  {
    sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ts: 1_776_000_000,
    author: "Alice",
    subject: "initial commit",
  },
  {
    sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ts: 1_776_050_000,
    author: "Bob",
    subject: "second change",
  },
  {
    sha: "cccccccccccccccccccccccccccccccccccccccc",
    ts: 1_776_100_000,
    author: "Carol",
    subject: "third change",
  },
];

function renderDrawer(
  props: Partial<React.ComponentProps<typeof GitTimelineDrawer>> = {},
) {
  const onClose = props.onClose ?? vi.fn();
  const result = render(
    <ExplainModeProvider>
      <DevModeProvider>
        <GitTimelineDrawer
          open={props.open ?? true}
          onClose={onClose}
          absFilePath={props.absFilePath ?? "/proj/AGENTS.md"}
        />
      </DevModeProvider>
    </ExplainModeProvider>,
  );
  return { ...result, onClose };
}

/**
 * Minimal fetch router — matches request URL and returns the right stub.
 * Used so GitTimelineDrawer's git-log fetch AND DiffView's diff POST both
 * resolve without needing to mock either component.
 */
function installFetchRouter(
  opts: {
    log?: typeof FIXTURE_LOG;
    logStatus?: number;
    diffBody?: string;
    diffStatus?: number;
  } = {},
) {
  const logBody = JSON.stringify({ log: opts.log ?? FIXTURE_LOG });
  const diffBody = JSON.stringify({ diff: opts.diffBody ?? "" });
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/memory/git-log/")) {
        return new Response(logBody, {
          status: opts.logStatus ?? 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/api/memory/diff")) {
        return new Response(diffBody, {
          status: opts.diffStatus ?? 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("GitTimelineDrawer", () => {
  it("fetches the git log and renders one row per commit", async () => {
    installFetchRouter();
    renderDrawer();

    const list = await screen.findByTestId("git-timeline-log");
    expect(list).toBeInTheDocument();

    // One row per fixture commit.
    for (const c of FIXTURE_LOG) {
      expect(screen.getByTestId(`git-timeline-row-${c.sha}`)).toBeInTheDocument();
      expect(screen.getByTestId(`git-timeline-pick-${c.sha}`)).toBeInTheDocument();
    }
  });

  it("leaves Show-diff disabled with one pick; enables with two picks", async () => {
    installFetchRouter();
    renderDrawer();

    await screen.findByTestId("git-timeline-log");

    const showDiff = screen.getByTestId("git-timeline-show-diff");
    expect(showDiff).toBeDisabled();

    // Pick the first commit — still disabled.
    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`git-timeline-pick-${FIXTURE_LOG[0].sha}`),
      );
    });
    expect(showDiff).toBeDisabled();

    // Pick a second — enabled.
    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`git-timeline-pick-${FIXTURE_LOG[1].sha}`),
      );
    });
    expect(showDiff).not.toBeDisabled();
  });

  it("mounts DiffView after clicking Show-diff with two picks", async () => {
    installFetchRouter({
      diffBody:
        "@@ -1,3 +1,3 @@\n context line\n-old line\n+new line\n",
    });
    renderDrawer();

    await screen.findByTestId("git-timeline-log");

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`git-timeline-pick-${FIXTURE_LOG[0].sha}`),
      );
      fireEvent.click(
        screen.getByTestId(`git-timeline-pick-${FIXTURE_LOG[1].sha}`),
      );
    });

    const showDiff = screen.getByTestId("git-timeline-show-diff");
    expect(showDiff).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(showDiff);
    });

    // DiffView is async — wait for its mount point + body to render.
    await waitFor(() => {
      expect(
        screen.getByTestId("git-timeline-diff-mount"),
      ).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId("diff-view")).toBeInTheDocument();
    });
  });

  it("calls onClose when ESC is pressed", async () => {
    installFetchRouter();
    const onClose = vi.fn();
    renderDrawer({ onClose });

    await waitFor(() => {
      expect(
        screen.getByTestId("memory-git-timeline-drawer"),
      ).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
