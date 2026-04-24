/**
 * Tests for lib/skills/enrich.ts — merges git-log last-updated onto catalog.
 */
import { describe, it, expect } from "vitest";
import { enrichSkillsWithLastUpdated } from "./enrich";
import type { CatalogSkill } from "@/lib/cae-types";

const mk = (name: string, source: CatalogSkill["source"] = "local"): CatalogSkill => ({
  name,
  owner: "local",
  source,
  description: `${name} desc`,
  installCmd: "already installed",
  detailUrl: `file:///fake/${name}`,
  installed: source === "local",
});

describe("enrichSkillsWithLastUpdated", () => {
  it("attaches ISO when the skill name is in the map", () => {
    const catalog = [mk("cae-herald"), mk("cae-scout")];
    const map = {
      "cae-herald": "2026-04-17T02:40:37+09:00",
      "cae-scout": "2026-04-10T11:00:00+00:00",
    };
    const out = enrichSkillsWithLastUpdated(catalog, map);
    expect(out[0].lastUpdatedISO).toBe("2026-04-17T02:40:37+09:00");
    expect(out[1].lastUpdatedISO).toBe("2026-04-10T11:00:00+00:00");
  });

  it("sets lastUpdatedISO=null for skills not in the map", () => {
    const catalog = [mk("vercel-labs/agent-skills", "skills.sh")];
    const out = enrichSkillsWithLastUpdated(catalog, {});
    expect(out[0].lastUpdatedISO).toBeNull();
  });

  it("does not mutate the input", () => {
    const original = mk("cae-herald");
    const catalog = [original];
    const out = enrichSkillsWithLastUpdated(catalog, {
      "cae-herald": "2026-04-17T02:40:37+09:00",
    });
    expect(out[0]).not.toBe(original);
    expect((original as unknown as { lastUpdatedISO?: unknown }).lastUpdatedISO).toBeUndefined();
  });
});
