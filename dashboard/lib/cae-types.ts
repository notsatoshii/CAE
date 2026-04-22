export interface Phase {
  number: number
  name: string
  planFiles: string[]
  status: "idle" | "active" | "done" | "failed"
}

export interface Project {
  name: string
  path: string
  hasPlanning: boolean
  /**
   * Phase 10 D-02: Shift lifecycle phase from `.shift/state.json::phase`.
   * null or undefined when the project has no `.shift/` directory (not a Shift project).
   */
  shiftPhase?: string | null
  /**
   * Phase 10 D-02: ISO timestamp from `.shift/state.json::updated`.
   * null or undefined when the project has no `.shift/` directory.
   * Used as Plan-home sort key (descending).
   */
  shiftUpdated?: string | null
}

export interface InboxTask {
  taskId: string
  createdAt: Date
  buildplanPath: string
  metaPath: string
  hasBuildplan: boolean
}

export interface OutboxTask {
  taskId: string
  hasDone: boolean
  processed: boolean
  status?: string
  summary?: string
  branch?: string
  commits?: string[]
}

export interface CbState {
  activeForgeCount: number
  activeTaskIds: string[]
  recentFailures: number
  recentPhantomEscalations: number
  halted: boolean
}

// Phase 4 home state types (re-exported for convenience)
export type {
  Rollup,
  AgentActive,
  PhaseSummary,
  RecentEvent,
  NeedsYouItem,
  HomeState,
} from "./cae-home-state"

/**
 * Canonical circuit-breakers.jsonl event schema — SNAKE_CASE, matches
 * bin/circuit_breakers.py `_log()` output exactly. Added in Phase 7 Wave 0
 * (plan 07-01, decision D-02) to replace the hallucinated camelCase schema
 * previously read by cae-home-state.ts / cae-agents-state.ts /
 * app/api/state/route.ts.
 *
 * All fields are optional EXCEPT `ts` and `event` — aggregators MUST use
 * typeof-guards when reading any field (defensive coercion pattern
 * established in Phase 4 04-01 SUMMARY).
 *
 * Ground truth reference: bin/circuit_breakers.py lines 108-195 +
 * dashboard/.cae/metrics/circuit-breakers.jsonl sample rows.
 */
export interface CbEvent {
  ts: string              // ISO8601 Z — REQUIRED on every row
  event: string           // see CB_EVENT_KINDS — REQUIRED
  task_id?: string
  attempt?: number
  success?: boolean
  // token_usage event (emitted by adapters/claude-code.sh in Phase 7 Wave 0)
  input_tokens?: number
  output_tokens?: number
  model?: string
  agent?: string
  // limit_exceeded
  limit?: string          // "max_retries" | "max_turns" | "max_input_tokens" | "max_output_tokens" | "max_concurrent_forge_timeout"
  detail?: string
  value?: number
  // sentinel_json_failure
  count?: number
  cap?: number
  // escalate_to_phantom
  forge_attempts?: number
  // halt
  reason?: string
  telegram_notify?: boolean
  // sentinel_fallback_triggered
  failures?: number
}

/**
 * Enumerated event kinds observed or emittable. Use as a type guard or for
 * exhaustiveness checks. Presence of a kind here does NOT mean every field
 * on CbEvent is populated for that kind — each kind writes its own subset.
 */
export const CB_EVENT_KINDS = [
  "forge_begin",
  "forge_end",
  "forge_slot_acquired",
  "forge_slot_released",
  "limit_exceeded",
  "escalate_to_phantom",
  "phantom_end",
  "halt",
  "sentinel_json_failure",
  "sentinel_fallback_triggered",
  "token_usage",           // NEW — emitted by adapters/claude-code.sh after Wave 0
] as const
export type CbEventKind = typeof CB_EVENT_KINDS[number]
