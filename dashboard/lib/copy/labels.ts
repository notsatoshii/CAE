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
 * Phase 4 additions (rollup / active phase cards / live-ops / needs-you /
 * recent ledger / task detail sheet) extend the interface below.
 */

// Internal helper — compact token counts for phase card display.
// e.g. 842 -> "842", 3450 -> "3.4k", 1234567 -> "1.23M"
function formatTok(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

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

  // === Phase 4: Rollup strip ===
  rollupShippedLabel: string;
  rollupTokensLabel: string;
  rollupInFlightLabel: string;
  rollupBlockedLabel: string;
  rollupWarningsLabel: string;
  rollupEmptyState: string;

  // === Phase 4: Active phase cards ===
  activePhasesHeading: string;
  activePhasesEmpty: string;
  phaseCardEtaLabel: (minutes: number) => string;
  phaseCardWaveLabel: (current: number, total: number) => string;
  phaseCardProgressLabel: (pct: number) => string;
  phaseCardTokensLabel: (tokens: number) => string;
  phaseCardTitle: (projectName: string, phaseNumber: number) => string;

  // === Phase 4: Live Ops one-liner ===
  liveOpsIdle: string;
  liveOpsSectionLabel: string;

  // === Phase 4: Needs-you ===
  needsYouHeading: string;
  needsYouEmpty: string;
  needsYouBlockedLabel: (rejectCount: number) => string;
  needsYouDangerousLabel: string;
  needsYouPlanReviewLabel: string;
  needsYouReviewAction: string;
  needsYouApproveAction: string;
  needsYouDenyAction: string;
  needsYouOpenAction: string;

  // === Phase 4: Recent ledger ===
  recentHeading: string;
  recentEmpty: string;
  recentShippedPrefix: (agentDisplay: string) => string;
  recentAbortedPrefix: (agentDisplay: string) => string;

  // === Phase 4: Task detail sheet ===
  sheetCloseLabel: string;
  sheetPauseLabel: string;
  sheetAbortLabel: string;
  sheetSectionSummary: string;
  sheetSectionLog: string;
  sheetSectionChanges: string;
  sheetSectionMemory: string;
  sheetSectionComments: string;
  sheetCommentsStub: string;
  sheetSectionActions: string;
  sheetActionApprove: string;
  sheetActionDeny: string;
  sheetActionRetry: string;
  sheetActionAbandon: string;
  sheetActionReassign: string;
  sheetActionEditPlan: string;
  sheetMemoryStub: string;
  sheetLogTruncatedNote: string;
  sheetLogPauseScroll: string;
  sheetLogResumeScroll: string;

  // === Phase 5: Agents tab ===
  agentsPageHeading: string;
  agentsGroupActive: (n: number) => string;
  agentsGroupRecent: (n: number) => string;
  agentsGroupDormant: (n: number) => string;
  agentsGroupEmpty: string;
  agentsHeadline: (label: string, founder_label: string) => string;
  agentsStatTokensPerHour: string;
  agentsStatSuccess: string;
  agentsStatWall: string;
  agentsLiveActiveLabel: (n: number) => string;
  agentsLiveQueuedLabel: (n: number) => string;
  agentsLive24hLabel: (n: number) => string;
  agentsIdleLine: (daysInactive: number, lastRunDay: string) => string;
  agentsIdleNever: string;
  agentsDriftBanner: (label: string, pct7d: number, pct30d: number) => string;
  agentsDrawerTitle: string;
  agentsDrawerPersonaHeading: string;
  agentsDrawerPersonaMissing: string;
  agentsDrawerModelOverrideHeading: string;
  agentsDrawerModelSaveLabel: string;
  agentsDrawerLifetimeHeading: string;
  agentsDrawerLifetimeTasks: string;
  agentsDrawerLifetimeTokens: string;
  agentsDrawerLifetimeSuccess: string;
  agentsDrawerLifetimeAvg: string;
  agentsDrawerTopExpensiveHeading: string;
  agentsDrawerRecentHeading: string;
  agentsDrawerRecentEmpty: string;
  agentsDrawerRecentStatusOk: string;
  agentsDrawerRecentStatusFail: string;
  agentsListFailedToLoad: string;

  // === Phase 6: Workflows + Queue ===
  workflowsPageHeading: string;
  workflowsListEmpty: string;
  workflowsCreateButton: string;
  workflowsListRowLastRun: (relativeTime: string) => string;
  workflowsListRowNeverRun: string;
  workflowsListRowRunButton: string;
  workflowsListRowStepCount: (n: number) => string;
  workflowsNewPageHeading: string;
  workflowsEditPageHeading: (name: string) => string;
  workflowsNlTextareaPlaceholder: string;
  workflowsNlTextareaLabel: string;
  workflowsDraftBtn: string;
  workflowsDraftBtnPending: string;
  workflowsSaveBtn: string;
  workflowsSaveBtnPending: string;
  workflowsRunBtn: string;
  workflowsRunBtnPending: string;
  workflowsAdvancedYamlHeading: string;
  workflowsStepGraphHeading: string;
  workflowsValidationErrorHeading: string;
  workflowsNlCouldNotParseNote: string;
  workflowsDeleteBtn: string;
  workflowsDeleteConfirm: (name: string) => string;
  queueKanbanColWaiting: string;
  queueKanbanColInProgress: string;
  queueKanbanColDoubleCheck: string;
  queueKanbanColStuck: string;
  queueKanbanColShipped: string;
  queueKanbanColCount: (n: number) => string;
  queueKanbanEmptyColumn: string;
  queueKanbanNewJobButton: string;
  queueKanbanNewJobModalTitle: string;
  queueCardAgentProjectLine: (project: string, relativeTime: string) => string;
  queueCardLivePulseLabel: string;
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

  // === Phase 4: Rollup strip ===
  rollupShippedLabel: "shipped",
  rollupTokensLabel: "tok",
  rollupInFlightLabel: "in-flight",
  rollupBlockedLabel: "blocked",
  rollupWarningsLabel: "⚠",
  rollupEmptyState: "No activity today.",

  // === Phase 4: Active phase cards ===
  activePhasesHeading: "Active phases",
  activePhasesEmpty: "No active work right now. Go to Plan mode to start a project.",
  phaseCardEtaLabel: (m) => "~" + m + " min left",
  phaseCardWaveLabel: (cur, tot) => "step " + cur + " of " + tot,
  phaseCardProgressLabel: (pct) => pct + "% done",
  phaseCardTokensLabel: (tok) => formatTok(tok) + " tok this phase",
  phaseCardTitle: (projectName, _phaseNumber) => "Building " + projectName,

  // === Phase 4: Live Ops one-liner ===
  liveOpsIdle: "Nothing running right now.",
  liveOpsSectionLabel: "Live Ops",

  // === Phase 4: Needs-you ===
  needsYouHeading: "Needs you",
  needsYouEmpty: "All caught up ✓",
  needsYouBlockedLabel: (n) => "Sentinel rejected " + n + "×",
  needsYouDangerousLabel: "dangerous action needs approval",
  needsYouPlanReviewLabel: "Next steps ready for review",
  needsYouReviewAction: "Review",
  needsYouApproveAction: "Approve",
  needsYouDenyAction: "Deny",
  needsYouOpenAction: "Open plan",

  // === Phase 4: Recent ledger ===
  recentHeading: "Recent",
  recentEmpty: "Nothing shipped yet today.",
  recentShippedPrefix: (agent) => "Built with " + agent,
  recentAbortedPrefix: (agent) => "couldn't finish — " + agent + " flagged it",

  // === Phase 4: Task detail sheet ===
  sheetCloseLabel: "Close",
  sheetPauseLabel: "Pause this",
  sheetAbortLabel: "Stop this job",
  sheetSectionSummary: "What this does",
  sheetSectionLog: "Live activity",
  sheetSectionChanges: "What changed",
  sheetSectionMemory: "What CAE looked at",
  sheetSectionComments: "Comments",
  sheetCommentsStub: "Comments ship with chat in Phase 9",
  sheetSectionActions: "Actions",
  sheetActionApprove: "Approve",
  sheetActionDeny: "Deny",
  sheetActionRetry: "Try again",
  sheetActionAbandon: "Abandon",
  sheetActionReassign: "Hand to another agent",
  sheetActionEditPlan: "Edit plan",
  sheetMemoryStub: "ships in Phase 8",
  sheetLogTruncatedNote: "…earlier lines truncated",
  sheetLogPauseScroll: "Pause scroll",
  sheetLogResumeScroll: "Resume scroll",

  // === Phase 5: Agents tab ===
  agentsPageHeading: "The team",
  agentsGroupActive: (n) => "Working now (" + n + ")",
  agentsGroupRecent: (n) => "Recently active (" + n + ")",
  agentsGroupDormant: (n) => "Quiet (" + n + ")",
  agentsGroupEmpty: "No one here right now.",
  agentsHeadline: (label, founder_label) => label + " — " + founder_label,
  agentsStatTokensPerHour: "tokens / hour",
  agentsStatSuccess: "success rate",
  agentsStatWall: "avg task time",
  agentsLiveActiveLabel: (n) => n + " working",
  agentsLiveQueuedLabel: (n) => n + " waiting",
  agentsLive24hLabel: (n) => n + " / day",
  agentsIdleLine: (d, day) => "inactive " + d + "d · last run " + day,
  agentsIdleNever: "never run",
  agentsDriftBanner: (label, p7, _p30) =>
    label + " is having a rough week — success rate dropped to " + Math.round(p7 * 100) + "%",
  agentsDrawerTitle: "Agent details",
  agentsDrawerPersonaHeading: "About",
  agentsDrawerPersonaMissing: "No notes on file yet.",
  agentsDrawerModelOverrideHeading: "Which model?",
  agentsDrawerModelSaveLabel: "Save",
  agentsDrawerLifetimeHeading: "All-time",
  agentsDrawerLifetimeTasks: "tasks done",
  agentsDrawerLifetimeTokens: "tokens used",
  agentsDrawerLifetimeSuccess: "getting it right",
  agentsDrawerLifetimeAvg: "avg time per task",
  agentsDrawerTopExpensiveHeading: "Priciest jobs",
  agentsDrawerRecentHeading: "Recent jobs",
  agentsDrawerRecentEmpty: "No jobs yet.",
  agentsDrawerRecentStatusOk: "shipped",
  agentsDrawerRecentStatusFail: "stuck",
  agentsListFailedToLoad: "Couldn't load the team. Try refreshing.",

  // === Phase 6: Workflows + Queue ===
  workflowsPageHeading: "Recipes",
  workflowsListEmpty: "No recipes yet. Describe what you want to automate and CAE will draft it.",
  workflowsCreateButton: "New recipe",
  workflowsListRowLastRun: (t) => "ran " + t,
  workflowsListRowNeverRun: "never run",
  workflowsListRowRunButton: "Run now",
  workflowsListRowStepCount: (n) => n === 1 ? "1 step" : n + " steps",
  workflowsNewPageHeading: "New recipe",
  workflowsEditPageHeading: (name) => "Recipe: " + name,
  workflowsNlTextareaPlaceholder: "Describe what you want this recipe to do. Example: Every Monday, Forge updates our dependencies, Sentinel reviews, I approve, then push.",
  workflowsNlTextareaLabel: "What should this recipe do?",
  workflowsDraftBtn: "Draft it",
  workflowsDraftBtnPending: "Drafting…",
  workflowsSaveBtn: "Save recipe",
  workflowsSaveBtnPending: "Saving…",
  workflowsRunBtn: "Run now",
  workflowsRunBtnPending: "Starting…",
  workflowsAdvancedYamlHeading: "Advanced: YAML",
  workflowsStepGraphHeading: "Here's the recipe",
  workflowsValidationErrorHeading: "Hmm, something's off",
  workflowsNlCouldNotParseNote: "Couldn't parse fully — please refine the description.",
  workflowsDeleteBtn: "Delete recipe",
  workflowsDeleteConfirm: (name) => "Delete the '" + name + "' recipe? This can't be undone.",
  queueKanbanColWaiting: "Waiting",
  queueKanbanColInProgress: "Working on it",
  queueKanbanColDoubleCheck: "Double-checking",
  queueKanbanColStuck: "Stuck",
  queueKanbanColShipped: "Shipped",
  queueKanbanColCount: (n) => "(" + n + ")",
  queueKanbanEmptyColumn: "—",
  queueKanbanNewJobButton: "New job",
  queueKanbanNewJobModalTitle: "Send a job to CAE",
  queueCardAgentProjectLine: (project, t) => project + " · " + t,
  queueCardLivePulseLabel: "running now",
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

  // === Phase 4: Rollup strip ===
  rollupShippedLabel: "shipped",
  rollupTokensLabel: "tok",
  rollupInFlightLabel: "in-flight",
  rollupBlockedLabel: "blocked",
  rollupWarningsLabel: "⚠",
  rollupEmptyState: "No events today.",

  // === Phase 4: Active phase cards ===
  activePhasesHeading: "Active phases",
  activePhasesEmpty: "No in-flight phases.",
  phaseCardEtaLabel: (m) => "ETA ~" + m + "m",
  phaseCardWaveLabel: (cur, tot) => "wave " + cur + "/" + tot,
  phaseCardProgressLabel: (pct) => pct + "%",
  phaseCardTokensLabel: (tok) => formatTok(tok) + " tok",
  phaseCardTitle: (projectName, phaseNumber) => projectName + " · phase " + phaseNumber,

  // === Phase 4: Live Ops one-liner ===
  liveOpsIdle: "Idle.",
  liveOpsSectionLabel: "Live Ops",

  // === Phase 4: Needs-you ===
  needsYouHeading: "Needs you",
  needsYouEmpty: "No pending items.",
  needsYouBlockedLabel: (n) => "Sentinel rejected " + n + "× — review",
  needsYouDangerousLabel: "dangerous action pending",
  needsYouPlanReviewLabel: "ROADMAP ready for review",
  needsYouReviewAction: "Review",
  needsYouApproveAction: "Approve",
  needsYouDenyAction: "Deny",
  needsYouOpenAction: "Open plan",

  // === Phase 4: Recent ledger ===
  recentHeading: "Recent (last 20)",
  recentEmpty: "No events logged.",
  recentShippedPrefix: (agent) => agent,
  recentAbortedPrefix: (agent) => "aborted — " + agent + " rejected",

  // === Phase 4: Task detail sheet ===
  sheetCloseLabel: "Close",
  sheetPauseLabel: "Pause",
  sheetAbortLabel: "Abort",
  sheetSectionSummary: "Summary",
  sheetSectionLog: "Live log",
  sheetSectionChanges: "Changes",
  sheetSectionMemory: "Memory referenced",
  sheetSectionComments: "Comments",
  sheetCommentsStub: "Comments — Phase 9",
  sheetSectionActions: "Actions",
  sheetActionApprove: "Approve",
  sheetActionDeny: "Deny",
  sheetActionRetry: "Retry",
  sheetActionAbandon: "Abandon",
  sheetActionReassign: "Reassign",
  sheetActionEditPlan: "Edit plan",
  sheetMemoryStub: "ships in Phase 8",
  sheetLogTruncatedNote: "…earlier lines truncated (500-line cap)",
  sheetLogPauseScroll: "Pause",
  sheetLogResumeScroll: "Resume",

  // === Phase 5: Agents tab ===
  agentsPageHeading: "Agents",
  agentsGroupActive: (n) => "Active (" + n + ")",
  agentsGroupRecent: (n) => "Recently used (" + n + ")",
  agentsGroupDormant: (n) => "Dormant (" + n + ")",
  agentsGroupEmpty: "(empty)",
  agentsHeadline: (label, _founder_label) => label.toUpperCase(),
  agentsStatTokensPerHour: "tok/hr",
  agentsStatSuccess: "success 7d",
  agentsStatWall: "avg wall",
  agentsLiveActiveLabel: (n) => n + " active",
  agentsLiveQueuedLabel: (n) => n + " queued",
  agentsLive24hLabel: (n) => n + "/d",
  agentsIdleLine: (d, day) => "inactive " + d + "d · last " + day,
  agentsIdleNever: "no runs",
  agentsDriftBanner: (label, p7, p30) =>
    label.toLowerCase() +
    " success rate trending down: " +
    Math.round(p7 * 100) +
    "% vs 30d baseline " +
    Math.round(p30 * 100) +
    "% (threshold 85%)",
  agentsDrawerTitle: "Agent detail",
  agentsDrawerPersonaHeading: "Persona",
  agentsDrawerPersonaMissing: "No persona file",
  agentsDrawerModelOverrideHeading: "Model override",
  agentsDrawerModelSaveLabel: "Save",
  agentsDrawerLifetimeHeading: "Lifetime",
  agentsDrawerLifetimeTasks: "tasks total",
  agentsDrawerLifetimeTokens: "tokens total",
  agentsDrawerLifetimeSuccess: "success rate",
  agentsDrawerLifetimeAvg: "avg wall",
  agentsDrawerTopExpensiveHeading: "Top 5 by tokens",
  agentsDrawerRecentHeading: "Last 50 invocations",
  agentsDrawerRecentEmpty: "No invocations",
  agentsDrawerRecentStatusOk: "ok",
  agentsDrawerRecentStatusFail: "fail",
  agentsListFailedToLoad: "/api/agents failed",

  // === Phase 6: Workflows + Queue ===
  workflowsPageHeading: "Workflows",
  workflowsListEmpty: "No workflows defined. Create one to begin.",
  workflowsCreateButton: "New workflow",
  workflowsListRowLastRun: (t) => "last run " + t,
  workflowsListRowNeverRun: "not run",
  workflowsListRowRunButton: "Run",
  workflowsListRowStepCount: (n) => n + " step" + (n === 1 ? "" : "s"),
  workflowsNewPageHeading: "New workflow",
  workflowsEditPageHeading: (name) => "Edit: " + name,
  workflowsNlTextareaPlaceholder: "Natural-language description. Parsed by heuristic → YAML stub.",
  workflowsNlTextareaLabel: "Description",
  workflowsDraftBtn: "Draft YAML",
  workflowsDraftBtnPending: "Parsing…",
  workflowsSaveBtn: "Save",
  workflowsSaveBtnPending: "Saving…",
  workflowsRunBtn: "Run now",
  workflowsRunBtnPending: "Spawning…",
  workflowsAdvancedYamlHeading: "YAML",
  workflowsStepGraphHeading: "Step graph",
  workflowsValidationErrorHeading: "Validation errors",
  workflowsNlCouldNotParseNote: "Heuristic incomplete — refine input or edit YAML directly.",
  workflowsDeleteBtn: "Delete",
  workflowsDeleteConfirm: (name) => "Delete workflow '" + name + "'?",
  queueKanbanColWaiting: "Planned",
  queueKanbanColInProgress: "Building",
  queueKanbanColDoubleCheck: "Reviewing",
  queueKanbanColStuck: "Blocked",
  queueKanbanColShipped: "Merged",
  queueKanbanColCount: (n) => "(" + n + ")",
  queueKanbanEmptyColumn: "empty",
  queueKanbanNewJobButton: "Delegate",
  queueKanbanNewJobModalTitle: "Delegate to CAE",
  queueCardAgentProjectLine: (project, t) => project + " · " + t,
  queueCardLivePulseLabel: "in-progress",
};

export function labelFor(dev: boolean): Labels {
  return dev ? DEV : FOUNDER;
}

export const LABELS = { FOUNDER, DEV };
