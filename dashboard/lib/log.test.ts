/**
 * Tests for lib/log.ts — pino-backed structured logger with AsyncLocalStorage correlation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test behaviour via captured stdout writes.
// pino writes synchronously (or near-synchronously) to the destination.
// We intercept process.stdout.write to capture JSON lines.

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

function lastLine(): Record<string, unknown> {
  const lines = captured.join("").split("\n").filter(Boolean);
  const last = lines[lines.length - 1];
  return JSON.parse(last);
}

describe("log(scope)", () => {
  it("emits a JSON line with scope field", async () => {
    const { log } = await import("@/lib/log");
    log("test.scope").info({ k: "v" }, "hello");
    const obj = lastLine();
    expect(obj.scope).toBe("test.scope");
    expect(obj.msg).toBe("hello");
    expect(obj.k).toBe("v");
    expect(obj.level).toBe("info");
    expect(typeof obj.time).toBe("number");
  });

  it("emits err.message on error()", async () => {
    const { log } = await import("@/lib/log");
    const err = new Error("boom");
    log("test.err").error({ err }, "failed");
    const obj = lastLine();
    expect(obj.level).toBe("error");
    // pino serializes Error objects via the err serializer
    const errField = obj.err as Record<string, unknown>;
    expect(errField.message).toBe("boom");
    expect(typeof errField.stack).toBe("string");
  });

  it("defaults scope to 'app' when no argument passed", async () => {
    const { log } = await import("@/lib/log");
    log().info({}, "no-scope");
    const obj = lastLine();
    expect(obj.scope).toBe("app");
  });

  it("redacts authorization headers", async () => {
    const { log } = await import("@/lib/log");
    log("test.redact").info({ headers: { authorization: "Bearer SECRET" } }, "auth-log");
    const obj = lastLine();
    const headers = obj.headers as Record<string, unknown>;
    expect(headers.authorization).toBe("[redacted]");
  });

  it("redacts cookie headers", async () => {
    const { log } = await import("@/lib/log");
    log("test.redact").info({ headers: { cookie: "session=abc123" } }, "cookie-log");
    const obj = lastLine();
    const headers = obj.headers as Record<string, unknown>;
    expect(headers.cookie).toBe("[redacted]");
  });

  it("redacts nested authjs.session-token key with literal dot in name", async () => {
    const { log } = await import("@/lib/log");
    log("test.redact").info({ cookies: { "authjs.session-token": "abc" } }, "authjs-token-log");
    const obj = lastLine();
    const cookies = obj.cookies as Record<string, unknown>;
    expect(cookies["authjs.session-token"]).toBe("[redacted]");
  });
});

describe("reqCtx AsyncLocalStorage mixin", () => {
  it("threads reqId through the store into log lines", async () => {
    const { log, reqCtx } = await import("@/lib/log");
    await reqCtx.run({ reqId: "test-req-123", route: "/api/test" }, async () => {
      log("ctx.test").info({}, "inside-ctx");
    });
    const obj = lastLine();
    expect(obj.reqId).toBe("test-req-123");
    expect(obj.route).toBe("/api/test");
  });

  it("does not emit reqId outside reqCtx.run", async () => {
    const { log } = await import("@/lib/log");
    log("ctx.outside").info({}, "outside-ctx");
    const obj = lastLine();
    expect(obj.reqId).toBeUndefined();
  });
});
