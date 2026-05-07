import { describe, it, expect } from "vitest";
import {
  parseCircuitBreakerEvents,
  reconstructAgentLifecycles,
  deriveStation,
  parseTimestamp,
} from "../parse-circuit-breaker";

describe("parse-circuit-breaker", () => {
  describe("parseTimestamp", () => {
    it("parses ISO8601 timestamps", () => {
      const iso = "2026-05-07T07:32:14Z";
      const ms = parseTimestamp(iso);
      expect(ms).toBeGreaterThan(0);
    });

    it("handles epoch ms timestamps", () => {
      const epoch = 1714048334000;
      const ms = parseTimestamp(epoch);
      expect(ms).toBe(epoch);
    });

    it("returns 0 for invalid timestamps", () => {
      const invalid = parseTimestamp("not-a-date");
      expect(invalid).toBe(0);
    });
  });

  describe("deriveStation", () => {
    it("maps task_id to a valid station deterministically", () => {
      const VALID_STATIONS = [
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

      const station1 = deriveStation("p22-pl01-t1");
      expect(VALID_STATIONS).toContain(station1);

      // Same task_id should always map to same station
      const station2 = deriveStation("p22-pl01-t1");
      expect(station2).toBe(station1);
    });

    it("distributes different task_ids across stations", () => {
      const stations = new Set();
      for (let i = 0; i < 50; i++) {
        stations.add(deriveStation(`p22-pl01-t${i}`));
      }
      // Should use multiple stations (extremely unlikely to get same station 50 times in a row)
      expect(stations.size).toBeGreaterThan(1);
    });
  });

  describe("parseCircuitBreakerEvents", () => {
    it("parses forge_begin events", () => {
      const lines = [
        '{"event":"forge_begin","task_id":"p22-pl01-t1","ts":"2026-05-07T07:32:14Z","agent":"forge"}',
      ];
      const events = parseCircuitBreakerEvents(lines);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("forge_begin");
      expect(events[0].taskId).toBe("p22-pl01-t1");
    });

    it("parses forge_end events with success field", () => {
      const lines = [
        '{"event":"forge_end","task_id":"p22-pl01-t1","ts":"2026-05-07T07:32:20Z","success":true}',
      ];
      const events = parseCircuitBreakerEvents(lines);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("forge_end");
      expect(events[0].success).toBe(true);
    });

    it("filters out heartbeat events", () => {
      const lines = [
        '{"event":"heartbeat","source":"heartbeat-emitter","ts":"2026-05-07T07:32:24Z"}',
        '{"event":"forge_begin","task_id":"p22-pl01-t1","ts":"2026-05-07T07:32:14Z"}',
      ];
      const events = parseCircuitBreakerEvents(lines);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("forge_begin");
    });

    it("handles malformed JSON gracefully", () => {
      const lines = [
        '{"event":"forge_begin","task_id":"p22-pl01-t1","ts":"2026-05-07T07:32:14Z"}',
        "invalid json line",
        '{"event":"forge_end","task_id":"p22-pl01-t1","ts":"2026-05-07T07:32:20Z","success":true}',
      ];
      const events = parseCircuitBreakerEvents(lines);
      expect(events).toHaveLength(2);
    });

    it("skips events without task_id", () => {
      const lines = [
        '{"event":"forge_begin","ts":"2026-05-07T07:32:14Z"}', // missing task_id
        '{"event":"forge_begin","task_id":"p22-pl01-t1","ts":"2026-05-07T07:32:14Z"}',
      ];
      const events = parseCircuitBreakerEvents(lines);
      expect(events).toHaveLength(1);
      expect(events[0].taskId).toBe("p22-pl01-t1");
    });
  });

  describe("reconstructAgentLifecycles", () => {
    it("reconstructs a complete lifecycle from begin + end events", () => {
      const events = [
        {
          type: "forge_begin" as const,
          taskId: "p22-pl01-t1",
          ts: 1000,
          agent: "forge",
        },
        {
          type: "forge_end" as const,
          taskId: "p22-pl01-t1",
          ts: 5000,
          success: true,
        },
      ];
      const lifecycles = reconstructAgentLifecycles(events);
      expect(lifecycles).toHaveLength(1);
      expect(lifecycles[0].taskId).toBe("p22-pl01-t1");
      expect(lifecycles[0].spawnedAt).toBe(1000);
      expect(lifecycles[0].finishedAt).toBe(5000);
      expect(lifecycles[0].status).toBe("completed");
    });

    it("marks incomplete tasks as 'working'", () => {
      const events = [
        {
          type: "forge_begin" as const,
          taskId: "p22-pl01-t1",
          ts: 1000,
          agent: "forge",
        },
      ];
      const lifecycles = reconstructAgentLifecycles(events);
      expect(lifecycles).toHaveLength(1);
      expect(lifecycles[0].status).toBe("working");
      expect(lifecycles[0].finishedAt).toBeNull();
    });

    it("marks failed tasks with failed status", () => {
      const events = [
        {
          type: "forge_begin" as const,
          taskId: "p22-pl01-t2",
          ts: 1000,
        },
        {
          type: "forge_end" as const,
          taskId: "p22-pl01-t2",
          ts: 3000,
          success: false,
        },
      ];
      const lifecycles = reconstructAgentLifecycles(events);
      expect(lifecycles[0].status).toBe("failed");
    });

    it("collects tool_call events into toolSequence", () => {
      const events = [
        {
          type: "forge_begin" as const,
          taskId: "p22-pl01-t1",
          ts: 1000,
        },
        {
          type: "tool_call" as const,
          taskId: "p22-pl01-t1",
          ts: 1500,
          tool: "patch",
        },
        {
          type: "tool_call" as const,
          taskId: "p22-pl01-t1",
          ts: 2500,
          tool: "terminal",
        },
        {
          type: "forge_end" as const,
          taskId: "p22-pl01-t1",
          ts: 5000,
          success: true,
        },
      ];
      const lifecycles = reconstructAgentLifecycles(events);
      expect(lifecycles[0].toolSequence).toHaveLength(2);
      expect(lifecycles[0].toolSequence[0].tool).toBe("patch");
      expect(lifecycles[0].toolSequence[1].tool).toBe("terminal");
    });

    it("assigns deterministic station to each task", () => {
      const events = [
        {
          type: "forge_begin" as const,
          taskId: "p22-pl01-t1",
          ts: 1000,
        },
        {
          type: "forge_end" as const,
          taskId: "p22-pl01-t1",
          ts: 5000,
          success: true,
        },
      ];
      const lifecycles = reconstructAgentLifecycles(events);
      expect(lifecycles[0].station).toBeDefined();
      // Station should be deterministic
      const station1 = lifecycles[0].station;
      const lifecycles2 = reconstructAgentLifecycles(events);
      expect(lifecycles2[0].station).toBe(station1);
    });

    it("skips tasks without forge_begin", () => {
      const events = [
        {
          type: "forge_end" as const,
          taskId: "p22-pl01-t1",
          ts: 5000,
          success: true,
        },
      ];
      const lifecycles = reconstructAgentLifecycles(events);
      expect(lifecycles).toHaveLength(0);
    });
  });
});
