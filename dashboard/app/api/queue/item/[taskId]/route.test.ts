/**
 * class19b — GET /api/queue/item/[taskId] tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  default: () => ({
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
    auth: vi.fn(),
  }),
}));
vi.mock("next-auth/providers/github", () => ({ default: {} }));
vi.mock("next-auth/providers/google", () => ({
  default: (_opts?: unknown) => ({ id: "google", type: "oauth" }),
}));
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { email: "test@example.com", role: "viewer" },
    expires: "2099-01-01",
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));
vi.mock("@/lib/cae-queue-item", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cae-queue-item")>(
    "@/lib/cae-queue-item",
  );
  return {
    ...actual,
    getQueueItem: vi.fn(),
  };
});

const SAMPLE = {
  taskId: "web-abc123",
  title: "Sample",
  summary: "Summary",
  logPath: "",
  buildplanPath: "/tmp/web-abc123/BUILDPLAN.md",
  ts: 0,
  tags: [],
  status: "waiting" as const,
  hasReviewMarker: false,
  hasHaltMarker: false,
  hasDone: false,
  running: false,
  outboxStatus: null,
};

describe("GET /api/queue/item/[taskId]", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 200 + detail for a known task", async () => {
    const { getQueueItem } = await import("@/lib/cae-queue-item");
    vi.mocked(getQueueItem).mockResolvedValue(SAMPLE);
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/queue/item/web-abc123");
    const res = await GET(req, {
      params: Promise.resolve({ taskId: "web-abc123" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.taskId).toBe("web-abc123");
  });

  it("rejects shell-metachar taskIds with 400", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/queue/item/bad;rm");
    const res = await GET(req, {
      params: Promise.resolve({ taskId: "bad;rm" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when getQueueItem returns null", async () => {
    const { getQueueItem } = await import("@/lib/cae-queue-item");
    vi.mocked(getQueueItem).mockResolvedValue(null);
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/queue/item/web-missing");
    const res = await GET(req, {
      params: Promise.resolve({ taskId: "web-missing" }),
    });
    expect(res.status).toBe(404);
  });
});
