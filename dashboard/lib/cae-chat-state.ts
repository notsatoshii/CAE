/**
 * Chat transcript + session + meta + validation — Phase 9 Plan 03 Task 1.
 *
 * Pure IO helpers over `${CAE_ROOT}/.cae/chat/{uuid}.jsonl` per 09-CONTEXT D-08
 * (chat is GLOBAL, cross-project, one jsonl per session). Every line of the
 * session jsonl is a JSON object:
 *   - line 1: `{role:"meta", session_id, agent, created_at}` (SessionMeta)
 *   - line 2+: ChatMessage records with a per-message UUID for D-17 replay
 *     and SSE de-dupe.
 *
 * Security (09-CONTEXT §Security, gotcha #3, threat T-09-03-02):
 *   - validateSessionId regex-guards every sessionId before fs access.
 *   - resolveChatPath additionally asserts the resolved path starts with
 *     `${CAE_ROOT}/.cae/chat/` so a regex-bypass (impossible given the v4
 *     UUID shape) still cannot escape the chat directory.
 *
 * Atomicity (gotcha #15):
 *   - appendMessage uses fs.appendFile for a single-syscall atomic append
 *     (POSIX atomic for lines <4KB — every chat line fits).
 *   - setSessionMeta uses write-tmp + rename for atomic meta rewrite.
 *
 * Env semantics: CAE_ROOT is re-read on every call (no module-level cache)
 * so unit tests can swap the root per-test. In production CAE_ROOT is set
 * once at process start; the re-read cost is negligible (env lookup + one
 * resolve).
 */

import { promises as fs } from "fs";
import { existsSync } from "fs";
import { resolve, join } from "path";
import { randomUUID } from "crypto";
import type { AgentName } from "./copy/agent-meta";

export class ValidationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ValidationError";
  }
}

// Canonical v4-shape UUID regex (case-insensitive), anchored, full-string.
// Rejects any control/newline/punctuation outside the hyphen-separated hex
// groups. Used as the first-pass sessionId guard (09-CONTEXT gotcha #3).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SessionMeta {
  session_id: string;
  agent: AgentName;
  created_at: string;
}

export interface ChatMessage {
  /** Per-message UUID (D-17) — clients use this as last_seen_msg_id for
   *  SSE reconnect de-dupe + server-side replay from jsonl. */
  id: string;
  ts: string;
  role: "user" | "assistant";
  content: string;
  /** On assistant messages only. */
  agent?: AgentName;
  /** On user messages only — which dashboard route they were on when sent. */
  route?: string;
  /** On assistant messages only — reported by claude --print stream-json. */
  tokens?: { in: number; out: number };
}

export interface SessionSummary {
  session_id: string;
  agent: AgentName;
  created_at: string;
  mtime_ms: number;
  /** ≤80-char snippet of the last message in the thread (either role). */
  last_preview: string;
  /** Count of ChatMessage records only (excludes the meta line). */
  message_count: number;
}

/**
 * Asserts the input is a string that matches the v4-shape UUID regex.
 * Throws ValidationError on any non-match (including non-string, empty,
 * path-traversal attempts, newline-injection attempts).
 */
export function validateSessionId(input: unknown): asserts input is string {
  if (typeof input !== "string")
    throw new ValidationError("sessionId not a string");
  if (!UUID_RE.test(input))
    throw new ValidationError(
      `sessionId does not match UUID regex: ${input.slice(0, 40)}`,
    );
}

function caeRoot(): string {
  return process.env.CAE_ROOT ?? "/home/cae/ctrl-alt-elite";
}

function chatDir(): string {
  return resolve(caeRoot(), ".cae", "chat");
}

/**
 * Resolves a session's jsonl path under `${CAE_ROOT}/.cae/chat/` and asserts
 * the resolved path cannot escape that directory (defense-in-depth even
 * though the UUID regex already prevents traversal characters).
 */
export function resolveChatPath(sessionId: string): string {
  validateSessionId(sessionId);
  const base = chatDir();
  const p = resolve(base, `${sessionId}.jsonl`);
  if (!p.startsWith(base + "/"))
    throw new ValidationError("path traversal detected in sessionId");
  return p;
}

async function ensureChatDir(): Promise<void> {
  const dir = chatDir();
  if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true });
}

/**
 * Creates a new session jsonl. First line is the SessionMeta record so every
 * caller of `getSessionMeta` can recover the persona without a DB. Uses
 * `flag: "wx"` to fail if the uuid somehow collides (should not happen —
 * randomUUID is 122 bits of entropy).
 */
export async function getOrCreateSession(agent: AgentName): Promise<string> {
  await ensureChatDir();
  const id = randomUUID();
  const meta: SessionMeta = {
    session_id: id,
    agent,
    created_at: new Date().toISOString(),
  };
  const path = resolveChatPath(id);
  await fs.writeFile(
    path,
    JSON.stringify({ role: "meta", ...meta }) + "\n",
    { flag: "wx" },
  );
  return id;
}

