/**
 * Unit tests for lib/cae-chat-state.ts — Phase 9 Plan 03 Task 1 (TDD).
 *
 * Security-critical surface: UUID validation + path-traversal guard +
 * atomic JSONL append under concurrency + meta round-trip semantics.
 *
 * Per 09-CONTEXT D-08 (session jsonl at `${CAE_ROOT}/.cae/chat/{uuid}.jsonl`),
 * D-17 (per-message UUID for de-dupe + replay-from-id), gotchas 3/4/9/15.
 *
 * Isolation strategy: each test sets `process.env.CAE_ROOT` to a fresh tempdir
 * BEFORE calling the lib, so the lib's in-function CAE_ROOT re-read picks up
 * the fresh root. The lib is written to re-read CAE_ROOT from process.env on
 * every call (no module-level caching) — see implementation note.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// We import the lib AFTER setting CAE_ROOT env in each test via dynamic import
// inside a helper, to defeat any lingering module-state caches. Vitest
// does not cache across `await import()` when the module itself doesn't
// cache env — but to be safe we also `vi.resetModules()` between tests.
import { vi } from "vitest";

let tmpRoot: string;
let savedCaeRoot: string | undefined;

async function importLib() {
  vi.resetModules();
  return await import("./cae-chat-state");
}

beforeEach(async () => {
  savedCaeRoot = process.env.CAE_ROOT;
  tmpRoot = await fs.mkdtemp(join(tmpdir(), "cae-chat-test-"));
  process.env.CAE_ROOT = tmpRoot;
  await fs.mkdir(join(tmpRoot, ".cae", "chat"), { recursive: true });
});

afterEach(async () => {
  if (savedCaeRoot === undefined) delete process.env.CAE_ROOT;
  else process.env.CAE_ROOT = savedCaeRoot;
  try {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("validateSessionId", () => {
  it("accepts a real v4 UUID", async () => {
    const { validateSessionId } = await importLib();
    expect(() =>
      validateSessionId("550e8400-e29b-41d4-a716-446655440000"),
    ).not.toThrow();
  });

  it("accepts uppercase UUIDs", async () => {
    const { validateSessionId } = await importLib();
    expect(() =>
      validateSessionId("AABBCCDD-EEFF-4001-8002-AABBCCDDEEFF"),
    ).not.toThrow();
  });

  it("rejects a traversal attempt", async () => {
    const { validateSessionId, ValidationError } = await importLib();
    expect(() => validateSessionId("../../etc/passwd")).toThrow(ValidationError);
  });

  it("rejects a plain word", async () => {
    const { validateSessionId, ValidationError } = await importLib();
    expect(() => validateSessionId("foo")).toThrow(ValidationError);
  });

  it("rejects an empty string", async () => {
    const { validateSessionId, ValidationError } = await importLib();
    expect(() => validateSessionId("")).toThrow(ValidationError);
  });

  it("rejects null", async () => {
    const { validateSessionId, ValidationError } = await importLib();
    expect(() => validateSessionId(null)).toThrow(ValidationError);
  });

  it("rejects undefined", async () => {
    const { validateSessionId, ValidationError } = await importLib();
    expect(() => validateSessionId(undefined)).toThrow(ValidationError);
  });

  it("rejects number input", async () => {
    const { validateSessionId, ValidationError } = await importLib();
    expect(() => validateSessionId(12345)).toThrow(ValidationError);
  });

  it("rejects a UUID with trailing newline + injection", async () => {
    const { validateSessionId, ValidationError } = await importLib();
    expect(() =>
      validateSessionId(
        "550e8400-e29b-41d4-a716-446655440000\nmalicious",
      ),
    ).toThrow(ValidationError);
  });

  it("rejects a UUID with a leading slash", async () => {
    const { validateSessionId, ValidationError } = await importLib();
    expect(() =>
      validateSessionId("/550e8400-e29b-41d4-a716-446655440000"),
    ).toThrow(ValidationError);
  });

  it("rejects a UUID with embedded dots", async () => {
    const { validateSessionId, ValidationError } = await importLib();
    expect(() =>
      validateSessionId("550e8400-e29b-41d4-a716-44665544..00"),
    ).toThrow(ValidationError);
  });
});

describe("resolveChatPath", () => {
  it("returns expected path under CAE_ROOT/.cae/chat/", async () => {
    const { resolveChatPath } = await importLib();
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const p = resolveChatPath(uuid);
    expect(p).toBe(join(tmpRoot, ".cae", "chat", `${uuid}.jsonl`));
    expect(p.startsWith(join(tmpRoot, ".cae", "chat") + "/")).toBe(true);
  });

  it("rejects a traversal attempt early (at validation)", async () => {
    const { resolveChatPath, ValidationError } = await importLib();
    expect(() => resolveChatPath("../../etc/passwd")).toThrow(ValidationError);
  });
});

describe("getOrCreateSession + getSessionMeta round-trip", () => {
  it("creates a new uuid with a meta-first-line", async () => {
    const { getOrCreateSession, getSessionMeta, resolveChatPath } =
      await importLib();
    const id = await getOrCreateSession("nexus");
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    // File must exist
    const path = resolveChatPath(id);
    const text = await fs.readFile(path, "utf8");
    const firstLine = text.split("\n", 1)[0];
    const parsed = JSON.parse(firstLine);
    expect(parsed.role).toBe("meta");
    expect(parsed.agent).toBe("nexus");
    expect(parsed.session_id).toBe(id);
    expect(typeof parsed.created_at).toBe("string");

    const meta = await getSessionMeta(id);
    expect(meta?.agent).toBe("nexus");
    expect(meta?.session_id).toBe(id);
  });

  it("getSessionMeta returns null for a non-existent session", async () => {
    const { getSessionMeta } = await importLib();
    const meta = await getSessionMeta(
      "00000000-0000-4000-8000-000000000000",
    );
    expect(meta).toBeNull();
  });
});

describe("setSessionMeta", () => {
  it("rewrites line 1 only; preserves subsequent lines", async () => {
    const { getOrCreateSession, setSessionMeta, getSessionMeta, appendMessage, readTranscript } =
      await importLib();
    const id = await getOrCreateSession("nexus");
    await appendMessage(id, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ts: new Date().toISOString(),
      role: "user",
      content: "hello",
      route: "/build",
    });
    await appendMessage(id, {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      ts: new Date().toISOString(),
      role: "assistant",
      content: "hi back",
      agent: "nexus",
    });

    // Flip persona to phantom
    const meta = await getSessionMeta(id);
    expect(meta).not.toBeNull();
    await setSessionMeta(id, { ...meta!, agent: "phantom" });

    const updated = await getSessionMeta(id);
    expect(updated?.agent).toBe("phantom");

    // Messages survive the meta rewrite
    const msgs = await readTranscript(id);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe("hello");
    expect(msgs[1].content).toBe("hi back");
  });
});

describe("appendMessage + readTranscript round-trip", () => {
  it("reads N appended messages in order, excluding the meta line", async () => {
    const { getOrCreateSession, appendMessage, readTranscript } = await importLib();
    const id = await getOrCreateSession("forge");
    const ids = ["a", "b", "c"].map((_k, i) =>
      `${i}0000000-0000-4000-8000-000000000000`,
    );
    for (let i = 0; i < 3; i++) {
      await appendMessage(id, {
        id: ids[i],
        ts: new Date(Date.now() + i).toISOString(),
        role: "user",
        content: `msg${i}`,
        route: "/build",
      });
    }
    const all = await readTranscript(id);
    expect(all).toHaveLength(3);
    expect(all.map((m) => m.content)).toEqual(["msg0", "msg1", "msg2"]);
  });

  it("limit returns the last N messages", async () => {
    const { getOrCreateSession, appendMessage, readTranscript } = await importLib();
    const id = await getOrCreateSession("forge");
    for (let i = 0; i < 5; i++) {
      await appendMessage(id, {
        id: `${i}0000000-0000-4000-8000-000000000000`,
        ts: new Date(Date.now() + i).toISOString(),
        role: "user",
        content: `msg${i}`,
      });
    }
    const last2 = await readTranscript(id, 2);
    expect(last2.map((m) => m.content)).toEqual(["msg3", "msg4"]);
  });

  it("returns [] for a non-existent session", async () => {
    const { readTranscript } = await importLib();
    const msgs = await readTranscript(
      "00000000-0000-4000-8000-000000000000",
    );
    expect(msgs).toEqual([]);
  });
});

describe("readTranscriptAfter", () => {
  it("returns messages after the given id (exclusive)", async () => {
    const { getOrCreateSession, appendMessage, readTranscriptAfter } =
      await importLib();
    const id = await getOrCreateSession("nexus");
    const ids = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ];
    for (let i = 0; i < 3; i++) {
      await appendMessage(id, {
        id: ids[i],
        ts: new Date(Date.now() + i).toISOString(),
        role: "user",
        content: `m${i}`,
      });
    }
    const after1 = await readTranscriptAfter(id, ids[0]);
    expect(after1.map((m) => m.content)).toEqual(["m1", "m2"]);

    const afterNull = await readTranscriptAfter(id, null);
    expect(afterNull.map((m) => m.content)).toEqual(["m0", "m1", "m2"]);

    const afterUnknown = await readTranscriptAfter(
      id,
      "99999999-9999-4999-8999-999999999999",
    );
    // Design decision: replay-from-unknown returns [] (client's last_seen is stale).
    expect(afterUnknown).toEqual([]);
  });
});

describe("concurrent appendMessage", () => {
  it("survives parallel writes without torn lines", async () => {
    const { getOrCreateSession, appendMessage, readTranscript } = await importLib();
    const id = await getOrCreateSession("forge");
    const N = 20;
    const writes = [];
    for (let i = 0; i < N; i++) {
      writes.push(
        appendMessage(id, {
          id: `${i.toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`,
          ts: new Date().toISOString(),
          role: "user",
          content: `parallel-${i}`,
        }),
      );
    }
    await Promise.all(writes);
    const all = await readTranscript(id);
    expect(all).toHaveLength(N);
    const seen = new Set(all.map((m) => m.content));
    for (let i = 0; i < N; i++) {
      expect(seen.has(`parallel-${i}`)).toBe(true);
    }
    // Every line must be valid JSON — readTranscript silently drops torn lines,
    // so the cardinality check above is the torn-line guard.
  });
});

describe("listSessions", () => {
  it("returns newest-first by mtime, with preview + count", async () => {
    const { getOrCreateSession, appendMessage, listSessions } = await importLib();
    const a = await getOrCreateSession("nexus");
    // Small spacing so mtimes differ
    await new Promise((r) => setTimeout(r, 10));
    const b = await getOrCreateSession("forge");
    await new Promise((r) => setTimeout(r, 10));
    const c = await getOrCreateSession("phantom");

    // Add a message to 'c' — that must keep it "newest" by mtime too.
    await appendMessage(c, {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      ts: new Date().toISOString(),
      role: "user",
      content: "x".repeat(200),
    });

    const sessions = await listSessions();
    expect(sessions.map((s) => s.session_id)).toEqual([c, b, a]);
    // c has a user message that is 200 chars — preview must truncate to 80.
    const cEntry = sessions.find((s) => s.session_id === c)!;
    expect(cEntry.last_preview.length).toBe(80);
    expect(cEntry.message_count).toBe(1);
    expect(cEntry.agent).toBe("phantom");

    // a has no user messages, preview should be empty, count 0.
    const aEntry = sessions.find((s) => s.session_id === a)!;
    expect(aEntry.last_preview).toBe("");
    expect(aEntry.message_count).toBe(0);
  });
});
