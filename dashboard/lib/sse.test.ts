/**
 * Tests for lib/sse.ts — WR-01 SSE id contract (plan 13-04).
 *
 * A1: encodeSSE("", ...) produces NO `id:` line (ephemeral frames)
 * A2: encodeSSE("abc", ...) produces `id: abc` line (persisted frames)
 *
 * The id contract is: id MUST be non-empty iff the frame represents a
 * persisted event the client should promote to lastSeenMsgId. Delta frames
 * and heartbeat ticks are ephemeral and MUST receive id="".
 */

import { describe, it, expect } from "vitest";
import { encodeSSE } from "./sse";

describe("encodeSSE — WR-01 id contract", () => {
  it("A1: empty id produces NO id: line in the frame", () => {
    const frame = encodeSSE("", "assistant.delta", { delta: "hi" });
    const lines = frame.split("\n").filter(Boolean);
    const idLines = lines.filter((l) => l.startsWith("id:"));
    expect(idLines).toHaveLength(0);
  });

  it("A2: non-empty id produces `id: <value>` line in the frame", () => {
    const frame = encodeSSE("abc-123", "assistant.begin", { sessionId: "s" });
    const lines = frame.split("\n").filter(Boolean);
    const idLines = lines.filter((l) => l.startsWith("id:"));
    expect(idLines).toHaveLength(1);
    expect(idLines[0]).toBe("id: abc-123");
  });

  it("always includes event: and data: lines", () => {
    const frame = encodeSSE("", "unread_tick", { unread: 1 });
    expect(frame).toContain("event: unread_tick");
    expect(frame).toContain("data: ");
  });

  it("data line contains JSON-serialized payload", () => {
    const payload = { delta: "hello world", extra: 42 };
    const frame = encodeSSE("", "assistant.delta", payload);
    const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
    expect(dataLine).toBeDefined();
    const parsed = JSON.parse(dataLine!.slice("data: ".length));
    expect(parsed).toEqual(payload);
  });

  it("frame ends with double newline (SSE terminator)", () => {
    const frame = encodeSSE("x", "assistant.end", { msg_id: "x" });
    expect(frame.endsWith("\n\n")).toBe(true);
  });

  it("non-empty id frame: id line appears before event line", () => {
    const frame = encodeSSE("my-id", "assistant.begin", {});
    const idIdx = frame.indexOf("id: my-id");
    const evIdx = frame.indexOf("event: assistant.begin");
    expect(idIdx).toBeGreaterThanOrEqual(0);
    expect(evIdx).toBeGreaterThanOrEqual(0);
    expect(idIdx).toBeLessThan(evIdx);
  });
});
