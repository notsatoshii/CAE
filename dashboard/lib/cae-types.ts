export interface Phase {
  number: number
  name: string
  planFiles: string[]
  status: "idle" | "active" | "done" | "failed" | "archived"
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
  // heartbeat (Wave 1.5 F3, scripts/heartbeat-emitter.sh) — identifies the
  // emitter; "heartbeat-emitter" today, future emitters may add their own.
  source?: string
}

/**
 * Enumerated event kinds observed or emittable. Use as a type guard or for
 * exhaustiveness checks. Presence of a kind here does NOT mean every field
 * on CbEvent is populated for that kind — each kind writes its own subset.
 *
 * Writer responsibility (Wave 1.5 F2/F3/F4 audit):
 *   - forge_*           → bin/circuit_breakers.py (GSD execution layer)
 *   - sentinel_*        → bin/circuit_breakers.py (sentinel subprocess)
 *   - escalate_to_*     → bin/circuit_breakers.py
 *   - phantom_end       → bin/circuit_breakers.py
 *   - halt              → bin/circuit_breakers.py
 *   - limit_exceeded    → bin/circuit_breakers.py
 *   - token_usage       → adapters/claude-code.sh (Phase 7 Wave 0)
 *   - heartbeat         → dashboard/scripts/heartbeat-emitter.sh (cron @30s)
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
  "token_usage",           // emitted by adapters/claude-code.sh after Wave 0
  "heartbeat",             // Wave 1.5 F3 — emitted by dashboard/scripts/heartbeat-emitter.sh
] as const
export type CbEventKind = typeof CB_EVENT_KINDS[number]

// ============================================================
// Phase 14: Skills Hub + NL Cron + RBAC + Security types
// ============================================================

/**
 * A skill from the catalog — either sourced from skills.sh, clawhub, or installed locally.
 * Used by the Skills Hub (Plan 14-02) and the trust-score engine (Plan 14-05).
 */
export interface CatalogSkill {
  /** Short machine-readable slug, e.g. "vercel-labs/agent-skills" */
  name: string
  /** GitHub user or org that owns the skill */
  owner: string
  /** Where this skill comes from (primary source) */
  source: "skills.sh" | "clawhub" | "local"
  /**
   * After dedup-merge: all origins the skill was seen in.
   * Undefined for single-source skills.
   */
  sources?: Array<"skills.sh" | "clawhub" | "local">
  /** Human-readable one-liner for the skill list */
  description: string
  /** Install count from skills.sh (if available) */
  installs?: number
  /** Star count from ClawHub (if available) */
  stars?: number
  /** Full command to install this skill, e.g. "npx skills add vercel-labs/agent-skills" */
  installCmd: string
  /** URL to the skill's detail page on its source registry */
  detailUrl: string
  /** Whether the skill is currently installed in ~/.claude/skills/ */
  installed: boolean
}

/**
 * A scheduled task entry stored in scheduled_tasks.json.
 * The NL cron system (Plan 14-03) parses natural-language descriptions
 * into cron expressions and writes entries in this shape.
 */
export interface ScheduledTask {
  /** Unique slug for this schedule, e.g. "morning-brief" */
  id: string
  /** Human-written description used to derive cron — the source of truth for display */
  nl: string
  /** POSIX cron expression, 5-field, derived from nl by chrono-node + cron-parser */
  cron: string
  /** IANA timezone string, e.g. "America/New_York". Defaults to "UTC". */
  timezone: string
  /** Path to the buildplan that runs on each tick, relative to repo root */
  buildplan: string
  /** Whether the schedule is currently active */
  enabled: boolean
  /** Unix epoch seconds of last trigger. 0 = never triggered. */
  lastRun: number
  /** Unix epoch seconds of last successful completion. Undefined until first success. */
  lastCompleted?: number
  /** Unix epoch seconds when this schedule was created. */
  createdAt: number
  /** Email of the user who created this schedule. */
  createdBy: string
}

/**
 * Three-level RBAC role controlling what a user can do in the dashboard.
 * - viewer: read-only; can see all panels but cannot run or change anything.
 * - operator: can run jobs, approve/deny actions, trigger workflows.
 * - admin: full access, including changing settings and RBAC assignments.
 */
export type Role = "viewer" | "operator" | "admin"

/**
 * A single tool-call audit entry written to .cae/metrics/tool-calls.jsonl
 * by tools/audit-hook.sh on every PostToolUse event.
 */
export interface AuditEntry {
  /** ISO8601 UTC timestamp, e.g. "2026-04-23T10:00:00Z" */
  ts: string
  /** CAE task ID that owned the tool call, e.g. "t-abc123" */
  task: string
  /** Name of the Claude tool that fired, e.g. "Bash", "Write", "Edit" */
  tool: string
  /** Working directory at the time of the call */
  cwd: string
}

/**
 * A single factor that contributes to a skill's trust score.
 * Weights must sum to 1.0 across all factors for a given skill.
 */
export interface TrustFactor {
  /** Machine-readable identifier for this factor, e.g. "no-secret-leak", "tool-scope" */
  id: string
  /** Whether this factor passed its check */
  passed: boolean
  /** 0-1 weight in the total score calculation. All weights across factors sum to 1. */
  weight: number
  /** Human-readable explanation of why this passed or failed */
  reason: string
}

/**
 * Composite trust score for a skill, computed by the trust-score engine (Plan 14-05).
 * total = sum(factor.weight * (factor.passed ? 1 : 0)) * 100, rounded to integer.
 */
export interface TrustScore {
  /** 0-100 integer trust score */
  total: number
  /** Individual factors that make up the total */
  factors: TrustFactor[]
  /**
   * True when an admin has manually marked this skill as trusted.
   * When true, total is always 100 and factors contains a single admin_override factor.
   */
  overridden?: boolean
}
