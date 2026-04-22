/**
 * Heuristic token-cost estimator — Phase 9 Plan 01 (Wave 0).
 *
 * Implements D-07 + GATE-01: any token-spending server action that the
 * Nexus "explain before doing" gate wraps is quantified here. No LLM call,
 * no network I/O, no disk reads — deterministic math on what the caller
 * already knows about the action.
 *
 * Defaults (D-07):
 *   - workflow_run: avg of priorRuns, or 10_000 when no history.
 *   - delegate_new: 8_000 flat (buildplanLength reserved for v2; v1 ignores).
 *   - retry_task: avg of priorAttempts, or 5_000 when no history (CONTEXT
 *     §D-07 notes the 5k default in the research doc).
 *   - chat_send: 0. Chat messages never gate — typing is the confirmation
 *     (D-07 "Not gated" list + Q6 in the research).
 *
 * Gate threshold (GATE-01): estimate >= 1000. `chat_send` bypasses with
 * a hard `false`. Threshold is inclusive — an exact 1000 gates.
 */

/**
 * Shape of any action routed through the explain-before-doing gate.
 * Closed literal union so `estimateTokens()`'s switch is exhaustive at the
 * type level — adding a new variant here fails the build if the switch is
 * not updated.
 */
export type ChatGatedActionSpec =
  | {
      type: "workflow_run";
      slug: string;
      /** Historical tokens for this workflow's prior runs (newest-first OK). */
      priorRuns?: number[];
    }
  | {
      type: "delegate_new";
      /** Length of the buildplan in characters (reserved for v2; ignored in v1). */
      buildplanLength?: number;
    }
  | {
      type: "retry_task";
      /** Tokens spent by each prior attempt of this task. */
      priorAttempts?: number[];
    }
  | {
      /** Plain chat message — never gated. */
      type: "chat_send";
    };

/** GATE-01 inclusive threshold. */
const GATE_THRESHOLD_TOKENS = 1000;

const WORKFLOW_DEFAULT_TOKENS = 10_000;
const DELEGATE_DEFAULT_TOKENS = 8_000;
const RETRY_DEFAULT_TOKENS = 5_000;

function averageOrDefault(
  samples: number[] | undefined,
  fallback: number,
): number {
  if (!samples || samples.length === 0) return fallback;
  const sum = samples.reduce((a, b) => a + b, 0);
  return Math.round(sum / samples.length);
}

/**
 * Heuristic cost estimate for an action. No LLM, no I/O.
 * See module docstring for per-variant rules.
 */
export function estimateTokens(action: ChatGatedActionSpec): number {
  switch (action.type) {
    case "chat_send":
      return 0;
    case "delegate_new":
      // v1: flat default. buildplanLength is accepted but not used; this
      // keeps the API stable for v2 to compute length-scaled estimates.
      return DELEGATE_DEFAULT_TOKENS;
    case "workflow_run":
      return averageOrDefault(action.priorRuns, WORKFLOW_DEFAULT_TOKENS);
    case "retry_task":
      return averageOrDefault(action.priorAttempts, RETRY_DEFAULT_TOKENS);
  }
}

/**
 * GATE-01 decision: should this action surface the explain-before-doing
 * confirmation dialog? True when estimate >= 1000; chat_send always false.
 */
export function shouldGate(action: ChatGatedActionSpec): boolean {
  if (action.type === "chat_send") return false;
  return estimateTokens(action) >= GATE_THRESHOLD_TOKENS;
}
