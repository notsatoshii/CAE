/**
 * Unit tests for lib/voice-router.ts — Phase 9 Plan 01 (Wave 0).
 *
 * Scope: D-05 routing rules (first-match-wins) + D-06 per-persona model map.
 * Covers:
 *   - Explicit @agent override (first-token only; case-insensitive; @task:
 *     fall-through; unknown fall-through)
 *   - Keyword heuristics in fixed rule order
 *   - Route-prefix rules when message is neutral
 *   - Default → nexus
 *   - MODEL_BY_AGENT exhaustive + exact D-06 values
 *   - modelForAgent convenience
 */

import { describe, it, expect } from "vitest";

import {
  pickPersona,
  MODEL_BY_AGENT,
  modelForAgent,
} from "./voice-router";
import { AGENT_META, type AgentName } from "@/lib/copy/agent-meta";

describe("pickPersona — explicit @agent override (D-05 rule 1)", () => {
  it("routes @phantom → phantom regardless of route", () => {
    expect(
      pickPersona({ route: "/metrics", message: "@phantom look at this" }),
    ).toBe("phantom");
  });

  it("is case-insensitive on the @AGENT token", () => {
    expect(
      pickPersona({ route: "/build", message: "@SCOUT find it" }),
    ).toBe("scout");
  });

  it("allows leading whitespace before @agent", () => {
    expect(
      pickPersona({ route: "/build", message: "   @forge ship this" }),
    ).toBe("forge");
  });

  it("does NOT treat @task:... as a persona override (gotcha #6)", () => {
    // @task: is a task mention from UI-SPEC §5, NOT an agent route.
    // Falls through to route rules → no route match → nexus default.
    expect(
      pickPersona({ route: "/build", message: "@task:p9-plA-t1-abc retry" }),
    ).toBe("nexus");
  });

  it("does NOT treat mid-sentence @agent as an override", () => {
    // Only FIRST token routes. Mid-sentence @forge is plain text.
    // "ask @forge" has no keyword match; default → nexus on /build.
    expect(
      pickPersona({ route: "/build", message: "please ask @forge to retry" }),
    ).toBe("nexus");
  });

  it("falls through when @xyz is not a known agent", () => {
    // Unknown @xyz → no override, no keyword, /build route → nexus default.
    expect(
      pickPersona({ route: "/build", message: "@xyz hello there" }),
    ).toBe("nexus");
  });

  it("routes all 9 agents via explicit override", () => {
    const names: AgentName[] = [
      "nexus",
      "forge",
      "sentinel",
      "scout",
      "scribe",
      "phantom",
      "aegis",
      "arch",
      "herald",
    ];
    for (const n of names) {
      expect(
        pickPersona({ route: "/some/unrelated/route", message: `@${n} ping` }),
      ).toBe(n);
    }
  });
});

describe("pickPersona — keyword heuristics (D-05 rule 2)", () => {
  it("matches 'stuck' → phantom", () => {
    expect(
      pickPersona({ route: "/build", message: "my build is stuck" }),
    ).toBe("phantom");
  });

  it("matches 'failing'/'debug' → phantom", () => {
    expect(
      pickPersona({ route: "/build", message: "something is failing" }),
    ).toBe("phantom");
    expect(
      pickPersona({ route: "/build", message: "help me debug this" }),
    ).toBe("phantom");
  });

  it("matches 'security'/'auth'/'secret'/'key'/'credential' → aegis", () => {
    expect(
      pickPersona({ route: "/build", message: "check this for security" }),
    ).toBe("aegis");
    expect(
      pickPersona({ route: "/build", message: "is this secret safe?" }),
    ).toBe("aegis");
    expect(
      pickPersona({ route: "/build", message: "rotate the key please" }),
    ).toBe("aegis");
    expect(
      pickPersona({ route: "/build", message: "credential handling" }),
    ).toBe("aegis");
  });

  it("matches 'research'/'find'/'docs'/'investigate'/'scout' → scout", () => {
    expect(
      pickPersona({ route: "/build", message: "research react-flow versions" }),
    ).toBe("scout");
    expect(
      pickPersona({ route: "/build", message: "find the right lib" }),
    ).toBe("scout");
    expect(
      pickPersona({ route: "/build", message: "check the docs for me" }),
    ).toBe("scout");
    expect(
      pickPersona({ route: "/build", message: "investigate this issue" }),
    ).toBe("scout");
  });

  it("matches 'ship'/'release'/'announce'/'herald' → herald", () => {
    expect(
      pickPersona({ route: "/build", message: "ship it" }),
    ).toBe("herald");
    expect(
      pickPersona({ route: "/build", message: "prep the release notes" }),
    ).toBe("herald");
    expect(
      pickPersona({ route: "/build", message: "announce this" }),
    ).toBe("herald");
  });

  it("matches 'architecture'/'design'/'arch' → arch", () => {
    expect(
      pickPersona({ route: "/build", message: "architecture question" }),
    ).toBe("arch");
    expect(
      pickPersona({ route: "/build", message: "help me design this module" }),
    ).toBe("arch");
  });

  it("matches 'test'/'review'/'check'/'sentinel' → sentinel", () => {
    expect(
      pickPersona({ route: "/build", message: "run the test" }),
    ).toBe("sentinel");
    expect(
      pickPersona({ route: "/build", message: "review this PR" }),
    ).toBe("sentinel");
  });

  it("keyword wins over route (ordering: phantom first)", () => {
    // /metrics route → arch by rule 3, but 'failing' → phantom by rule 2.
    // Rule 2 runs before rule 3, so phantom wins.
    expect(
      pickPersona({ route: "/metrics", message: "debug this failing auth" }),
    ).toBe("phantom");
  });

  it("phantom beats aegis when both trigger (D-05 order)", () => {
    // Both "stuck" (phantom) and "auth" (aegis) present. Phantom wins —
    // phantom rule is checked first per D-05 keyword ordering.
    expect(
      pickPersona({
        route: "/build",
        message: "my auth is stuck on sign-in",
      }),
    ).toBe("phantom");
  });
});

