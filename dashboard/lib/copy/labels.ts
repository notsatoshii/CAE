/**
 * Centralized founder-speak ↔ dev-speak translation table.
 *
 * Consumed by client components (via `useDevMode()` → `labelFor(dev)`)
 * and by server pages (via `labelFor(false)` — server-render founder-speak).
 *
 * This module is pure data + a pure function; no React, no side effects.
 * Safe to import from Node for unit tests.
 *
 * See .planning/phases/03-design-system-foundation/03-CONTEXT.md
 * §Founder-speak copy pass for the authoritative translation table.
 */

export interface Labels {
  // Page-level headings
  buildHomeHeading: (project: string) => string;
  planHomeHeading: string;
  planPlaceholder: string;
  queueHeading: string;
  metricsSectionHeading: string;
  // Phase list table
  phasesListColName: string;
  phasesListColPlans: string;
  // Breakers panel
  breakerActiveForge: string;
  breakerInputTokens: string;
  breakerOutputTokens: string;
  breakerRetries: string;
  breakerPhantom: string;
  breakerHalted: string;
  breakerHaltedYes: string;
  breakerHaltedNo: string;
  // Metrics tabs
  metricTabBreakers: string;
  metricTabSentinel: string;
  metricTabCompaction: string;
  metricTabApprovals: string;
  // Queue sections
  queueInboxHeading: string;
  queueInboxSub: string;
  queueOutboxHeading: string;
  queueOutboxSub: string;
  queueColTaskId: string;
  queueColBuildplan: string;
  queueColBranch: string;
  queueColCommits: string;
  // Delegation form
  delegateHeading: string;
  delegateRepoField: string;
  delegateBuildplanField: string;
  delegateSubmit: string;
  delegateSubmitPending: string;
  // Phase detail
  phaseDetailHeading: (n: number, name: string) => string;
  phaseDetailBackLabel: string;
  phaseDetailBranchLabel: string;
  // Waves view
  waveHeading: (n: number) => string;
  mergedCommitsHeading: string;
  attemptSuffix: (n: number) => string;
  viewOutputButton: string;
  noTasksEmpty: (phaseDir: string) => string;
}

const FOUNDER: Labels = {
  buildHomeHeading: (project) => `Building ${project}`,
  planHomeHeading: "Plan",
  planPlaceholder:
    "Plan your next feature. Walk through intake, approve specs and next-steps lists, and hand off to CAE. Coming in Phase 10.",
  queueHeading: "Work queue",
  metricsSectionHeading: "What's happening",
  phasesListColName: "Feature",
  phasesListColPlans: "Steps",
  breakerActiveForge: "Builders working right now",
  breakerInputTokens: "Reading today",
  breakerOutputTokens: "Writing today",
  breakerRetries: "Second tries",
  breakerPhantom: "Debug escalations",
  breakerHalted: "Is CAE stuck?",
  breakerHaltedYes: "paused itself",
  breakerHaltedNo: "all good",
  metricTabBreakers: "Pauses",
  metricTabSentinel: "Checks",
  metricTabCompaction: "Memory cleanup",
  metricTabApprovals: "Approvals",
  queueInboxHeading: "Waiting to run",
  queueInboxSub: "jobs lined up for CAE",
  queueOutboxHeading: "Shipped",
  queueOutboxSub: "finished jobs",
  queueColTaskId: "Job ID",
  queueColBuildplan: "Instructions",
  queueColBranch: "Version",
  queueColCommits: "Changes",
  delegateHeading: "Send a job to CAE",
  delegateRepoField: "Which project? (optional)",
  delegateBuildplanField: "What should CAE do?",
  delegateSubmit: "Send it",
  delegateSubmitPending: "Sending…",
  phaseDetailHeading: (_n, name) => name,
  phaseDetailBackLabel: "← Back",
  phaseDetailBranchLabel: "Version",
  waveHeading: (n) => `Step ${n}`,
  mergedCommitsHeading: "Shipped changes",
  attemptSuffix: (n) => `${n}× try`,
  viewOutputButton: "See what's happening",
  noTasksEmpty: (phaseDir) => `No jobs yet. Check the plan files in ${phaseDir}`,
};

const DEV: Labels = {
  buildHomeHeading: (project) => `Build — ${project}`,
  planHomeHeading: "Plan mode",
  planPlaceholder:
    "Plan mode — this is where you'll start new projects, walk through intake, approve PRDs and roadmaps, and hand off to CAE. Coming in Phase 10.",
  queueHeading: "CAE Queue",
  metricsSectionHeading: "Metrics",
  phasesListColName: "Name",
  phasesListColPlans: "Plans",
  breakerActiveForge: "Active Forge",
  breakerInputTokens: "Input tokens today",
  breakerOutputTokens: "Output tokens today",
  breakerRetries: "Retries",
  breakerPhantom: "Phantom escalations",
  breakerHalted: "Halted",
  breakerHaltedYes: "halted",
  breakerHaltedNo: "running",
  metricTabBreakers: "Breakers",
  metricTabSentinel: "Sentinel",
  metricTabCompaction: "Compaction",
  metricTabApprovals: "Approvals",
  queueInboxHeading: "Inbox",
  queueInboxSub: "awaiting execution",
  queueOutboxHeading: "Outbox",
  queueOutboxSub: "completed",
  queueColTaskId: "Task ID",
  queueColBuildplan: "BUILDPLAN",
  queueColBranch: "Branch",
  queueColCommits: "Commits",
  delegateHeading: "Delegate to CAE",
  delegateRepoField: "Target repo path (optional)",
  delegateBuildplanField: "BUILDPLAN (required)",
  delegateSubmit: "Delegate to CAE",
  delegateSubmitPending: "Delegating…",
  phaseDetailHeading: (n, name) => `Phase ${String(n).padStart(2, "0")} — ${name}`,
  phaseDetailBackLabel: "← Build",
  phaseDetailBranchLabel: "Branch",
  waveHeading: (n) => `Wave ${n}`,
  mergedCommitsHeading: "Merged commits",
  attemptSuffix: (n) => `${n}× attempt`,
  viewOutputButton: "View output",
  noTasksEmpty: (phaseDir) => `No tasks found. Check plan files in ${phaseDir}`,
};

export function labelFor(dev: boolean): Labels {
  return dev ? DEV : FOUNDER;
}

export const LABELS = { FOUNDER, DEV };
