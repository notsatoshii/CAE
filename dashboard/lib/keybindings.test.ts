import { describe, expect, it } from "vitest";
import { KEYBINDINGS, keybindingById, keybindingsByArea, matchesKeydown, type Keybinding } from "./keybindings";

function makeKb(overrides: Partial<Keybinding>): Keybinding {
  return {
    id: "test.key",
    keys: ["E"],
    area: "global",
    founderLabel: "Test",
    devLabel: "test",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: "e",
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  } as KeyboardEvent;
}

describe("KEYBINDINGS registry", () => {
  it("is non-empty", () => {
    expect(KEYBINDINGS.length).toBeGreaterThan(0);
  });

  it("every entry has required fields", () => {
    for (const k of KEYBINDINGS) {
      expect(k.id).toBeTruthy();
      expect(k.keys.length).toBeGreaterThan(0);
      expect(["global", "sheets", "task", "palette"]).toContain(k.area);
      expect(k.founderLabel).toBeTruthy();
      expect(k.devLabel).toBeTruthy();
    }
  });

  it("all ids are unique", () => {
    const ids = KEYBINDINGS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every keystroke shipped today", () => {
    const required = [
      "palette.open",     // ⌘K
      "shortcuts.open",   // ?
      "explain.toggle",   // Ctrl+E
      "devmode.toggle",   // ⌘Shift+D
      "sheet.close",      // Esc
      "task.pause",       // Ctrl+.
      "task.abort",       // Ctrl+Shift+.
    ];
    for (const id of required) {
      expect(keybindingById(id), "missing " + id).toBeTruthy();
    }
  });

  it("has distinct founder and dev labels on at least 4 entries", () => {
    const distinct = KEYBINDINGS.filter((k) => k.founderLabel !== k.devLabel).length;
    expect(distinct).toBeGreaterThanOrEqual(4);
  });

  it("keybindingsByArea returns only that area", () => {
    const g = keybindingsByArea("global");
    expect(g.length).toBeGreaterThan(0);
    for (const k of g) expect(k.area).toBe("global");
  });
});

describe("matchesKeydown", () => {
  it("matches Ctrl+E", () => {
    const kb = makeKb({ keys: ["Ctrl", "E"] });
    expect(matchesKeydown(kb, makeEvent({ key: "e", ctrlKey: true }))).toBe(true);
    expect(matchesKeydown(kb, makeEvent({ key: "E", ctrlKey: true }))).toBe(true);
  });

  it("rejects Ctrl+E when ctrl is missing", () => {
    const kb = makeKb({ keys: ["Ctrl", "E"] });
    expect(matchesKeydown(kb, makeEvent({ key: "e", ctrlKey: false }))).toBe(false);
  });

  it("rejects Ctrl+E when wrong key", () => {
    const kb = makeKb({ keys: ["Ctrl", "E"] });
    expect(matchesKeydown(kb, makeEvent({ key: "k", ctrlKey: true }))).toBe(false);
  });

  it("matches ⌘Shift+D", () => {
    const kb = makeKb({ keys: ["⌘", "Shift", "D"] });
    expect(matchesKeydown(kb, makeEvent({ key: "d", metaKey: true, shiftKey: true }))).toBe(true);
  });

  it("rejects ⌘Shift+D when modifier bitmap differs (missing Shift)", () => {
    const kb = makeKb({ keys: ["⌘", "Shift", "D"] });
    expect(matchesKeydown(kb, makeEvent({ key: "d", metaKey: true, shiftKey: false }))).toBe(false);
  });

  it("matches single-key ? (no modifiers)", () => {
    const kb = makeKb({ keys: ["?"] });
    expect(matchesKeydown(kb, makeEvent({ key: "?" }))).toBe(true);
  });

  it("rejects ? when a modifier is pressed", () => {
    const kb = makeKb({ keys: ["?"] });
    expect(matchesKeydown(kb, makeEvent({ key: "?", ctrlKey: true }))).toBe(false);
  });

  it("matches Esc (normalises 'Escape' browser key to 'esc')", () => {
    const kb = makeKb({ keys: ["Esc"] });
    expect(matchesKeydown(kb, makeEvent({ key: "Escape" }))).toBe(true);
  });

  it("returns false for empty keys array", () => {
    const kb = makeKb({ keys: [] });
    expect(matchesKeydown(kb, makeEvent({ key: "e" }))).toBe(false);
  });

  it("matches Ctrl+. (task.pause)", () => {
    const kb = keybindingById("task.pause")!;
    expect(matchesKeydown(kb, makeEvent({ key: ".", ctrlKey: true }))).toBe(true);
  });

  it("matches Ctrl+Shift+. (task.abort)", () => {
    const kb = keybindingById("task.abort")!;
    expect(matchesKeydown(kb, makeEvent({ key: ".", ctrlKey: true, shiftKey: true }))).toBe(true);
  });
});