describe("pickPersona — route rules (D-05 rule 3)", () => {
  it("/memory → scribe", () => {
    expect(
      pickPersona({ route: "/memory", message: "hi" }),
    ).toBe("scribe");
  });

  it("/memory/... prefix → scribe", () => {
    expect(
      pickPersona({ route: "/memory/file/foo", message: "hi" }),
    ).toBe("scribe");
  });

  it("/metrics → arch", () => {
    expect(
      pickPersona({ route: "/metrics", message: "hi" }),
    ).toBe("arch");
  });

  it("/metrics/details → arch (prefix match)", () => {
    expect(
      pickPersona({ route: "/metrics/details", message: "hi" }),
    ).toBe("arch");
  });

  it("/build/changes → herald", () => {
    expect(
      pickPersona({ route: "/build/changes", message: "hi" }),
    ).toBe("herald");
  });

  it("/build/changes/... prefix → herald", () => {
    expect(
      pickPersona({ route: "/build/changes/123", message: "hi" }),
    ).toBe("herald");
  });

  it("/memoryfoo (no slash) does NOT match /memory prefix", () => {
    // Guard against accidental substring match. /memoryfoo is not under /memory/.
    expect(
      pickPersona({ route: "/memoryfoo", message: "hi" }),
    ).toBe("nexus");
  });
});

describe("pickPersona — default Nexus (D-05 rule 4)", () => {
  it("/build → nexus", () => {
    expect(pickPersona({ route: "/build", message: "hello" })).toBe("nexus");
  });

  it("/chat → nexus", () => {
    expect(pickPersona({ route: "/chat", message: "hi" })).toBe("nexus");
  });

  it("/ → nexus", () => {
    expect(pickPersona({ route: "/", message: "hey" })).toBe("nexus");
  });

  it("empty message on unrelated route → nexus", () => {
    expect(pickPersona({ route: "/plan", message: "" })).toBe("nexus");
  });
});

describe("MODEL_BY_AGENT (D-06)", () => {
  it("nexus uses claude-opus-4-7", () => {
    expect(MODEL_BY_AGENT.nexus).toBe("claude-opus-4-7");
  });

  it("arch uses claude-opus-4-7", () => {
    expect(MODEL_BY_AGENT.arch).toBe("claude-opus-4-7");
  });

  it("phantom uses claude-opus-4-7", () => {
    expect(MODEL_BY_AGENT.phantom).toBe("claude-opus-4-7");
  });

  it("forge uses claude-sonnet-4-6", () => {
    expect(MODEL_BY_AGENT.forge).toBe("claude-sonnet-4-6");
  });

  it("scout uses claude-sonnet-4-6", () => {
    expect(MODEL_BY_AGENT.scout).toBe("claude-sonnet-4-6");
  });

  it("scribe uses claude-sonnet-4-6", () => {
    expect(MODEL_BY_AGENT.scribe).toBe("claude-sonnet-4-6");
  });

  it("sentinel uses claude-sonnet-4-6", () => {
    expect(MODEL_BY_AGENT.sentinel).toBe("claude-sonnet-4-6");
  });

  it("aegis uses claude-sonnet-4-6", () => {
    expect(MODEL_BY_AGENT.aegis).toBe("claude-sonnet-4-6");
  });

  it("herald uses claude-sonnet-4-6", () => {
    expect(MODEL_BY_AGENT.herald).toBe("claude-sonnet-4-6");
  });

  it("every AgentName key maps to a non-empty string (exhaustive)", () => {
    for (const key of Object.keys(AGENT_META) as AgentName[]) {
      const model = MODEL_BY_AGENT[key];
      expect(typeof model).toBe("string");
      expect(model.length).toBeGreaterThan(0);
    }
  });
});

describe("modelForAgent", () => {
  it("returns the MODEL_BY_AGENT entry", () => {
    expect(modelForAgent("forge")).toBe("claude-sonnet-4-6");
    expect(modelForAgent("nexus")).toBe("claude-opus-4-7");
  });
});
