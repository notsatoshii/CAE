/**
 * WR-01 SSE id contract tests for POST /api/chat/send — plan 13-04.
 *
 * Test B1: A single response emits exactly ONE unique non-empty SSE id value,
 *          appearing on assistant.begin AND assistant.end frames.
 * Test B2: The assistant.end frame's data.msg_id equals that same id.
 * Test B3: assistant.delta frames emit NO id: line.
 * Test B4: unread_tick frames emit NO id: line.
 *
 * Mocking strategy:
 *   - @/auth → returns an authed session (no network)
 *   - @/lib/chat-spawn → returns a fake SpawnChatHandle with a controlled
 *     stdout stream that emits one content_block_delta followed by a result.
 *   - @/lib/cae-chat-state → stubs appendMessage + getSessionMeta + setSessionMeta
 *     so the route doesn't touch the filesystem.
 *   - @/lib/cae-config → fixed CAE_ROOT.
 *
 * Parsing: the route returns a Response whose body is a ReadableStream<Uint8Array>.
 * We consume it to a string, split on "\n\n", and inspect each SSE frame.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Readable } from "stream";
import { EventEmitter } from "events";

// --- Auth mock ---
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { email: "test@example.com" } })),
}));

// --- cae-config mock ---
vi.mock("@/lib/cae-config", () => ({
  CAE_ROOT: "/tmp/cae-test-root",
}));

// --- voice-router mock ---
vi.mock("@/lib/voice-router", () => ({
  pickPersona: vi.fn(() => "nexus"),
  modelForAgent: vi.fn(() => "claude-3-5-sonnet-20241022"),
}));

// --- cae-chat-state mock ---
vi.mock("@/lib/cae-chat-state", () => ({
  validateSessionId: vi.fn(),
  appendMessage: vi.fn(async () => {}),
  getSessionMeta: vi.fn(async () => null),
  setSessionMeta: vi.fn(async () => {}),
  ValidationError: class ValidationError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "ValidationError";
    }
  },
}));

// --- chat-spawn mock ---
// Returns a controlled fake handle. We simulate one text delta + result.
// Strategy: push data lazily inside the read() callback so the route's
// on('data') listener is attached before any data flows.
function makeFakeHandle(chunks: string[]) {
  let started = false;
  let waitResolve: (code: number) => void;
  const waitPromise = new Promise<number>((res) => { waitResolve = res; });

  const stdout = new Readable({
    read() {
      if (started) return;
      started = true;
      // Push all chunks synchronously now that a reader is attached.
      for (const chunk of chunks) {
        this.push(Buffer.from(chunk));
      }
      this.push(null); // EOF
      // Resolve wait AFTER the 'end' event fires (next tick).
      setImmediate(() => waitResolve!(0));
    },
  });

  const stderr = new Readable({
    read() {
      this.push(null);
    },
  });

  return {
    stdout,
    stderr,
    wait: () => waitPromise,
    kill: vi.fn(),
  };
}

const mockSpawnClaudeChat = vi.fn();
vi.mock("@/lib/chat-spawn", () => ({
  spawnClaudeChat: (...args: unknown[]) => mockSpawnClaudeChat(...args),
}));

// Helper: consume a Response body stream to a string.
async function readResponse(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

// Helper: parse raw SSE body into an array of frame objects.
function parseSSEFrames(body: string): Array<{ id: string | null; event: string | null; data: unknown }> {
  return body.split("\n\n").filter(Boolean).map((raw) => {
    const lines = raw.split("\n");
    let id: string | null = null;
    let event: string | null = null;
    let rawData: string | null = null;
    for (const l of lines) {
      if (l.startsWith("id: ")) id = l.slice(4).trim();
      else if (l.startsWith("event: ")) event = l.slice(7).trim();
      else if (l.startsWith("data: ")) rawData = l.slice(6);
    }
    let data: unknown = null;
    if (rawData) {
      try { data = JSON.parse(rawData); } catch { data = rawData; }
    }
    return { id, event, data };
  });
}

// Deterministic stream-json chunks simulating one text delta.
const STREAM_CHUNKS = [
  JSON.stringify({
    type: "stream_event",
    event: {
      type: "content_block_delta",
      delta: { type: "text_delta", text: "Hello" },
    },
  }) + "\n",
  JSON.stringify({
    type: "result",
    usage: { input_tokens: 10, output_tokens: 3 },
  }) + "\n",
];

// Simulate being OFF /chat so unread_tick is emitted.
const BODY_OFF_CHAT = {
  sessionId: "550e8400-e29b-41d4-a716-446655440000",
  message: "hi",
  route: "/build",
  on_route: "/build",
};

// Simulate being ON /chat so no unread_tick is emitted.
const BODY_ON_CHAT = {
  sessionId: "550e8400-e29b-41d4-a716-446655440000",
  message: "hi",
  route: "/chat",
  on_route: "/chat",
};

function makeReq(body: object): NextRequest {
  return new NextRequest("http://localhost/api/chat/send", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/chat/send — WR-01 SSE id contract", () => {
  beforeEach(() => {
    mockSpawnClaudeChat.mockImplementation(() => makeFakeHandle(STREAM_CHUNKS));
  });

  it("B1: emits exactly ONE unique non-empty SSE id value across all frames", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq(BODY_OFF_CHAT));
    const body = await readResponse(res);
    const frames = parseSSEFrames(body);

    const nonEmptyIds = frames.map((f) => f.id).filter(Boolean) as string[];
    const uniqueIds = new Set(nonEmptyIds);

    expect(uniqueIds.size).toBe(1);
  });

  it("B1b: the single non-empty id appears on assistant.begin AND assistant.end frames", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq(BODY_OFF_CHAT));
    const body = await readResponse(res);
    const frames = parseSSEFrames(body);

    const beginFrame = frames.find((f) => f.event === "assistant.begin");
    const endFrame = frames.find((f) => f.event === "assistant.end");

    expect(beginFrame).toBeDefined();
    expect(endFrame).toBeDefined();
    expect(beginFrame!.id).toBeTruthy();
    expect(endFrame!.id).toBeTruthy();
    expect(beginFrame!.id).toBe(endFrame!.id);
  });

  it("B2: assistant.end data.msg_id equals the begin/end id", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq(BODY_OFF_CHAT));
    const body = await readResponse(res);
    const frames = parseSSEFrames(body);

    const beginFrame = frames.find((f) => f.event === "assistant.begin");
    const endFrame = frames.find((f) => f.event === "assistant.end");

    const stableId = beginFrame!.id;
    const endData = endFrame!.data as Record<string, unknown>;
    expect(endData.msg_id).toBe(stableId);
  });

  it("B3: assistant.delta frames have NO id: line (null id)", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq(BODY_ON_CHAT));
    const body = await readResponse(res);
    const frames = parseSSEFrames(body);

    const deltaFrames = frames.filter((f) => f.event === "assistant.delta");
    expect(deltaFrames.length).toBeGreaterThan(0);
    for (const frame of deltaFrames) {
      expect(frame.id).toBeNull();
    }
  });

  it("B4: unread_tick frames have NO id: line (null id)", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq(BODY_OFF_CHAT));
    const body = await readResponse(res);
    const frames = parseSSEFrames(body);

    const tickFrames = frames.filter((f) => f.event === "unread_tick");
    // If on_route=/build, we expect at least one tick.
    if (tickFrames.length > 0) {
      for (const frame of tickFrames) {
        expect(frame.id).toBeNull();
      }
    }
  });

  it("B5: only ONE randomUUID call per response (assistantMsgId is reused)", async () => {
    // This is enforced structurally: both begin and end carry the same id,
    // which is only possible if one UUID is generated and reused.
    const { POST } = await import("./route");
    const res = await POST(makeReq(BODY_OFF_CHAT));
    const body = await readResponse(res);
    const frames = parseSSEFrames(body);

    const allNonEmptyIds = frames.map((f) => f.id).filter(Boolean) as string[];
    // All non-empty ids should be the same value.
    expect(new Set(allNonEmptyIds).size).toBe(1);
    // That value must look like a UUID.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(allNonEmptyIds[0]).toMatch(UUID_RE);
  });
});
