/**
 * Static heuristic voice router — Phase 9 Plan 01 (Wave 0), implements D-05 + D-06.
 *
 * Pure, synchronous, zero-I/O. Callers (`/api/chat/send`) pass the user's
 * active route + message; the router returns which of the nine CAE personas
 * should answer. Later calls may short-circuit this via session-meta pinning
 * (see 09-CONTEXT D-05 Claude's Discretion §`--append-system-prompt-file` +
 * `--resume` persona stability) — this module doesn't care about that; the
 * caller does.
 *
 * Routing rules (first-match-wins, top-down):
 *   1. Explicit override: message's FIRST whitespace-delimited token matches
 *      `@<agent>` where `<agent>` is one of the nine AgentNames.
 *      `@task:...` (UI-SPEC §5 task mentions) never routes — the regex's
 *      union list excludes `task`, so those fall through naturally.
 *   2. Keyword heuristics (word-boundary, case-insensitive), applied in the
 *      fixed order below. First rule that matches wins.
 *   3. Route-prefix rules (exact match OR prefix with trailing slash).
 *   4. Default → nexus.
 *
 * Per-persona model map (D-06):
 *   - opus-4-7: nexus, arch, phantom (orchestrators + deep thinkers)
 *   - sonnet-4-6: forge, scout, herald, sentinel, scribe, aegis (workers)
 *
 * Gotcha #6 honored: `@task:p9-plA-t1-abc` must NOT trigger a persona route.
 * Regex alternation lists the 9 agent names only; `task` is not a member, so
 * `@task:...` fails the regex and falls through.
 */

import type { AgentName } from "@/lib/copy/agent-meta";

export interface PickPersonaInput {
  /** Current dashboard pathname (e.g., "/build/changes", "/metrics", "/chat"). */
  route: string;
  /** Raw user input; may start with "@agent" to override routing. */
  message: string;
}

// Exhaustive list of agent names; used for runtime membership checks and for
// exhaustiveness assertions on MODEL_BY_AGENT.
const AGENT_NAMES = [
  "nexus",
  "forge",
  "sentinel",
  "scout",
  "scribe",
  "phantom",
  "aegis",
  "arch",
  "herald",
] as const satisfies readonly AgentName[];

// Only these nine tokens count as @agent overrides. `@task:...`, `@xyz`, etc.
// all miss this regex and fall through to keyword/route rules.
// The trailing \b prevents `@nexustest` from matching (word boundary), while
// `@nexus hi` and `@nexus` (end-of-string) both pass.
const EXPLICIT_OVERRIDE_RE =
  /^@(nexus|forge|sentinel|scout|scribe|phantom|aegis|arch|herald)\b/i;

/**
 * Keyword rules in D-05 declared order. FIRST MATCH WINS. Ordering matters:
 * phantom (stuck/failing/debug) is checked before aegis (security/auth),
 * so "auth is stuck" routes to phantom — a failing system takes priority
 * over a security review.
 */
const KEYWORD_RULES: ReadonlyArray<{ re: RegExp; agent: AgentName }> = [
  {
    re: /\b(stuck|failing|debug|phantom)\b/i,
    agent: "phantom",
  },
  {
    re: /\b(security|auth|secret|key|aegis|credential)\b/i,
    agent: "aegis",
  },
  {
    re: /\b(research|scout|find|docs|investigate)\b/i,
    agent: "scout",
  },
  {
    re: /\b(ship|release|announce|herald)\b/i,
    agent: "herald",
  },
  {
    re: /\b(architecture|design|arch)\b/i,
    agent: "arch",
  },
  {
    re: /\b(test|review|sentinel|check)\b/i,
    agent: "sentinel",
  },
];

/**
 * Route-prefix rules. Match when `route === prefix` OR `route starts with
 * prefix + "/"`. Prevents `/memoryfoo` from falsely matching `/memory`.
 */
const ROUTE_RULES: ReadonlyArray<{ prefix: string; agent: AgentName }> = [
  { prefix: "/memory", agent: "scribe" },
  { prefix: "/metrics", agent: "arch" },
  { prefix: "/build/changes", agent: "herald" },
];

function matchesRoutePrefix(route: string, prefix: string): boolean {
  return route === prefix || route.startsWith(prefix + "/");
}

export function pickPersona(input: PickPersonaInput): AgentName {
  const { route, message } = input;
  const trimmed = message.trimStart();

  // Rule 1: explicit @agent override (first token only, case-insensitive).
  const explicit = trimmed.match(EXPLICIT_OVERRIDE_RE);
  if (explicit) {
    // Regex capture guaranteed to be one of AGENT_NAMES by construction.
    return explicit[1].toLowerCase() as AgentName;
  }

  // Rule 2: keyword heuristics in fixed order (first-match-wins).
  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(message)) return rule.agent;
  }

  // Rule 3: route-prefix rules.
  for (const rule of ROUTE_RULES) {
    if (matchesRoutePrefix(route, rule.prefix)) return rule.agent;
  }

  // Rule 4: default.
  return "nexus";
}

/**
 * Per-persona Claude model IDs (D-06).
 * opus-4-7 for the three that own orchestration or deep reasoning; sonnet-4-6
 * for the six worker personas. Wave 1's `/api/chat/send` passes this as
 * `--model <id>` to the spawned `claude` CLI.
 */
export const MODEL_BY_AGENT: Readonly<Record<AgentName, string>> = {
  nexus: "claude-opus-4-7",
  arch: "claude-opus-4-7",
  phantom: "claude-opus-4-7",
  forge: "claude-sonnet-4-6",
  scout: "claude-sonnet-4-6",
  herald: "claude-sonnet-4-6",
  sentinel: "claude-sonnet-4-6",
  scribe: "claude-sonnet-4-6",
  aegis: "claude-sonnet-4-6",
} as const;

/** Convenience lookup. Returns `MODEL_BY_AGENT[agent]`. */
export function modelForAgent(agent: AgentName): string {
  return MODEL_BY_AGENT[agent];
}

// Re-export the agent-name list so callers can iterate all personas without
// duplicating the literal.
export { AGENT_NAMES };
