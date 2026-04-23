/**
 * audit/fixtures/healthy.ts — Phase 15 Cap.2.
 *
 * Seeds a project root with 30 forge_begin/end pairs across 3 agents, a
 * stream of token_usage events, and a dense tool-calls.jsonl log, all
 * timestamped inside the last 5 minutes so the Mission Control "active
 * count" + sparkline + burn-rate light up.
 *
 * Deterministic: all timestamps are derived from a fixed anchor (now)
 * passed through a pure offset helper — no Math.random(). Two invocations
 * with the same `now` (or same real-wall-clock second) produce identical
 * bytes.
 *
 * Ground truth for event shape:
 *   - cb.log: { ts, event, task_id?, agent?, model?, input_tokens?,
 *     output_tokens?, success? } — see lib/cae-types.ts `CbEvent`.
 *   - tool-calls: { ts, task, tool, cwd } — see lib/cae-types.ts
 *     `AuditEntry`.
 *
 * Event mix:
 *   - 30 forge_begin → 25 forge_end with success=true (5 still running →
 *     active_count = 5).
 *   - 30 token_usage events summing to a realistic burn-rate (< budget).
 *   - 120 tool-call entries across 3 tasks (sparkline dense).
 */
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

// caveman: expected-truth for healthy fixture. Active=5 (25/30 ended,
// 5 still in flight); sparkline should reflect a dense tool-call stream.
// Values here are the exact strings product code should render into
// `[data-truth]` when this fixture is seeded — scorer diffs these.
// Scalar keys only: anything that depends on wall-clock drift (burn-rate
// USD, last_event_at epoch, cost_today_usd, etc.) is omitted so the diff
// stays deterministic. The scorer still credits those toward depth since
// depth counts unique keys rendered, not expected-value matches.
export function readExpectedTruth(): Record<string, string> {
  return {
    // /build mission-control hero — 5 of 30 forge_begin events unmatched.
    "mission-control.active-count": "5",
    "mission-control.empty": "false",
    "mission-control.healthy": "yes",
    // /build live-activity panel — starts in loading state under the harness;
    // if the capture waits for first fetch, healthy+last-24h-count replace these.
    // We encode the stable post-fetch values. `last-24h-count` = 120 tool-calls.
    "live-activity.healthy": "yes",
    "live-activity.last-24h-count": "120",
    // /build rollup-strip — depends on aggregator state.rollup which reads
    // forge events. Healthy fixture seeds no ships today, so shipped=0,
    // warnings=0, blocked=0, in_flight=5 (matches active_count), tokens=0.
    "rollup.healthy": "yes",
    "rollup.warnings": "0",
    "rollup.blocked": "0",
    // /build active-phase-cards + needs-you + recent-ledger — healthy fixture
    // seeds no home_phases / no needs_you / no events_recent, so they all
    // render their empty branches.
    "active-phases.empty": "yes",
    "active-phases.count": "0",
    "needs-you.empty": "yes",
    "needs-you.count": "0",
    "recent-ledger.empty": "yes",
    "recent-ledger.count": "0",

    // /metrics — panels start in loading without a seeded /api/metrics state.
    "metrics.loading": "yes",

    // /floor — canvas init renders the loading marker until the first
    // heartbeat arrives. The healthy fixture doesn't seed heartbeats, so
    // floor stays on the loading branch.
    "floor.loading": "yes",
    "floor.effects-count": "0",
    "floor.queue-size": "0",
    "floor.paused": "false",
    "floor.minimized": "false",
    "floor.popout": "false",
    "floor.auth-drifted": "false",

    // /plan — coming-soon stub is static.
    "plan.healthy": "yes",
    "plan.empty": "yes",
    "plan.projects-count": "0",
    "plan.active-prds-count": "0",
    "plan.roadmaps-count": "0",
    "plan.uat-count": "0",
    "plan.tabs-count": "4",
    "plan.stub": "true",

    // /memory — fresh mount starts in loading until /api/memory-graph returns.
    "memory.view": "browse",
    "memory.why-drawer-open": "false",
    "memory.git-drawer-open": "false",

    // Legacy queue key — kept for harness callers that still reference it.
    "build-queue.count": "0",

    // /chat layout is static; split view renders deterministically.
    "chat.healthy": "yes",
    "chat.surface": "home",
    "chat.layout": "split",
    "chat.standalone": "true",

    // /build/admin/roles — empty whitelist when env vars unset (default in tests).
    "build-admin-roles.healthy": "yes",
    "build-admin-roles.readonly": "true",

    // /build/skills tab shell — no catalog loaded under harness seeds.
    "build-skills.healthy": "yes",
    "build-skills.tab": "catalog",
    "build-skills.drawer-open": "false",

    // /build/schedule — default tab + no tasks seeded.
    "build-schedule.healthy": "yes",
    "build-schedule.tab": "list",
    "build-schedule.saving": "false",
  }
}

