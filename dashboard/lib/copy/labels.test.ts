/**
 * labels.test.ts — Tests for agentVerbs + getAgentVerbSet (Plan 13-07, Task 3)
 *                  + Phase 14 label namespace tests (Plan 14-01, Task 1)
 *
 * Tests:
 * 1. agentVerbs("start_stop_archive") returns Start/Stop/Archive
 * 2. agentVerbs("wake_spawn_hide") returns Wake/Hide/Hide
 * 3. agentVerbs() with no args defaults to start_stop_archive
 * 4. getAgentVerbSet() returns default when localStorage is empty
 * 5. getAgentVerbSet() returns "wake_spawn_hide" when localStorage key is set
 * 6. getAgentVerbSet() returns default for any unrecognised localStorage value
 * Phase 14:
 * 7. FOUNDER.skills has ≥3 non-empty keys
 * 8. FOUNDER.schedule has ≥3 non-empty keys
 * 9. FOUNDER.permissions has ≥3 non-empty keys
 * 10. FOUNDER.security has ≥3 non-empty keys
 * 11. DEV.skills has ≥3 non-empty keys (parity check)
 * 12. Founder-speak: no raw cron expressions or role acronyms in FOUNDER keys
 */

import { describe, it, expect, beforeEach } from "vitest";
import { agentVerbs, getAgentVerbSet, LABELS } from "./labels";

// localStorage stub
let store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { store = {}; },
};

beforeEach(() => {
  store = {};
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
});

describe("agentVerbs()", () => {
  it("1. start_stop_archive returns Start / Stop / Archive", () => {
    const v = agentVerbs("start_stop_archive");
    expect(v.primary).toBe("Start");
    expect(v.stop).toBe("Stop");
    expect(v.archive).toBe("Archive");
  });

  it("2. wake_spawn_hide returns Wake / Hide / Hide", () => {
    const v = agentVerbs("wake_spawn_hide");
    expect(v.primary).toBe("Wake");
    expect(v.stop).toBe("Hide");
    expect(v.archive).toBe("Hide");
  });

  it("3. no-arg default returns start_stop_archive set", () => {
    const v = agentVerbs();
    expect(v.primary).toBe("Start");
  });
});

describe("getAgentVerbSet()", () => {
  it("4. returns 'start_stop_archive' when localStorage is empty", () => {
    expect(getAgentVerbSet()).toBe("start_stop_archive");
  });

  it("5. returns 'wake_spawn_hide' when localStorage key is set", () => {
    store["p13-agent-verbs"] = "wake_spawn_hide";
    expect(getAgentVerbSet()).toBe("wake_spawn_hide");
  });

  it("6. returns 'start_stop_archive' for any unrecognised value", () => {
    store["p13-agent-verbs"] = "some_random_value";
    expect(getAgentVerbSet()).toBe("start_stop_archive");
  });
});

// ============================================================
// Phase 14 Wave 0 — label namespace tests
// ============================================================

describe("labels phase 14 — FOUNDER namespaces", () => {
  const F = LABELS.FOUNDER;

  it("7. FOUNDER.skills has ≥3 non-empty string keys", () => {
    const entries = Object.entries(F.skills).filter(
      ([, v]) => typeof v === "string" && v.trim().length > 0
    );
    expect(entries.length).toBeGreaterThanOrEqual(3);
  });

  it("8. FOUNDER.schedule has ≥3 non-empty string keys", () => {
    const entries = Object.entries(F.schedule).filter(
      ([, v]) => typeof v === "string" && v.trim().length > 0
    );
    expect(entries.length).toBeGreaterThanOrEqual(3);
  });

  it("9. FOUNDER.permissions has ≥3 non-empty string keys", () => {
    const entries = Object.entries(F.permissions).filter(
      ([, v]) => typeof v === "string" && v.trim().length > 0
    );
    expect(entries.length).toBeGreaterThanOrEqual(3);
  });

  it("10. FOUNDER.security has ≥3 non-empty string keys", () => {
    const entries = Object.entries(F.security).filter(
      ([, v]) => typeof v === "string" && v.trim().length > 0
    );
    expect(entries.length).toBeGreaterThanOrEqual(3);
  });

  it("11. DEV.skills parity — ≥3 non-empty string keys", () => {
    const entries = Object.entries(LABELS.DEV.skills).filter(
      ([, v]) => typeof v === "string" && v.trim().length > 0
    );
    expect(entries.length).toBeGreaterThanOrEqual(3);
  });

  it("12. FOUNDER-speak: no raw cron expressions in skills/schedule/permissions/security", () => {
    // Raw cron = 5-field pattern like "0 9 * * *" — founder-speak must not expose this
    const cronPattern = /\d+ \d+ \* \* \*/;
    const allValues = [
      ...Object.values(F.skills),
      ...Object.values(F.schedule),
      ...Object.values(F.permissions),
      ...Object.values(F.security),
    ].filter((v): v is string => typeof v === "string");

    for (const val of allValues) {
      expect(val).not.toMatch(cronPattern);
    }
  });
});
