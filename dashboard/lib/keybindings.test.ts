import { describe, expect, it } from "vitest";
import { KEYBINDINGS, keybindingById, keybindingsByArea } from "./keybindings";

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
