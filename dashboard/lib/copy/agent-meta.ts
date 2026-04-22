/**
 * Canonical metadata for the nine CAE agents.
 *
 * Consumed by Phase 4 home-page widgets (active phase cards avatar rendering,
 * live-ops one-liner founder-label resolution, needs-you row icons).
 *
 * Data source: UI-SPEC.md section 0 (nine-agent voice table) plus the
 * Audience reframe section (founder label mapping: "forge -> the builder",
 * etc.). See also .planning/phases/04-build-home-rewrite/04-CONTEXT.md
 * under Specific Ideas, Agent avatar rendering.
 *
 * Pure data + pure function -- safe to import from Node tests.
 *
 * Post Plan 04-06, this module becomes the single source of truth for
 * founder labels across the whole dashboard; lib/cae-home-state.ts currently
 * holds an intentional inline duplicate (documented there) that will be
 * refactored to import agentMetaFor from here.
 */

export type AgentName =
  | "nexus"
  | "forge"
  | "sentinel"
  | "scout"
  | "scribe"
  | "phantom"
  | "aegis"
  | "arch"
  | "herald";

export interface AgentMeta {
  name: AgentName | "unknown";
  label: string;
  founder_label: string;
  emoji: string;
  color: string;
}

export const AGENT_META: Record<AgentName, AgentMeta> = {
  nexus:    { name: "nexus",    label: "Nexus",    founder_label: "the conductor",     emoji: "🧭", color: "cyan"   },
  forge:    { name: "forge",    label: "Forge",    founder_label: "the builder",       emoji: "⚒️", color: "orange" },
  sentinel: { name: "sentinel", label: "Sentinel", founder_label: "the checker",       emoji: "🛡️", color: "cyan"   },
  scout:    { name: "scout",    label: "Scout",    founder_label: "the researcher",    emoji: "🔭", color: "yellow" },
  scribe:   { name: "scribe",   label: "Scribe",   founder_label: "the memory-keeper", emoji: "📜", color: "purple" },
  phantom:  { name: "phantom",  label: "Phantom",  founder_label: "the debugger",      emoji: "👻", color: "gray"   },
  aegis:    { name: "aegis",    label: "Aegis",    founder_label: "the guard",         emoji: "🔐", color: "red"    },
  arch:     { name: "arch",     label: "Arch",     founder_label: "the architect",     emoji: "📐", color: "blue"   },
  herald:   { name: "herald",   label: "Herald",   founder_label: "the herald",        emoji: "📣", color: "amber"  },
};

export function agentMetaFor(name: string): AgentMeta {
  const key = name.toLowerCase() as AgentName;
  if (key in AGENT_META) return AGENT_META[key];
  return {
    name: "unknown",
    label: name,
    founder_label: name,
    emoji: "🤖",
    color: "gray",
  };
}
