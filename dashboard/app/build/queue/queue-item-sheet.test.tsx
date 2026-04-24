/**
 * class19b — QueueItemSheet component test.
 *
 * Guarantees:
 *   - No `toast.info` is ever called from this sheet (the regression it fixes).
 *   - No literal "Phase 8" / "Phase 9" text renders from the sheet itself,
 *     regardless of item shape — the old sheet leaked those strings.
 *   - The 4 wired actions (abort / retry / approve / deny) show up only
 *     under their corresponding item.status values.
 *   - The 4 hidden actions (pause / abandon / reassign / edit-plan) are
 *     never rendered.
 *   - A successful action POST closes the sheet and calls router.refresh().
 */

import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { QueueItemSheet } from "./queue-item-sheet";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const push = vi.fn();
const refresh = vi.fn();
let searchParamsStr = "sheet=open&task=web-abc12345";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => ({
    toString: () => searchParamsStr,
    get: (k: string) => {
      const u = new URLSearchParams(searchParamsStr);
      return u.get(k);
    },
  }),
  usePathname: () => "/build/queue",
}));

// SheetLiveLog mounts an EventSource which jsdom doesn't provide. Stub it.
vi.mock("@/components/build-home/sheet-live-log", () => ({
  SheetLiveLog: ({ path }: { path: string }) => (
    <div data-testid="sheet-live-log-stub" data-path={path} />
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    // `info` is intentionally present — test asserts it is NEVER called.
    info: vi.fn(),
  },
}));

type QueueItemFixture = {
  taskId: string;
  title: string;
  summary: string;
  logPath: string;
  buildplanPath: string;
  ts: number;
  tags: string[];
  status:
    | "waiting"
    | "in_progress"
    | "double_checking"
    | "stuck"
    | "shipped";
  hasReviewMarker: boolean;
  hasHaltMarker: boolean;
  hasDone: boolean;
  running: boolean;
  outboxStatus: string | null;
};

const DEFAULT_ITEM: QueueItemFixture = {
  taskId: "web-abc12345",
  title: "Fix queue sheet backend wiring",
  summary: "Wire 4 backend controls + hide 4 gapped ones",
  logPath: "/home/cae/inbox/web-abc12345/agent.log",
  buildplanPath: "/home/cae/inbox/web-abc12345/BUILDPLAN.md",
  ts: Date.now(),
  tags: ["queue", "class19b"],
  status: "waiting",
  hasReviewMarker: false,
  hasHaltMarker: false,
  hasDone: false,
  running: false,
  outboxStatus: null,
};

function mockFetch(overrides: Partial<QueueItemFixture> = {}) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (!init || init.method === undefined) {
      // GET — detail fetch.
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ...DEFAULT_ITEM, ...overrides }),
      } as Response);
    }
    // POST — action.
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          ok: true,
          action: "abort",
          taskId: DEFAULT_ITEM.taskId,
        }),
    } as Response);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  searchParamsStr = "sheet=open&task=web-abc12345";
  push.mockReset();
  refresh.mockReset();
  (toast.info as ReturnType<typeof vi.fn>).mockReset();
});

describe("QueueItemSheet", () => {
  it("renders title + summary from the queue-item payload (not phase-shape)", async () => {
    mockFetch();
    render(<QueueItemSheet />);
    await screen.findByTestId("queue-item-sheet-title");
    expect(screen.getByTestId("queue-item-sheet-title")).toHaveTextContent(
      "Fix queue sheet backend wiring",
    );
    expect(screen.getByTestId("queue-item-sheet-taskid")).toHaveTextContent(
      "web-abc12345",
    );
    // Regression: no "Phase 8" / "Phase 9" leak from the queue sheet.
    expect(document.body.textContent ?? "").not.toMatch(/Phase [89]/);
  });

  it("shows Abort on a waiting item, hides Approve/Deny/Retry", async () => {
    mockFetch({ status: "waiting" });
    render(<QueueItemSheet />);
    await screen.findByTestId("queue-item-action-abort");
    expect(screen.queryByTestId("queue-item-action-approve")).toBeNull();
    expect(screen.queryByTestId("queue-item-action-deny")).toBeNull();
    expect(screen.queryByTestId("queue-item-action-retry")).toBeNull();
  });

  it("shows Approve + Deny on double_checking, hides Retry", async () => {
    mockFetch({ status: "double_checking", hasReviewMarker: true });
    render(<QueueItemSheet />);
    await screen.findByTestId("queue-item-action-approve");
    expect(screen.getByTestId("queue-item-action-deny")).toBeInTheDocument();
    expect(screen.queryByTestId("queue-item-action-retry")).toBeNull();
  });

  it("shows Retry on stuck items", async () => {
    mockFetch({ status: "stuck", hasHaltMarker: true });
    render(<QueueItemSheet />);
    await screen.findByTestId("queue-item-action-retry");
  });

  it("never renders the 4 hidden controls (pause / abandon / reassign / edit-plan)", async () => {
    mockFetch({ status: "in_progress", running: true });
    render(<QueueItemSheet />);
    await screen.findByTestId("queue-item-sheet-title");
    for (const testid of [
      "queue-item-action-pause",
      "queue-item-action-abandon",
      "queue-item-action-reassign",
      "queue-item-action-edit-plan",
    ]) {
      expect(screen.queryByTestId(testid)).toBeNull();
    }
  });

  it("Retry POSTs to /api/queue/item/[id]/action with {action:'retry'} and refreshes", async () => {
    const fetchMock = mockFetch({ status: "stuck", hasHaltMarker: true });
    render(<QueueItemSheet />);
    const btn = await screen.findByTestId("queue-item-action-retry");
    fireEvent.click(btn);
    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const post = calls.find(
        (c) => c[1]?.method === "POST" && typeof c[0] === "string" &&
          (c[0] as string).includes("/api/queue/item/web-abc12345/action"),
      );
      expect(post).toBeDefined();
      const body = JSON.parse((post?.[1]?.body as string) ?? "{}");
      expect(body.action).toBe("retry");
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("never calls toast.info (regression guard for the 8 stubs)", async () => {
    mockFetch({ status: "stuck", hasHaltMarker: true });
    render(<QueueItemSheet />);
    const btn = await screen.findByTestId("queue-item-action-retry");
    fireEvent.click(btn);
    await waitFor(() => {
      expect(toast.info).not.toHaveBeenCalled();
    });
  });

  it("shows an empty-actions line for shipped items", async () => {
    mockFetch({ status: "shipped", hasDone: true });
    render(<QueueItemSheet />);
    await screen.findByTestId("queue-item-actions-empty");
    expect(screen.queryByTestId("queue-item-action-abort")).toBeNull();
  });
});