// caveman: 3 agent names match cae-agents-state default roster
const AGENTS = ["forge", "sentinel", "phantom"] as const
const MODELS = ["sonnet", "opus", "haiku"] as const
const TOOLS = ["Bash", "Read", "Edit", "Write", "Grep"] as const

// Helper — ISO string N ms before `now`.
function tsAt(now: number, offsetMs: number): string {
  return new Date(now - offsetMs).toISOString()
}

export async function seed(root: string): Promise<void> {
  const now = Date.now()
  const metricsDir = join(root, ".cae", "metrics")
  const sessionsDir = join(root, ".cae", "sessions")
  await mkdir(metricsDir, { recursive: true })
  await mkdir(sessionsDir, { recursive: true })

  const cbLines: string[] = []
  const toolLines: string[] = []

  // Emit 30 forge_begin events spread across last 5 minutes (300_000ms).
  // Younger events closer to now so the sparkline has recent weight.
  for (let i = 0; i < 30; i++) {
    const agent = AGENTS[i % AGENTS.length]
    const model = MODELS[i % MODELS.length]
    const taskId = `p15-pl${String(i + 1).padStart(2, "0")}-t1`
    // Spread begins across 0..270_000ms ago (oldest first → newest last).
    const beginAgo = 270_000 - i * 9_000
    cbLines.push(
      JSON.stringify({
        ts: tsAt(now, beginAgo),
        event: "forge_begin",
        task_id: taskId,
        agent,
        model,
      }),
    )

    // 25 of 30 forge_ends close successfully; 5 stay open (active_count=5).
    if (i < 25) {
      const endAgo = Math.max(1_000, beginAgo - 3_000)
      cbLines.push(
        JSON.stringify({
          ts: tsAt(now, endAgo),
          event: "forge_end",
          task_id: taskId,
          agent,
          model,
          success: true,
          input_tokens: 1200 + i * 10,
          output_tokens: 300 + i * 5,
        }),
      )
    }

    // token_usage event alongside each begin (cost surface).
    cbLines.push(
      JSON.stringify({
        ts: tsAt(now, beginAgo),
        event: "token_usage",
        task_id: taskId,
        agent,
        model,
        input_tokens: 800 + i * 20,
        output_tokens: 200 + i * 10,
      }),
    )
  }

  // 120 tool-call entries densely packed in the last 120s (2/sec-ish).
  for (let i = 0; i < 120; i++) {
    const task = `p15-pl${String((i % 30) + 1).padStart(2, "0")}-t1`
    const tool = TOOLS[i % TOOLS.length]
    // Walk backwards from now in 1s steps.
    toolLines.push(
      JSON.stringify({
        ts: tsAt(now, i * 1_000),
        task,
        tool,
        cwd: root,
      }),
    )
  }

  // Write oldest-first (aggregators read the tail; order matters for
  // forge_begin/end pairing in countActiveAgents).
  await writeFile(
    join(metricsDir, "circuit-breakers.jsonl"),
    cbLines.join("\n") + "\n",
    "utf8",
  )
  await writeFile(
    join(metricsDir, "tool-calls.jsonl"),
    toolLines.reverse().join("\n") + "\n",
    "utf8",
  )
}
