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

// Internal helper — compact duration formatting for Phase 7 metrics ledes.
// Used in metricsFastLede founder-speak branch.
// e.g. 450 -> "450ms", 3400 -> "3.4s", 75000 -> "1.3m", 5400000 -> "1.5h"
function formatDuration(ms: number): string {
  if (ms < 1000) return ms + "ms";
  const sec = ms / 1000;
  if (sec < 60) return sec.toFixed(1) + "s";
  const min = sec / 60;
  if (min < 60) return min.toFixed(1) + "m";
  return (min / 60).toFixed(1) + "h";
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

  // === Phase 7: Metrics ===
  metricsPageHeading: string;
  metricsSpendingHeading: string;
  metricsSpendingTodayLabel: string;
  metricsSpendingMtdLabel: string;
  metricsSpendingProjectedLabel: string;
  metricsSpendingDisclaimer: string;
  metricsSpendingByAgentHeading: string;
  metricsSpendingDaily30dHeading: string;
  metricsSpendingTopTasksHeading: string;
  metricsSpendingTopTaskRow: (title: string, tokens: string, agent: string) => string;
  metricsWellHeading: string;
  metricsWellLede: (rate: number) => string;
  metricsWellAgentGaugeLabel: (founder_label: string, pct: number) => string;
  metricsWellAgentInsufficientSamples: string;
  metricsWellRetryHeatmapHeading: string;
  metricsWellHaltsHeading: string;
  metricsWellHaltsEmpty: string;
  metricsWellSentinelTrendHeading: string;
  metricsFastHeading: string;
  metricsFastLede: (p50ms: number) => string;
  metricsFastPerAgentHeading: string;
  metricsFastPerAgentColAgent: string;
  metricsFastPerAgentColP50: string;
  metricsFastPerAgentColP95: string;
  metricsFastPerAgentColN: string;
  metricsFastQueueDepthHeading: string;
  metricsFastQueueDepthValue: (n: number) => string;
  metricsFastTimeToMergeHeading: string;
  metricsFastTimeToMergeBinLabel: (bin: string, count: number) => string;
  metricsEmptyState: string;
  metricsFailedToLoad: string;
  // Explain-mode tooltip blurbs (D-11)
  metricsExplainP50: string;
  metricsExplainP95: string;
  metricsExplainProjected: string;
  metricsExplainTokens: string;
  metricsExplainSuccessRate: string;
  metricsExplainQueueDepth: string;
  metricsExplainTimeToMerge: string;
  metricsExplainRetryHeatmap: string;

  // === Phase 8: Memory ===
  memoryPageHeading: string;
  memoryTabBrowse: string;
  memoryTabGraph: string;
  memorySearchPlaceholder: string;
  memoryBtnRegenerate: string;
  memoryBtnRegeneratePending: string;
  memoryBtnRegenerateCooldown: (s: number) => string;
  memoryBtnWhy: string;
  memoryLabelBackLinks: string;
  memoryLabelTimeline: string;
  memoryNodeDrawerHeading: (id: string) => string;
  memoryGraphFilterPhases: string;
  memoryGraphFilterAgents: string;
  memoryGraphFilterNotes: string;
  memoryGraphFilterPrds: string;
  memoryGraphNodeCapBanner: (shown: number, total: number) => string;
  memoryWhyEmpty: string;
  memoryWhyLiveTracePill: string;
  memoryWhyHeuristicPill: string;
  memoryEmptyBrowse: string;
  memoryEmptyGraph: string;
  memoryExplainGraph: string;
  memoryExplainWhy: string;
  memoryExplainSearch: string;
  memoryExplainRegenerate: string;
  memoryFileNotFound: string;
  memoryLoadFailed: string;

  // === Phase 9: Changes tab ===
  changesPageHeading: string;
  changesPageLede: (countToday: number) => string;
  changesEmpty: string;
  changesFailedToLoad: string;
  changesProjectHeader: (projectName: string, count: number) => string;
  changesDayToday: string;
  changesDayYesterday: string;
  changesDayWeek: (dayName: string) => string;
  changesDevToggleLabel: string;
  changesDevBranchLabel: (branch: string) => string;
  changesDevShaLabel: (shaShort: string) => string;
  changesDevAgentLabel: (agent: string, model: string | null) => string;
  changesDevTokensLabel: (tokens: number) => string;
  changesDevGithubLabel: string;
  changesDevCommitsHeading: (n: number) => string;
  changesExplainTimeline: string;
  changesExplainDevToggle: string;

  // === Phase 11: Live Floor ===
  floorPageTitle: string;
  floorPopOut: string;
  floorMinimize: string;
  floorPause: string;
  floorLegend: string;
  floorReducedMotionNotice: string;
  floorAuthDriftNotice: string;
  floorStationHub: string;
  floorStationForge: string;
  floorStationWatchtower: string;
  floorStationOverlook: string;
  floorStationLibrary: string;
  floorStationShadow: string;
  floorStationArmory: string;
  floorStationDrafting: string;
  floorStationPulpit: string;
  floorStationLoadingBay: string;
  floorExplainHub: string;
  floorExplainForge: string;

  // === Phase 9: Chat ===
  chatRailCollapsedAria: string;
  chatRailExpandAria: string;
  chatRailCollapseAria: string;
  chatRailExpandedTitle: string;
  chatInputPlaceholder: string;
  chatSendButton: string;
  chatSendButtonPending: string;
  chatSuggestionsHeading: string;
  chatNewConversationButton: string;
  chatEmptyThread: string;
  chatThinking: string;
  chatRateLimited: (seconds: number) => string;
  chatUnreadAria: (n: number) => string;
  chatFailedToLoad: string;
  chatSessionListHeading: string;
  chatSessionListEmpty: string;
  chatSessionListItem: (agentLabel: string, preview: string, relTime: string) => string;
  chatMessageUserRole: string;
  chatMessageAgentRole: (founder: string, agent: string) => string;
  chatGateDialogTitle: string;
  chatGateDialogSummaryLabel: string;
  chatGateDialogCostLabel: (tokens: number) => string;
  chatGateDialogDiffLabel: string;
  chatGateDialogAccept: string;
  chatGateDialogCancel: string;
  chatGateInstantToast: (summary: string) => string;
  chatGateUndoToast: string;
  chatExplainRail: string;
  chatExplainSuggestions: string;
  chatExplainGate: string;
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

  // === Phase 7: Metrics ===
  metricsPageHeading: "How CAE is doing",
  metricsSpendingHeading: "Spending",
  metricsSpendingTodayLabel: "Today",
  metricsSpendingMtdLabel: "This month so far",
  metricsSpendingProjectedLabel: "Month projected",
  metricsSpendingDisclaimer: "Estimated from local logs. Subscription covers the bill.",
  metricsSpendingByAgentHeading: "By agent (30d)",
  metricsSpendingDaily30dHeading: "Daily (30d)",
  metricsSpendingTopTasksHeading: "Most expensive jobs",
  metricsSpendingTopTaskRow: (title, tokens, agent) => title + " — " + tokens + " tok · " + agent,
  metricsWellHeading: "How well it's going",
  metricsWellLede: (r) => "CAE is getting things right " + Math.round(r * 100) + "% of the time this week.",
  metricsWellAgentGaugeLabel: (label, pct) => label + " — " + Math.round(pct * 100) + "%",
  metricsWellAgentInsufficientSamples: "not enough jobs yet",
  metricsWellRetryHeatmapHeading: "When retries happen",
  metricsWellHaltsHeading: "When CAE paused itself",
  metricsWellHaltsEmpty: "Nothing paused this month. Nice.",
  metricsWellSentinelTrendHeading: "Times the checker pushed back",
  metricsFastHeading: "How fast",
  metricsFastLede: (p50) => "Most jobs finish in about " + formatDuration(p50) + ".",
  metricsFastPerAgentHeading: "Per-agent speed",
  metricsFastPerAgentColAgent: "Agent",
  metricsFastPerAgentColP50: "typical",
  metricsFastPerAgentColP95: "slow tail",
  metricsFastPerAgentColN: "jobs",
  metricsFastQueueDepthHeading: "Backlog right now",
  metricsFastQueueDepthValue: (n) => n === 0 ? "nothing waiting" : n + " waiting",
  metricsFastTimeToMergeHeading: "How long jobs take to ship",
  metricsFastTimeToMergeBinLabel: (bin, count) => bin + " · " + count,
  metricsEmptyState: "Pulling the numbers...",
  metricsFailedToLoad: "Couldn't load the numbers. Try refreshing.",
  metricsExplainP50: "Half the jobs finish faster than this, half slower. Rough middle.",
  metricsExplainP95: "95% of jobs finish faster than this. The slow tail you actually notice.",
  metricsExplainProjected: "If this month keeps going like it has, we'll land around this total.",
  metricsExplainTokens: "Tokens are how we count language-model work. One token is roughly 3-4 letters.",
  metricsExplainSuccessRate: "How often an agent's jobs end in a ship, not a retry or give-up.",
  metricsExplainQueueDepth: "How many jobs are queued up right now, waiting to start.",
  metricsExplainTimeToMerge: "From 'start this' to 'shipped' — including any retries.",
  metricsExplainRetryHeatmap: "Darker squares = more retries at that weekday+hour. Helps spot rough patches.",

  // === Phase 8: Memory ===
  memoryPageHeading: "Memory",
  memoryTabBrowse: "Browse",
  memoryTabGraph: "Graph",
  memorySearchPlaceholder: "Search everything CAE remembers…",
  memoryBtnRegenerate: "Regenerate graph",
  memoryBtnRegeneratePending: "Regenerating…",
  memoryBtnRegenerateCooldown: (s) => "Ready in " + s + "s",
  memoryBtnWhy: "Why?",
  memoryLabelBackLinks: "Also mentioned in",
  memoryLabelTimeline: "When this changed",
  memoryNodeDrawerHeading: (id) => "About " + id,
  memoryGraphFilterPhases: "Work in progress",
  memoryGraphFilterAgents: "Agents",
  memoryGraphFilterNotes: "Notes",
  memoryGraphFilterPrds: "Product briefs",
  memoryGraphNodeCapBanner: (shown, total) =>
    "Showing " + shown + " of " + total + " — narrow the filter to see more",
  memoryWhyEmpty: "No memory consulted for this task.",
  memoryWhyLiveTracePill: "Live trace",
  memoryWhyHeuristicPill: "Heuristic — no trace captured",
  memoryEmptyBrowse: "Nothing to show yet.",
  memoryEmptyGraph: "Graph not built yet. Click Regenerate to start.",
  memoryExplainGraph: "Arrows show which notes mention which.",
  memoryExplainWhy: "These are the memory entries CAE actually read during this task.",
  memoryExplainSearch: "Full-text search across every memory file.",
  memoryExplainRegenerate: "Rebuilds the knowledge graph from current memory files.",
  memoryFileNotFound: "This file's gone.",
  memoryLoadFailed: "Couldn't load that.",

  // === Phase 9: Changes tab ===
  changesPageHeading: "What shipped",
  changesPageLede: (n) =>
    n === 0 ? "Nothing's shipped today — yet." : n + " change" + (n === 1 ? "" : "s") + " today.",
  changesEmpty: "Nothing's shipped in the last 30 days.",
  changesFailedToLoad: "Couldn't load the timeline. Try refreshing.",
  changesProjectHeader: (name, n) => name + " · " + n + " shipped",
  changesDayToday: "Today",
  changesDayYesterday: "Yesterday",
  changesDayWeek: (day) => day,
  changesDevToggleLabel: "technical",
  changesDevBranchLabel: (b) => "branch: " + b,
  changesDevShaLabel: (s) => "sha: " + s,
  changesDevAgentLabel: (a, m) => (m ? a + " (" + m + ")" : a),
  changesDevTokensLabel: (t) => t + " tok",
  changesDevGithubLabel: "view on GitHub",
  changesDevCommitsHeading: (n) => n + " commit" + (n === 1 ? "" : "s"),
  changesExplainTimeline:
    "Every time CAE ships something, it lands here — newest first, grouped by project.",
  changesExplainDevToggle:
    "Flip to see the raw git details: branch name, SHAs, commit subjects, GitHub link.",

  // === Phase 11: Live Floor ===
  floorPageTitle: "CAE Home",
  floorPopOut: "Open in new window",
  floorMinimize: "Hide",
  floorPause: "Pause animations",
  floorLegend: "What am I looking at?",
  floorReducedMotionNotice: "Calm mode on — no animations",
  floorAuthDriftNotice: "Please sign in again in the main window",
  floorStationHub: "The conductor's desk",
  floorStationForge: "The builder's forge",
  floorStationWatchtower: "The checker's watchtower",
  floorStationOverlook: "The researcher's overlook",
  floorStationLibrary: "The writer's library",
  floorStationShadow: "The debugger's shadow realm",
  floorStationArmory: "The guard's armory",
  floorStationDrafting: "The designer's drafting table",
  floorStationPulpit: "The announcer's pulpit",
  floorStationLoadingBay: "Delegation crates",
  floorExplainHub: "Nexus routes work to agents — merge fireworks appear here",
  floorExplainForge: "Forge builds code — pulses while building; red X if Sentinel rejects",

  // === Phase 9: Chat ===
  chatRailCollapsedAria: "Open chat",
  chatRailExpandAria: "Expand chat",
  chatRailCollapseAria: "Collapse chat",
  chatRailExpandedTitle: "Chat with CAE",
  chatInputPlaceholder: "Ask CAE anything…",
  chatSendButton: "Send",
  chatSendButtonPending: "Sending…",
  chatSuggestionsHeading: "Try:",
  chatNewConversationButton: "New conversation",
  chatEmptyThread: "Hey. What's broken.",
  chatThinking: "CAE is thinking…",
  chatRateLimited: (s) => "CAE is rate-limited for " + s + "s — standby.",
  chatUnreadAria: (n) => n + " unread message" + (n === 1 ? "" : "s"),
  chatFailedToLoad: "Couldn't reach CAE. Try refreshing.",
  chatSessionListHeading: "Past conversations",
  chatSessionListEmpty: "No past conversations yet.",
  chatSessionListItem: (a, p, t) => a + " · " + p + " · " + t,
  chatMessageUserRole: "You",
  chatMessageAgentRole: (f, _a) => f,
  chatGateDialogTitle: "Run this?",
  chatGateDialogSummaryLabel: "What will happen",
  chatGateDialogCostLabel: (t) => "~" + t + " tok",
  chatGateDialogDiffLabel: "Preview",
  chatGateDialogAccept: "Go",
  chatGateDialogCancel: "Cancel",
  chatGateInstantToast: (s) => "Running: " + s,
  chatGateUndoToast: "Undo",
  chatExplainRail: "Chat stays with you across tabs. Click the edge to expand.",
  chatExplainSuggestions: "Quick questions CAE can answer about this tab.",
  chatExplainGate: "Before CAE spends tokens on something big, it'll ask you first.",
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

  // === Phase 7: Metrics ===
  metricsPageHeading: "Metrics",
  metricsSpendingHeading: "Cost",
  metricsSpendingTodayLabel: "Tokens today",
  metricsSpendingMtdLabel: "MTD tokens",
  metricsSpendingProjectedLabel: "Projected MTD",
  metricsSpendingDisclaimer: "est. — from .cae/metrics/circuit-breakers.jsonl",
  metricsSpendingByAgentHeading: "By agent (30d)",
  metricsSpendingDaily30dHeading: "Daily tokens (30d)",
  metricsSpendingTopTasksHeading: "Top 10 by tokens",
  metricsSpendingTopTaskRow: (title, tokens, agent) => title + " · " + tokens + " tok · " + agent,
  metricsWellHeading: "Reliability",
  metricsWellLede: (r) => "7d success rate: " + (r * 100).toFixed(1) + "%",
  metricsWellAgentGaugeLabel: (label, pct) => label.toLowerCase() + ": " + (pct * 100).toFixed(1) + "%",
  metricsWellAgentInsufficientSamples: "n < 5",
  metricsWellRetryHeatmapHeading: "Retry heatmap (DoW x hour)",
  metricsWellHaltsHeading: "Halt events",
  metricsWellHaltsEmpty: "no halts 30d",
  metricsWellSentinelTrendHeading: "Sentinel reject trend (30d)",
  metricsFastHeading: "Speed",
  metricsFastLede: (p50) => "P50 wall: " + p50 + "ms",
  metricsFastPerAgentHeading: "Per-agent wall",
  metricsFastPerAgentColAgent: "agent",
  metricsFastPerAgentColP50: "p50",
  metricsFastPerAgentColP95: "p95",
  metricsFastPerAgentColN: "n",
  metricsFastQueueDepthHeading: "Queue depth",
  metricsFastQueueDepthValue: (n) => n + " inbox",
  metricsFastTimeToMergeHeading: "Time-to-merge distribution",
  metricsFastTimeToMergeBinLabel: (bin, count) => bin + " (" + count + ")",
  metricsEmptyState: "loading...",
  metricsFailedToLoad: "/api/metrics failed",
  metricsExplainP50: "50th percentile, linear interpolation over sorted samples.",
  metricsExplainP95: "95th percentile, linear interpolation. Captures long-tail.",
  metricsExplainProjected: "tokens_mtd * (daysInMonth / dayOfMonth).",
  metricsExplainTokens: "Sum of input_tokens + output_tokens across token_usage events.",
  metricsExplainSuccessRate: "forge_end events with success:true / all forge_end events, 7d window.",
  metricsExplainQueueDepth: "Current length of .cae/inbox across all projects.",
  metricsExplainTimeToMerge: "outbox DONE.md mtime - inbox creation time.",
  metricsExplainRetryHeatmap: "forge_end(success:false) + limit_exceeded(max_retries) bucketed by UTC DoW x hour, 7d.",

  // === Phase 8: Memory ===
  memoryPageHeading: "Memory",
  memoryTabBrowse: "Browse",
  memoryTabGraph: "Graph",
  memorySearchPlaceholder: "rg-backed full-text search",
  memoryBtnRegenerate: "regenerate graph.json (graphify --mode fast)",
  memoryBtnRegeneratePending: "spawning graphify…",
  memoryBtnRegenerateCooldown: (s) => "cooldown " + s + "s",
  memoryBtnWhy: "Trace memory reads",
  memoryLabelBackLinks: "Back-references",
  memoryLabelTimeline: "git log --follow",
  memoryNodeDrawerHeading: (id) => id,
  memoryGraphFilterPhases: "Phases",
  memoryGraphFilterAgents: "Agents",
  memoryGraphFilterNotes: "Notes",
  memoryGraphFilterPrds: "PRDs",
  memoryGraphNodeCapBanner: (shown, total) =>
    "node cap " + shown + "/" + total,
  memoryWhyEmpty: "0 memory_consult events",
  memoryWhyLiveTracePill: "Live trace (memory_consult events)",
  memoryWhyHeuristicPill: "Heuristic — files_modified ∩ memory sources",
  memoryEmptyBrowse: "tree empty",
  memoryEmptyGraph: "no graph.json — regenerate",
  memoryExplainGraph: "edges: graphify tree-sitter AST refs",
  memoryExplainWhy: "PostToolUse Read hook events, grouped by task_id",
  memoryExplainSearch: "ripgrep --smart-case --glob='*.md'",
  memoryExplainRegenerate: "spawn graphify --mode fast --no-viz --update",
  memoryFileNotFound: "404",
  memoryLoadFailed: "fetch failed",

  // === Phase 9: Changes tab ===
  changesPageHeading: "Changes",
  changesPageLede: (n) => n + " merge" + (n === 1 ? "" : "s") + " today",
  changesEmpty: "no merges in 30d window",
  changesFailedToLoad: "/api/changes failed",
  changesProjectHeader: (name, n) => name + " (" + n + ")",
  changesDayToday: "Today",
  changesDayYesterday: "Yesterday",
  changesDayWeek: (day) => day,
  changesDevToggleLabel: "[+] technical",
  changesDevBranchLabel: (b) => b,
  changesDevShaLabel: (s) => s,
  changesDevAgentLabel: (a, m) => (m ? a + "/" + m : a),
  changesDevTokensLabel: (t) => t + "t",
  changesDevGithubLabel: "gh",
  changesDevCommitsHeading: (n) => n + " commits",
  changesExplainTimeline:
    "git log --all --merges --since='30 days ago', deduped by sha, joined with forge_end events by task_id.",
  changesExplainDevToggle:
    "reveals branch + %H + %h + per-commit subjects + github URL",

  // === Phase 11: Live Floor ===
  floorPageTitle: "Live Floor",
  floorPopOut: "Pop out",
  floorMinimize: "Minimize",
  floorPause: "Pause",
  floorLegend: "Legend",
  floorReducedMotionNotice: "Reduced motion active — effects disabled",
  floorAuthDriftNotice: "Session expired — re-auth in main window",
  floorStationHub: "Nexus hub",
  floorStationForge: "Forge",
  floorStationWatchtower: "Sentinel watchtower",
  floorStationOverlook: "Scout overlook",
  floorStationLibrary: "Scribe library",
  floorStationShadow: "Phantom shadow realm",
  floorStationArmory: "Aegis armory",
  floorStationDrafting: "Arch drafting table",
  floorStationPulpit: "Herald pulpit",
  floorStationLoadingBay: "Loading bay",
  floorExplainHub: "Nexus routes work to agents — merge fireworks appear here",
  floorExplainForge: "Forge builds code — pulses while building; red X if Sentinel rejects",

  // === Phase 9: Chat ===
  chatRailCollapsedAria: "toggle chat rail",
  chatRailExpandAria: "expand",
  chatRailCollapseAria: "collapse",
  chatRailExpandedTitle: "chat",
  chatInputPlaceholder: "message (Enter = send, Shift+Enter = newline)…",
  chatSendButton: "send",
  chatSendButtonPending: "…",
  chatSuggestionsHeading: "suggestions:",
  chatNewConversationButton: "new session",
  chatEmptyThread: "(empty)",
  chatThinking: "streaming…",
  chatRateLimited: (s) => "rate-limited " + s + "s",
  chatUnreadAria: (n) => n + " unread",
  chatFailedToLoad: "/api/chat failed",
  chatSessionListHeading: "sessions",
  chatSessionListEmpty: "no sessions",
  chatSessionListItem: (a, p, t) => a + "/" + p + "/" + t,
  chatMessageUserRole: "user",
  chatMessageAgentRole: (_f, a) => a,
  chatGateDialogTitle: "Confirm action",
  chatGateDialogSummaryLabel: "action",
  chatGateDialogCostLabel: (t) => "~" + t + "t",
  chatGateDialogDiffLabel: "diff",
  chatGateDialogAccept: "exec",
  chatGateDialogCancel: "abort",
  chatGateInstantToast: (s) => "exec: " + s,
  chatGateUndoToast: "undo",
  chatExplainRail: "Persistent 48→300px rail; SSE-driven unread counter.",
  chatExplainSuggestions: "lib/chat-suggestions.ts lookup keyed by pathname.",
  chatExplainGate: "lib/chat-cost-estimate.ts shouldGate() when estimate>=1000.",
};

export function labelFor(dev: boolean): Labels {
  return dev ? DEV : FOUNDER;
}

export const LABELS = { FOUNDER, DEV };
