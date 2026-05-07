/**
 * Circuit-breaker parser for historical agent execution.
 *
 * Parses JSONL lines from circuit-breaker.jsonl and reconstructs
 * AgentLifecycle objects representing completed and in-flight tasks.
 *
 * Event types:
 * - forge_begin: {type?: "forge_begin", event?: "forge_begin", task_id: string, ts: ISO8601 | epoch-ms}
 * - forge_end: {type?: "forge_end", event?: "forge_end", task_id: string, ts: ISO8601 | epoch-ms, success: boolean}
 * - tool_call: {type?: "tool_call", task_id: string, tool: string, ts: ISO8601 | epoch-ms}
 * - heartbeat: {event: "heartbeat", ...} (filtered out)
 */

import type { StationName } from "./scene";

export interface ParsedCbEvent {
  type: "forge_begin" | "forge_end" | "tool_call";
  taskId: string;
  ts: number; // epoch milliseconds
  success?: boolean; // forge_end only
  tool?: string; // tool_call only
  agent?: string; // forge_begin/end
}

export interface AgentLifecycle {
  taskId: string;
  spawnedAt: number; // epoch ms
  finishedAt: number | null; // epoch ms or null if still running
  toolSequence: Array<{ tool: string; ts: number }>;
  station: StationName;
  status: "working" | "completed" | "failed";
}

/**
 * Deterministically map a task_id to a station.
 * Uses simple hash modulo to assign to one of the 10 stations.
 */
export function deriveStation(taskId: string): StationName {
  const STATIONS: StationName[] = [
    "hub",
    "forge",
    "watchtower",
    "overlook",
    "library",
    "shadow",
    "armory",
    "drafting",
    "pulpit",
    "loadingBay",
  ];

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) {
    hash = ((hash << 5) - hash) + taskId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  const index = Math.abs(hash) % STATIONS.length;
  return STATIONS[index];
}

/**
 * Parse ISO8601 or epoch-ms timestamp to milliseconds since epoch.
 * Handles both formats: "2026-05-07T07:32:14Z" and raw epoch ms.
 */
export function parseTimestamp(ts: string | number): number {
  if (typeof ts === "number") {
    return ts;
  }
  const parsed = Date.parse(ts);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse an array of JSONL lines into ParsedCbEvent objects.
 * Filters out non-task events (heartbeat, etc).
 * Handles malformed JSON gracefully.
 */
export function parseCircuitBreakerEvents(lines: string[]): ParsedCbEvent[] {
  const events: ParsedCbEvent[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const obj = JSON.parse(line);
      if (!obj || typeof obj !== "object") continue;

      // Determine event type — both "event" and "type" fields are used
      const eventType = obj.event || obj.type;

      // forge_begin
      if (eventType === "forge_begin") {
        const taskId = obj.task_id;
        if (!taskId) continue;
        events.push({
          type: "forge_begin",
          taskId,
          ts: parseTimestamp(obj.ts),
          agent: obj.agent,
        });
      }

      // forge_end
      if (eventType === "forge_end") {
        const taskId = obj.task_id;
        if (!taskId) continue;
        events.push({
          type: "forge_end",
          taskId,
          ts: parseTimestamp(obj.ts),
          success: obj.success === true,
          agent: obj.agent,
        });
      }

      // tool_call (less common, but may exist in expanded CB format)
      if (eventType === "tool_call") {
        const taskId = obj.task_id;
        if (!taskId) continue;
        events.push({
          type: "tool_call",
          taskId,
          ts: parseTimestamp(obj.ts),
          tool: obj.tool,
        });
      }
    } catch (e) {
      // Silently skip malformed JSON lines
      continue;
    }
  }

  return events;
}

/**
 * Reconstruct agent lifecycles from a flat event stream.
 * Groups events by taskId and derives lifecycle metadata.
 */
export function reconstructAgentLifecycles(
  events: ParsedCbEvent[]
): AgentLifecycle[] {
  const byTaskId = new Map<string, ParsedCbEvent[]>();

  // Group events by taskId
  for (const event of events) {
    const existing = byTaskId.get(event.taskId) || [];
    existing.push(event);
    byTaskId.set(event.taskId, existing);
  }

  // Reconstruct lifecycles
  const lifecycles: AgentLifecycle[] = [];

  for (const taskId of Array.from(byTaskId.keys())) {
    const taskEvents = byTaskId.get(taskId) || [];
    // Find forge_begin and forge_end
    const begin = taskEvents.find((e) => e.type === "forge_begin");
    const end = taskEvents.find((e) => e.type === "forge_end");

    if (!begin) {
      // No begin event — can't reconstruct
      continue;
    }

    // Collect tool calls
    const toolSequence = taskEvents
      .filter((e) => e.type === "tool_call")
      .map((e) => ({
        tool: e.tool || "unknown",
        ts: e.ts,
      }))
      .sort((a, b) => a.ts - b.ts);

    // Determine status
    let status: "working" | "completed" | "failed" = "working";
    if (end) {
      status = end.success ? "completed" : "failed";
    }

    const lifecycle: AgentLifecycle = {
      taskId,
      spawnedAt: begin.ts,
      finishedAt: end?.ts ?? null,
      toolSequence,
      station: deriveStation(taskId),
      status,
    };

    lifecycles.push(lifecycle);
  }

  return lifecycles;
}
