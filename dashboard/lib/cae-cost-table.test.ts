import { describe, expect, it } from "vitest";
import { costUsd, formatUsd, rateFor, MODEL_RATES } from "./cae-cost-table";

describe("cae-cost-table", () => {
  describe("rateFor", () => {
    it("matches Opus family from the long form name", () => {
      expect(rateFor("claude-opus-4-7")).toEqual(MODEL_RATES.opus);
      expect(rateFor("opus")).toEqual(MODEL_RATES.opus);
      expect(rateFor("OPUS-4")).toEqual(MODEL_RATES.opus);
    });

    it("matches Sonnet family", () => {
      expect(rateFor("claude-sonnet-4-6")).toEqual(MODEL_RATES.sonnet);
      expect(rateFor("sonnet")).toEqual(MODEL_RATES.sonnet);
    });

    it("matches Haiku family", () => {
      expect(rateFor("claude-haiku-4-5")).toEqual(MODEL_RATES.haiku);
      expect(rateFor("haiku")).toEqual(MODEL_RATES.haiku);
    });

    it("falls back to Sonnet for unknown / null / empty model strings", () => {
      expect(rateFor(null)).toEqual(MODEL_RATES.sonnet);
      expect(rateFor(undefined)).toEqual(MODEL_RATES.sonnet);
      expect(rateFor("")).toEqual(MODEL_RATES.sonnet);
      expect(rateFor("gpt-7-turbo")).toEqual(MODEL_RATES.sonnet);
    });
  });

  describe("costUsd", () => {
    it("computes Opus cost: $15/Mtok in + $75/Mtok out", () => {
      // 1M input + 1M output @ Opus = $15 + $75 = $90
      expect(costUsd(1_000_000, 1_000_000, "opus")).toBeCloseTo(90, 5);
    });

    it("computes Sonnet cost: $3 in + $15 out per Mtok", () => {
      // 1M in + 1M out @ Sonnet = $3 + $15 = $18
      expect(costUsd(1_000_000, 1_000_000, "claude-sonnet-4-6")).toBeCloseTo(18, 5);
    });

    it("computes Haiku cost: $1 in + $5 out per Mtok", () => {
      expect(costUsd(1_000_000, 1_000_000, "haiku")).toBeCloseTo(6, 5);
    });

    it("returns 0 for zero / negative token counts", () => {
      expect(costUsd(0, 0, "opus")).toBe(0);
      expect(costUsd(-1, -1, "opus")).toBe(0);
    });
  });

  describe("formatUsd", () => {
    it("formats sub-$1k with two decimals", () => {
      expect(formatUsd(0)).toBe("$0.00");
      expect(formatUsd(0.42)).toBe("$0.42");
      expect(formatUsd(12.345)).toBe("$12.35");
      expect(formatUsd(999.99)).toBe("$999.99");
    });

    it("formats $1k+ with k suffix", () => {
      expect(formatUsd(1000)).toBe("$1.0k");
      expect(formatUsd(12_345)).toBe("$12.3k");
    });

    it("formats $1M+ with M suffix", () => {
      expect(formatUsd(1_000_000)).toBe("$1.00M");
      expect(formatUsd(2_500_000)).toBe("$2.50M");
    });

    it("guards against NaN / negative", () => {
      expect(formatUsd(NaN)).toBe("$0.00");
      expect(formatUsd(-5)).toBe("$0.00");
    });
  });
});
