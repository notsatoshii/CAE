/**
 * Unit tests for lib/chat-cost-estimate.ts — Phase 9 Plan 01 (Wave 0).
 *
 * Covers D-07 + GATE-01:
 *   - chat_send is free (0 tokens) and never gates.
 *   - workflow_run defaults to 10k, averages prior runs when given.
 *   - delegate_new defaults to 8k (buildplanLength ignored in v1).
 *   - retry_task defaults to 5k, averages prior attempts when given.
 *   - shouldGate = estimate >= 1000, except chat_send which always returns false.
 *   - Exhaustive over every ChatGatedActionSpec variant.
 */

import { describe, it, expect } from "vitest";

import { estimateTokens, shouldGate } from "./chat-cost-estimate";

describe("estimateTokens — chat_send", () => {
  it("chat_send returns 0", () => {
    expect(estimateTokens({ type: "chat_send" })).toBe(0);
  });
});

describe("estimateTokens — delegate_new (D-07)", () => {
  it("delegate_new without buildplanLength → 8000 default", () => {
    expect(estimateTokens({ type: "delegate_new" })).toBe(8000);
  });

  it("delegate_new with buildplanLength → still 8000 (v1 heuristic ignores length)", () => {
    expect(
      estimateTokens({ type: "delegate_new", buildplanLength: 500 }),
    ).toBe(8000);
    expect(
      estimateTokens({ type: "delegate_new", buildplanLength: 50000 }),
    ).toBe(8000);
  });
});

describe("estimateTokens — workflow_run (D-07)", () => {
  it("no priorRuns → 10000 default", () => {
    expect(estimateTokens({ type: "workflow_run", slug: "x" })).toBe(10000);
  });

  it("empty priorRuns array → 10000 default", () => {
    expect(
      estimateTokens({ type: "workflow_run", slug: "x", priorRuns: [] }),
    ).toBe(10000);
  });

  it("averages priorRuns when provided", () => {
    expect(
      estimateTokens({
        type: "workflow_run",
        slug: "x",
        priorRuns: [12000, 8000, 10000],
      }),
    ).toBe(10000);
  });

  it("rounds non-integer averages", () => {
    // (100 + 200 + 301) / 3 = 200.333… → 200
    expect(
      estimateTokens({
        type: "workflow_run",
        slug: "x",
        priorRuns: [100, 200, 301],
      }),
    ).toBe(200);
  });

  it("single prior run is the estimate", () => {
    expect(
      estimateTokens({
        type: "workflow_run",
        slug: "x",
        priorRuns: [4242],
      }),
    ).toBe(4242);
  });
});

describe("estimateTokens — retry_task (D-07)", () => {
  it("no priorAttempts → 5000 default", () => {
    expect(estimateTokens({ type: "retry_task" })).toBe(5000);
  });

  it("empty priorAttempts array → 5000 default", () => {
    expect(
      estimateTokens({ type: "retry_task", priorAttempts: [] }),
    ).toBe(5000);
  });

  it("averages priorAttempts when provided", () => {
    expect(
      estimateTokens({ type: "retry_task", priorAttempts: [4000, 6000] }),
    ).toBe(5000);
  });

  it("rounds non-integer averages", () => {
    // (1000 + 2000 + 3001) / 3 = 2000.333… → 2000
    expect(
      estimateTokens({
        type: "retry_task",
        priorAttempts: [1000, 2000, 3001],
      }),
    ).toBe(2000);
  });
});

describe("shouldGate — GATE-01 threshold (>= 1000)", () => {
  it("chat_send never gates", () => {
    expect(shouldGate({ type: "chat_send" })).toBe(false);
  });

  it("workflow_run without priorRuns → gates (10k >= 1000)", () => {
    expect(shouldGate({ type: "workflow_run", slug: "x" })).toBe(true);
  });

  it("delegate_new → gates (8k >= 1000)", () => {
    expect(shouldGate({ type: "delegate_new" })).toBe(true);
  });

  it("retry_task default → gates (5k >= 1000)", () => {
    expect(shouldGate({ type: "retry_task" })).toBe(true);
  });

  it("workflow_run with sub-1000 prior runs does NOT gate", () => {
    // Avg of [500, 900] = 700 < 1000.
    expect(
      shouldGate({
        type: "workflow_run",
        slug: "x",
        priorRuns: [500, 900],
      }),
    ).toBe(false);
  });

  it("workflow_run at exactly 1000 gates (boundary inclusive)", () => {
    expect(
      shouldGate({
        type: "workflow_run",
        slug: "x",
        priorRuns: [1000],
      }),
    ).toBe(true);
  });

  it("workflow_run at 999 does NOT gate", () => {
    expect(
      shouldGate({
        type: "workflow_run",
        slug: "x",
        priorRuns: [999],
      }),
    ).toBe(false);
  });
});
