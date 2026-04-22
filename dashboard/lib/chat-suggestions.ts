/**
 * Route-keyed chat suggestions — Phase 9 Plan 01 (Wave 0), implements D-11.
 *
 * The right-rail and `/chat` full-page chat surfaces render up to three chip
 * buttons below the input. Clicking a chip pre-fills the input with the
 * `message` string and sends it. Contents are founder-speak (no dev jargon,
 * no currency — D-13/D-14 parity).
 *
 * v1 policy (D-11): HARDCODED per route. No LLM call for chip generation —
 * tokens are free for UI-level affordances only when they are template copy.
 * Later phases may flip a `dynamic: true` flag per route without changing the
 * call site; architecture is compatible.
 *
 * Matching (suggestionsFor):
 *   - Exact route match wins first.
 *   - Otherwise longest-prefix match, with a trailing-slash boundary guard
 *     so `/buildfoo` doesn't false-match `/build`.
 *   - Otherwise empty array (scope fence D-18: no silent fallback to /build).
 */

export interface Suggestion {
  /** Chip button label shown to the user. */
  label: string;
  /** Message sent to chat when the chip is clicked. */
  message: string;
}

export const SUGGESTIONS = {
  "/build": [
    { label: "What's blocked?", message: "Anything stuck today?" },
    {
      label: "Today's burn",
      message: "How many tokens did we spend today?",
    },
    {
      label: "What shipped?",
      message: "What got shipped in the last hour?",
    },
  ],
  "/build/queue": [
    {
      label: "Prioritize this queue",
      message: "Which of these should I do first?",
    },
    {
      label: "Why is anything stuck?",
      message: "Why is the stuck column growing?",
    },
    {
      label: "How's throughput?",
      message: "How fast is the queue moving this week?",
    },
  ],
  "/build/changes": [
    {
      label: "Summarize today",
      message: "In plain English, what shipped today?",
    },
    {
      label: "This week",
      message: "Give me a week-in-review of what landed.",
    },
  ],
  "/build/agents": [
    { label: "Who's idle?", message: "Which agents haven't run lately?" },
    {
      label: "Who's slowest?",
      message: "Which agent has the worst average task time?",
    },
    {
      label: "Any drift?",
      message: "Is anyone's success rate trending down?",
    },
  ],
  "/build/workflows": [
    {
      label: "Draft a recipe",
      message: "Help me draft a recipe for Monday dep updates.",
    },
    {
      label: "What breaks most?",
      message: "Which workflows fail most often?",
    },
  ],
  "/metrics": [
    {
      label: "Am I overspending?",
      message: "Is today's burn higher than usual?",
    },
    {
      label: "Where is it going?",
      message: "Which agent is using the most tokens this week?",
    },
    {
      label: "How reliable?",
      message: "Which agent has the best success rate this month?",
    },
  ],
  "/memory": [
    {
      label: "Why for a task?",
      message: "Show me what CAE read for the last task.",
    },
    {
      label: "Recent edits",
      message: "What memory files changed this week?",
    },
  ],
  "/chat": [
    {
      label: "What should I ask?",
      message: "What's the most useful question I can ask right now?",
    },
    {
      label: "Week-in-review",
      message: "Summarize this week across every project.",
    },
  ],
} as const satisfies Readonly<Record<string, readonly Suggestion[]>>;

type SuggestionRoute = keyof typeof SUGGESTIONS;

/**
 * Resolve suggestions for the given pathname.
 *   1. Exact match on SUGGESTIONS key.
 *   2. Longest-prefix match (route key is an ancestor of pathname, separated
 *      by a trailing slash — `/metrics` matches `/metrics/x` but not
 *      `/metricsfoo`).
 *   3. Empty array — DO NOT silently fall back to a parent route (D-18).
 */
export function suggestionsFor(pathname: string): readonly Suggestion[] {
  // Exact match.
  if (pathname in SUGGESTIONS) {
    return SUGGESTIONS[pathname as SuggestionRoute];
  }

  // Longest-prefix match with slash-boundary guard.
  const keys = (Object.keys(SUGGESTIONS) as SuggestionRoute[]).sort(
    (a, b) => b.length - a.length,
  );
  for (const k of keys) {
    if (pathname === k || pathname.startsWith(k + "/")) {
      return SUGGESTIONS[k];
    }
  }

  return [];
}
