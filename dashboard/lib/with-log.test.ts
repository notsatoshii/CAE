/**
 * Tests for lib/with-log.ts — App Router HOF that wraps handlers with:
 * - reqId generation / x-correlation-id passthrough
 * - req.begin / req.end log lines with method, url, status, ms
 * - req.fail on thrown errors (rethrows)
 * - SSE stream path: logs req.end.stream-open, not req.end (no double-log)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let captured: string[] = [];
let originalWrite: typeof process.stdout.write;

beforeEach(() => {
  captured = [];
  originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: string | Uint8Array): boolean => {
    captured.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
    return true;
  };
});

afterEach(() => {
  process.stdout.write = originalWrite;
});

function parsedLines(): Record<string, unknown>[] {
  return captured
    .join("")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    })
    .filter(Boolean) as Record<string, unknown>[];
}

async function makeRequest(opts: {
  url?: string;
  method?: string;
  correlationId?: string;
}): Promise<Request> {
  const headers: Record<string, string> = {};
  if (opts.correlationId) headers["x-correlation-id"] = opts.correlationId;
  return new Request(opts.url ?? "http://localhost/api/test", {
    method: opts.method ?? "GET",
    headers,
  });
}

describe("withLog(handler, route)", () => {
  it("emits req.begin and req.end for a successful handler", async () => {
    const { withLog } = await import("@/lib/with-log");
    const handler = async (_req: Request) => new Response("ok", { status: 200 });
    const wrapped = withLog(handler, "/api/test");

    const req = await makeRequest({});
    const res = await wrapped(req);

    expect(res.status).toBe(200);
    const lines = parsedLines();
    const begin = lines.find((l) => l.msg === "req.begin");
    const end = lines.find((l) => l.msg === "req.end");

    expect(begin).toBeDefined();
    expect(begin!.method).toBe("GET");
    expect(end).toBeDefined();
    expect(end!.status).toBe(200);
    expect(typeof end!.ms).toBe("number");
  });

  it("sets x-correlation-id header on response", async () => {
    const { withLog } = await import("@/lib/with-log");
    const handler = async (_req: Request) => new Response("ok", { status: 200 });
    const wrapped = withLog(handler, "/api/test");

    const req = await makeRequest({});
    const res = await wrapped(req);

    expect(res.headers.get("x-correlation-id")).toBeTruthy();
  });

  it("uses existing x-correlation-id from request header", async () => {
    const { withLog } = await import("@/lib/with-log");
    const handler = async (_req: Request) => new Response("ok", { status: 200 });
    const wrapped = withLog(handler, "/api/test");

    const req = await makeRequest({ correlationId: "my-trace-id" });
    const res = await wrapped(req);

    expect(res.headers.get("x-correlation-id")).toBe("my-trace-id");
    const lines = parsedLines();
    const begin = lines.find((l) => l.msg === "req.begin");
    expect(begin!.reqId).toBe("my-trace-id");
  });

  it("emits req.fail and rethrows on thrown error", async () => {
    const { withLog } = await import("@/lib/with-log");
    const boom = new Error("handler exploded");
    const handler = async (_req: Request): Promise<Response> => { throw boom; };
    const wrapped = withLog(handler, "/api/test");

    const req = await makeRequest({});
    await expect(wrapped(req)).rejects.toThrow("handler exploded");

    const lines = parsedLines();
    const fail = lines.find((l) => l.msg === "req.fail");
    expect(fail).toBeDefined();
    expect(fail!.level).toBe("error");
  });

  it("logs req.end.stream-open for SSE responses (not req.end)", async () => {
    const { withLog } = await import("@/lib/with-log");
    const handler = async (_req: Request) =>
      new Response("data: hi\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    const wrapped = withLog(handler, "/api/tail");

    const req = await makeRequest({});
    await wrapped(req);

    const lines = parsedLines();
    const streamEnd = lines.find((l) => l.msg === "req.end.stream-open");
    const normalEnd = lines.find((l) => l.msg === "req.end");
    expect(streamEnd).toBeDefined();
    expect(normalEnd).toBeUndefined();
    expect(streamEnd!.stream).toBe(true);
  });

  it("threads reqId into nested log() calls via AsyncLocalStorage", async () => {
    const { withLog } = await import("@/lib/with-log");
    const { log } = await import("@/lib/log");
    const handler = async (_req: Request) => {
      log("inner").info({ marker: "nested" }, "inside-handler");
      return new Response("ok", { status: 200 });
    };
    const wrapped = withLog(handler, "/api/test");

    const req = await makeRequest({ correlationId: "trace-xyz" });
    await wrapped(req);

    const lines = parsedLines();
    const inner = lines.find((l) => l.msg === "inside-handler");
    expect(inner).toBeDefined();
    expect(inner!.reqId).toBe("trace-xyz");
    expect(inner!.marker).toBe("nested");
  });
});
