/**
 * Server-Sent Event frame encoder — extracted from app/api/chat/send/route.ts.
 *
 * id contract (WR-01, Phase 13 plan 13-04):
 *   - Pass a non-empty `id` ONLY when the frame represents a persisted event
 *     that the client should treat as a checkpoint (e.g. lastSeenMsgId).
 *     Concretely: `assistant.begin` and `assistant.end` carry the stable
 *     assistantMsgId that was written to the session jsonl.
 *   - Pass `""` for ephemeral frames (text deltas, unread heartbeat ticks,
 *     rate_limited notices). These frames must NOT advance the client's
 *     lastSeenMsgId cursor.
 *
 * Rationale: if every frame carries a unique id, clients that call
 *   `if (e.lastEventId) setLastSeenMsgId(e.lastEventId)`
 * will promote ephemeral UUIDs that never appear in durable storage.
 * `readTranscriptAfter(sid, lastSeenMsgId)` then finds no match and
 * returns [], making unread counts always 0 after page reload.
 *
 * See: app/api/chat/send/route.test.ts for the contract tests.
 * See: WR-01 in .planning/phases/13-ui-ux-review-polish-loop/audit/UI-AUDIT-correctness.md
 */

/**
 * Encode a Server-Sent Event frame.
 *
 * The `id` field is OMITTED entirely when `id === ""` so the browser's
 * EventSource does not update its internal `lastEventId` for ephemeral
 * frames. When `id` is non-empty, the frame is a persisted checkpoint
 * the client may safely promote to `lastSeenMsgId`.
 */
export function encodeSSE(id: string, event: string, data: unknown): string {
  const parts: string[] = [];
  if (id) parts.push(`id: ${id}`);
  parts.push(`event: ${event}`);
  parts.push(`data: ${JSON.stringify(data)}`);
  return parts.join("\n") + "\n\n";
}
