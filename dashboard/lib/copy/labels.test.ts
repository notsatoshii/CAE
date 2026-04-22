/**
 * labels.test.ts — Tests for agentVerbs + getAgentVerbSet (Plan 13-07, Task 3)
 *
 * Tests:
 * 1. agentVerbs("start_stop_archive") returns Start/Stop/Archive
 * 2. agentVerbs("wake_spawn_hide") returns Wake/Hide/Hide
 * 3. agentVerbs() with no args defaults to start_stop_archive
 * 4. getAgentVerbSet() returns default when localStorage is empty
 * 5. getAgentVerbSet() returns "wake_spawn_hide" when localStorage key is set
 * 6. getAgentVerbSet() returns default for any unrecognized localStorage value
 */

import { describe, it, expect, beforeEach } from "vitest";
import { agentVerbs, getAgentVerbSet } from "./labels";

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
