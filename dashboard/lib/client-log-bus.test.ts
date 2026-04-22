/**
 * lib/client-log-bus.test.ts
 *
 * Tests for the client-side circular log buffer + CustomEvent dispatcher.
 *
 * Tests:
 * 1. clientLog pushes entries to buffer in order
 * 2. getBuffer returns a copy (mutating it doesn't affect the internal buffer)
 * 3. Buffer respects 50-entry capacity — oldest entries drop when over limit
 * 4. clearBuffer empties the buffer
 * 5. clientLog dispatches CustomEvent 'cae:log' with the entry as detail
 * 6. subscribe() callback fires on each clientLog call
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Reset module state between tests by re-importing fresh
// (vitest isolates modules per file by default)

// Mock window.dispatchEvent since jsdom doesn't implement it consistently
const dispatchedEvents: CustomEvent[] = [];
vi.stubGlobal("dispatchEvent", (ev: CustomEvent) => {
  dispatchedEvents.push(ev);
  return true;
});

import { clientLog, getBuffer, clearBuffer, subscribe } from "./client-log-bus";

beforeEach(() => {
  clearBuffer();
  dispatchedEvents.length = 0;
});

describe("clientLog + getBuffer", () => {
  it("pushes entries to the buffer in order", () => {
    clientLog("info", "scope-a", "msg-1");
    clientLog("warn", "scope-b", "msg-2");

    const buf = getBuffer();
    expect(buf).toHaveLength(2);
    expect(buf[0].msg).toBe("msg-1");
    expect(buf[1].msg).toBe("msg-2");
  });

  it("returns a copy — mutating the copy doesn't affect the internal buffer", () => {
    clientLog("info", "scope", "entry");
    const copy = getBuffer();
    copy.push({ time: 0, level: "debug", scope: "x", msg: "injected" });
    expect(getBuffer()).toHaveLength(1);
  });

  it("includes all fields: time, level, scope, msg, ctx", () => {
    const before = Date.now();
    clientLog("error", "auth", "token expired", { code: 401 });
    const after = Date.now();

    const entry = getBuffer()[0];
    expect(entry.level).toBe("error");
    expect(entry.scope).toBe("auth");
    expect(entry.msg).toBe("token expired");
    expect(entry.ctx).toEqual({ code: 401 });
    expect(entry.time).toBeGreaterThanOrEqual(before);
    expect(entry.time).toBeLessThanOrEqual(after);
  });
});

describe("buffer capacity", () => {
  it("keeps last 50 entries when over capacity", () => {
    for (let i = 0; i < 55; i++) {
      clientLog("debug", "loop", `entry-${i}`);
    }
    const buf = getBuffer();
    expect(buf).toHaveLength(50);
    // newest should be kept
    expect(buf[buf.length - 1].msg).toBe("entry-54");
    // oldest (entry-0 through entry-4) should be dropped
    expect(buf[0].msg).toBe("entry-5");
  });
});

describe("clearBuffer", () => {
  it("empties the buffer", () => {
    clientLog("info", "x", "y");
    clearBuffer();
    expect(getBuffer()).toHaveLength(0);
  });
});

describe("CustomEvent dispatch", () => {
  it("dispatches cae:log event with entry as detail", () => {
    clientLog("warn", "agent", "failed", { retry: 3 });

    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0].type).toBe("cae:log");
    expect((dispatchedEvents[0] as CustomEvent).detail.msg).toBe("failed");
    expect((dispatchedEvents[0] as CustomEvent).detail.scope).toBe("agent");
  });
});

describe("subscribe()", () => {
  it("calls the subscriber callback on each clientLog", () => {
    const cb = vi.fn();
    const unsub = subscribe(cb);

    clientLog("info", "comp", "rendered");
    clientLog("error", "comp", "crashed");

    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb.mock.calls[0][0].msg).toBe("rendered");
    expect(cb.mock.calls[1][0].msg).toBe("crashed");

    unsub();
  });

  it("unsubscribing stops future callbacks", () => {
    const cb = vi.fn();
    const unsub = subscribe(cb);
    unsub();

    clientLog("info", "x", "after-unsub");
    expect(cb).not.toHaveBeenCalled();
  });
});
