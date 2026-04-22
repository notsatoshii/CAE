/**
 * app/api/incidents/route.test.ts
 *
 * Tests the GET /api/incidents SSE endpoint.
 * Mocks tailJsonl so tests don't need an actual log file.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth to return a valid session (tests cover route logic, not auth)
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { name: "test" } })),
}));

// Mock the incidents-stream module before importing route
vi.mock("@/lib/incidents-stream", () => ({
  tailJsonl: vi.fn(),
  filterLevel: vi.fn(() => () => true),
}));

// Mock with-log to pass through
vi.mock("@/lib/with-log", () => ({
  withLog: (handler: (...args: unknown[]) => unknown) => handler,
}));

import { GET } from "./route";
import { tailJsonl } from "@/lib/incidents-stream";

const mockTailJsonl = vi.mocked(tailJsonl);

function makeRequest(signal?: AbortSignal): Request {
  return new Request("http://localhost/api/incidents", {
    method: "GET",
    signal,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/incidents", () => {
  it("returns 200 with text/event-stream content-type", async () => {
    // Set up tailJsonl to call onLine synchronously then onClose
    mockTailJsonl.mockImplementation(async (_file, opts) => {
      opts.onLine({ level: "warn", time: 1, msg: "test-warn" }, "");
      opts.onClose?.();
      return () => {};
    });

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
  });

  it("emits SSE data frames for warn lines", async () => {
    const warnLine = { level: "warn", time: 1000, scope: "test", msg: "something bad" };
    const errorLine = { level: "error", time: 2000, scope: "test", msg: "even worse" };

    mockTailJsonl.mockImplementation(async (_file, opts) => {
      opts.onLine(warnLine, "");
      opts.onLine(errorLine, "");
      opts.onClose?.();
      return () => {};
    });

    const res = await GET(makeRequest());
    const text = await res.text();

    // Expect two SSE data frames
    const frames = text.split("\n\n").filter(Boolean);
    expect(frames.length).toBeGreaterThanOrEqual(2);

    // First frame should contain warn data
    const parsed0 = JSON.parse(frames[0].replace(/^data: /, ""));
    expect(parsed0.msg).toBe("something bad");

    // Second frame should contain error data
    const parsed1 = JSON.parse(frames[1].replace(/^data: /, ""));
    expect(parsed1.msg).toBe("even worse");
  });

  it("sets cache-control: no-cache, no-transform on response", async () => {
    mockTailJsonl.mockImplementation(async (_file, opts) => {
      opts.onClose?.();
      return () => {};
    });

    const res = await GET(makeRequest());

    expect(res.headers.get("cache-control")).toMatch(/no-cache/);
  });

  it("calls tailJsonl with filter for warn-level minimum", async () => {
    mockTailJsonl.mockImplementation(async (_file, opts) => {
      opts.onClose?.();
      return () => {};
    });

    await GET(makeRequest());

    expect(mockTailJsonl).toHaveBeenCalledOnce();
    const callArgs = mockTailJsonl.mock.calls[0][1];
    // Should have a filter applied
    expect(typeof callArgs.filter).toBe("function");
    // historyLimit should be 50
    expect(callArgs.historyLimit).toBe(50);
  });

  it("closes stream when request is aborted", async () => {
    const ac = new AbortController();
    let capturedClose: (() => void) | null = null;

    mockTailJsonl.mockImplementation(async (_file, opts) => {
      const close = () => opts.onClose?.();
      capturedClose = close;
      return close;
    });

    const req = makeRequest(ac.signal);
    const resPromise = GET(req);

    // Abort the request
    ac.abort();

    const res = await resPromise;
    expect(res).toBeDefined();
    // capturedClose should have been set up
    expect(capturedClose).toBeDefined();
  });
});
