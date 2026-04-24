/**
 * class19b — POST /api/queue/item/[taskId]/action tests.
 *
 * Covers:
 *   - viewer → 403
 *   - unsupported action → 400
 *   - supported action → 200 + result passed through
 *   - bad taskId → 400 (defense-in-depth even when middleware passes it)
 *   - only the 4 wired actions are supported; pause/abandon/reassign/edit
 *     must be rejected.
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

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: authMock,
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
    abortTask: vi
      .fn()
      .mockResolvedValue({ ok: true, action: "abort", taskId: "web-a" }),
    retryTask: vi
      .fn()
      .mockResolvedValue({ ok: true, action: "retry", taskId: "web-a" }),
    approveReview: vi
      .fn()
      .mockResolvedValue({ ok: true, action: "approve", taskId: "web-a" }),
    denyReview: vi
      .fn()
      .mockResolvedValue({ ok: true, action: "deny", taskId: "web-a" }),
  };
});

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/queue/item/web-a/action", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/queue/item/[taskId]/action", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("viewer → 403", async () => {
    authMock.mockResolvedValue({
      user: { email: "v@example.com", role: "viewer" },
    });
    const { POST } = await import("./route");
    const res = await POST(makeReq({ action: "abort" }), {
      params: Promise.resolve({ taskId: "web-a" }),
    });
    expect(res.status).toBe(403);
  });

  it("operator → abort succeeds", async () => {
    authMock.mockResolvedValue({
      user: { email: "o@example.com", role: "operator" },
    });
    const { POST } = await import("./route");
    const res = await POST(makeReq({ action: "abort" }), {
      params: Promise.resolve({ taskId: "web-a" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("abort");
    expect(body.ok).toBe(true);
  });

  it.each([["pause"], ["abandon"], ["reassign"], ["edit-plan"], ["wat"]])(
    "unsupported action %s → 400",
    async (action) => {
      authMock.mockResolvedValue({
        user: { email: "o@example.com", role: "operator" },
      });
      const { POST } = await import("./route");
      const res = await POST(makeReq({ action }), {
        params: Promise.resolve({ taskId: "web-a" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/unsupported/);
    },
  );

  it("bad taskId → 400", async () => {
    authMock.mockResolvedValue({
      user: { email: "o@example.com", role: "operator" },
    });
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/queue/item/bad;rm/action", {
        method: "POST",
        body: JSON.stringify({ action: "abort" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ taskId: "bad;rm" }) },
    );
    expect(res.status).toBe(400);
  });

  it("unauthenticated → 401", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("./route");
    const res = await POST(makeReq({ action: "abort" }), {
      params: Promise.resolve({ taskId: "web-a" }),
    });
    expect(res.status).toBe(401);
  });

  it("malformed body → 400", async () => {
    authMock.mockResolvedValue({
      user: { email: "o@example.com", role: "operator" },
    });
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/queue/item/web-a/action", {
        method: "POST",
        body: "not json",
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ taskId: "web-a" }) },
    );
    expect(res.status).toBe(400);
  });
});