/**
 * Appends one ChatMessage line to a session's jsonl. Atomic under concurrent
 * writers because `fs.appendFile` is a single syscall (O_APPEND) for lines
 * within the POSIX atomic-write size (~4KB); chat lines never exceed this.
 */
export async function appendMessage(
  sessionId: string,
  msg: ChatMessage,
): Promise<void> {
  const path = resolveChatPath(sessionId);
  await fs.appendFile(path, JSON.stringify(msg) + "\n");
}

/**
 * Reads all ChatMessage records from a session (excluding the meta line).
 * Silently drops any line that fails JSON.parse (defensive against torn
 * writes, though fs.appendFile should prevent those in practice).
 */
export async function readTranscript(
  sessionId: string,
  limit?: number,
): Promise<ChatMessage[]> {
  const path = resolveChatPath(sessionId);
  let text: string;
  try {
    text = await fs.readFile(path, "utf8");
  } catch {
    return [];
  }
  const lines = text.split("\n").filter(Boolean);
  const msgs: ChatMessage[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      if (obj.role === "meta") continue;
      if (obj.role === "user" || obj.role === "assistant") {
        msgs.push(obj as unknown as ChatMessage);
      }
    } catch {
      /* torn or invalid line — skip */
    }
  }
  if (typeof limit === "number") return msgs.slice(-limit);
  return msgs;
}

/**
 * Replay-from-id semantics (D-17). If `afterMsgId` is null, returns full
 * transcript (client has no prior state). If it matches a known message,
 * returns everything strictly after that index. If it matches no known
 * message, returns [] — client's `last_seen` is stale and it should force a
 * full transcript refetch via `readTranscript`.
 */
export async function readTranscriptAfter(
  sessionId: string,
  afterMsgId: string | null,
): Promise<ChatMessage[]> {
  const all = await readTranscript(sessionId);
  if (!afterMsgId) return all;
  const idx = all.findIndex((m) => m.id === afterMsgId);
  if (idx < 0) return [];
  return all.slice(idx + 1);
}

/**
 * Reads the first line of the session jsonl and parses it as SessionMeta.
 * Returns null if the file doesn't exist, is empty, or the first line is
 * not a meta record.
 */
export async function getSessionMeta(
  sessionId: string,
): Promise<SessionMeta | null> {
  const path = resolveChatPath(sessionId);
  let text: string;
  try {
    text = await fs.readFile(path, "utf8");
  } catch {
    return null;
  }
  const firstLine = text.split("\n", 1)[0];
  if (!firstLine) return null;
  try {
    const obj = JSON.parse(firstLine) as Record<string, unknown>;
    if (obj.role !== "meta") return null;
    return {
      session_id: obj.session_id as string,
      agent: obj.agent as AgentName,
      created_at: obj.created_at as string,
    };
  } catch {
    return null;
  }
}

/**
 * Rewrites line 1 of the session jsonl to a new SessionMeta, preserving
 * every subsequent line. Atomic via write-tmp + rename on same FS.
 */
export async function setSessionMeta(
  sessionId: string,
  meta: SessionMeta,
): Promise<void> {
  const path = resolveChatPath(sessionId);
  const text = await fs.readFile(path, "utf8");
  const lines = text.split("\n");
  lines[0] = JSON.stringify({ role: "meta", ...meta });
  const tmp = path + ".tmp";
  await fs.writeFile(tmp, lines.join("\n"));
  await fs.rename(tmp, path);
}

/**
 * Lists all sessions in the chat directory, newest-first by mtime.
 * Ignores non-jsonl files and files whose basename is not a valid UUID.
 * Silently drops files with no meta line (e.g. partial creates).
 */
export async function listSessions(): Promise<SessionSummary[]> {
  await ensureChatDir();
  const dir = chatDir();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: SessionSummary[] = [];
  for (const f of entries) {
    if (!f.endsWith(".jsonl")) continue;
    const id = f.slice(0, -".jsonl".length);
    if (!UUID_RE.test(id)) continue;
    const p = join(dir, f);
    let st;
    try {
      st = await fs.stat(p);
    } catch {
      continue;
    }
    const meta = await getSessionMeta(id);
    if (!meta) continue;
    const all = await readTranscript(id);
    const last = all[all.length - 1];
    const preview = last ? last.content.slice(0, 80) : "";
    out.push({
      session_id: id,
      agent: meta.agent,
      created_at: meta.created_at,
      mtime_ms: st.mtimeMs,
      last_preview: preview,
      message_count: all.length,
    });
  }
  out.sort((a, b) => b.mtime_ms - a.mtime_ms);
  return out;
}
