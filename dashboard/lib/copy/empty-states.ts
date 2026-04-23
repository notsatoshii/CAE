/**
 * EMPTY_COPY — character-rich empty-state copy table (Phase 15 Wave 2.6).
 *
 * Centralised so every "no data" surface speaks in CAE's voice:
 *   - explains what the surface IS,
 *   - tells the founder how to fill it,
 *   - and (optionally) points to the next step.
 *
 * Used with the EmptyState primitive (components/ui/empty-state.tsx) via
 * the `title` / `description` / `cta` / `tip` alias props:
 *
 *   <EmptyState
 *     {...EMPTY_COPY.queue}
 *     icon={Inbox}
 *     testId="queue-empty"
 *   />
 *
 * Pure data — no React, no side effects, safe to import from server pages
 * and unit tests alike.
 */

export const EMPTY_COPY = {
  agents: {
    title: "No agents have run yet",
    description:
      "Spin one up via the command palette ⌘K → 'run agent', or kick off a phase from /build/queue.",
    tip: "Agent cards appear here as soon as a circuit-breaker fires their first event.",
  },
  queue: {
    title: "Queue is clear",
    description:
      "Either nothing's queued, or your agents are blazing fast.",
  },
  logs: {
    title: "No tool calls captured",
    description:
      "The audit-hook fires after every Bash, Edit, Write, MultiEdit, Agent, and Task call.",
    tip: "Give it a moment — entries appear within seconds of the next tool invocation.",
  },
  memory: {
    title: "Memory is empty",
    description:
      "Memory files appear here as they're created or imported. Drop a .md file in the memory dir or run /memory/import.",
  },
  workflows: {
    title: "No workflows defined",
    description:
      "Define one from /build/workflows/new — YAML, drag-drop steps, run instantly.",
    cta: { label: "Create workflow", href: "/build/workflows/new" },
  },
  skills: {
    title: "No skills installed",
    description:
      "Browse the catalog and click Install. Each skill expands what your agents can do.",
    cta: { label: "Browse skills", href: "/build/skills" },
  },
  schedule: {
    title: "Nothing scheduled",
    description:
      "Add a job from /build/schedule/new. Cron expressions, NL parser, instant preview.",
    cta: { label: "Schedule a job", href: "/build/schedule/new" },
  },
  activity: {
    title: "All quiet",
    description:
      "Tool calls light this up the moment you start working.",
  },
  metrics: {
    title: "No metrics yet",
    description:
      "Run a phase or fire a workflow — telemetry appears here as soon as the first events stream in.",
  },
  audit: {
    title: "No audit entries yet",
    description:
      "Every mutation tool call (Bash, Edit, Write, Agent) is recorded here.",
    tip: "If you expect entries but see none, check that the audit-hook is registered in ~/.claude/settings.json.",
  },
  generic: {
    title: "Nothing to show right now",
    description: "Try refreshing or check back in a moment.",
  },
} as const;

export type EmptyCopyKey = keyof typeof EMPTY_COPY;
