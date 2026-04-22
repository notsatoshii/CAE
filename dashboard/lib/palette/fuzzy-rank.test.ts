/**
 * fuzzy-rank.test.ts — PAL-03, PAL-05
 *
 * Verifies fuzzysort wrapper behavior: empty/whitespace pass-through,
 * prefix > contains > fuzzy ranking, multi-key search, and null safety.
 */

import { describe, it, expect } from "vitest";
import { rankPaletteItems } from "./fuzzy-rank";
import type { PaletteItem } from "./types";

function makeItem(label: string, hint = "", id?: string): PaletteItem {
  return {
    id: id ?? `test:${label}`,
    group: "commands",
    label,
    hint,
    run: () => {},
  };
}

const ITEMS: readonly PaletteItem[] = [
  makeItem("Open chat", ""),
  makeItem("Open memory", ""),
  makeItem("Abort job", ""),
  makeItem("Chatbot drafts", ""),
];

describe("rankPaletteItems", () => {
  it("empty query returns items unchanged (same length and order)", () => {
    const result = rankPaletteItems("", ITEMS);
    expect(result.length).toBe(ITEMS.length);
    for (let i = 0; i < ITEMS.length; i++) {
      expect(result[i]).toBe(ITEMS[i]);
    }
  });

  it("whitespace-only query returns items unchanged", () => {
    const result = rankPaletteItems("   ", ITEMS);
    expect(result.length).toBe(ITEMS.length);
    expect(result[0]).toBe(ITEMS[0]);
  });

  it('query "cha" ranks "Open chat" and "Chatbot drafts" above "Abort job"', () => {
    const result = rankPaletteItems("cha", ITEMS);
    // "Open chat" and "Chatbot drafts" must both appear before "Abort job"
    const chatIdx = result.findIndex((i) => i.label === "Open chat");
    const chatbotIdx = result.findIndex((i) => i.label === "Chatbot drafts");
    const abortIdx = result.findIndex((i) => i.label === "Abort job");

    // Both chat items should appear before Abort job (or abort job not in results)
    // abortIdx === -1 means it wasn't matched, which is also acceptable
    if (abortIdx !== -1) {
      expect(chatIdx).toBeLessThan(abortIdx);
      expect(chatbotIdx).toBeLessThan(abortIdx);
    } else {
      // Abort job filtered out, both chat items present
      expect(chatIdx).toBeGreaterThanOrEqual(0);
      expect(chatbotIdx).toBeGreaterThanOrEqual(0);
    }
  });

  it('query "openmem" ranks "Open memory" as index 0 (tight contiguous match)', () => {
    const result = rankPaletteItems("openmem", ITEMS);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].label).toBe("Open memory");
  });

  it("multi-key: item with hint 'chat' but label 'Inbox' is included for query 'chat'", () => {
    const inboxItem = makeItem("Inbox", "chat", "test:inbox-chat");
    const items: readonly PaletteItem[] = [...ITEMS, inboxItem];
    const result = rankPaletteItems("chat", items);
    const found = result.find((i) => i.id === "test:inbox-chat");
    expect(found).toBeDefined();
  });

  it("items with empty hint never crash", () => {
    const itemsWithEmptyHint: readonly PaletteItem[] = [
      makeItem("Alpha", ""),
      makeItem("Beta", ""),
    ];
    expect(() => rankPaletteItems("al", itemsWithEmptyHint)).not.toThrow();
  });
});
