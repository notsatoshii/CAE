/**
 * class19b — unit tests for cae-queue-item pure helpers + mutation guards.
 *
 * Uses vitest. We don't exercise real tmux / fs side effects here — those
 * are integration work. This file covers:
 *   - extractTags parses inline + block YAML tags lists
 *   - firstHeading strips `#` prefixes and caps length
 *   - shortIdForTmux matches the web-/wf- prefix rules the runner uses
 *   - mutation entry points reject malformed task ids before touching disk
 *
 * The mutation tests guard against taskId injection into shell strings
 * (tmux kill-session + spawn). TASK_ID_RE must reject anything weird
 * before we ever call execP.
 */

import { describe, it, expect } from "vitest";
import {
  __internal__,
  abortTask,
  approveReview,
  denyReview,
  retryTask,
  TASK_ID_RE,
} from "./cae-queue-item";

describe("cae-queue-item extractors", () => {
  it("extractTags handles inline list", () => {
    const tags = __internal__.extractTags("tags: [a, b, c]\n");
    expect(tags).toEqual(["a", "b", "c"]);
  });

  it("extractTags handles block list", () => {
    const yaml = [
      "created_by: dashboard",
      "tags:",
      "  - queue",
      "  - class19b",
      "  - sheet",
      "agent: forge",
    ].join("\n");
    expect(__internal__.extractTags(yaml)).toEqual(["queue", "class19b", "sheet"]);
  });

  it("extractTags returns [] when missing", () => {
    expect(__internal__.extractTags("foo: bar\n")).toEqual([]);
  });

  it("firstHeading strips markdown prefixes", () => {
    expect(__internal__.firstHeading("# Hello world\n\n", "fallback")).toBe(
      "Hello world",
    );
    expect(__internal__.firstHeading("\n## Nested\n", "fallback")).toBe("Nested");
  });

  it("firstHeading falls back when all lines blank", () => {
    expect(__internal__.firstHeading("\n\n\n", "fallback")).toBe("fallback");
  });

  it("firstHeading truncates long lines", () => {
    const long = "x".repeat(200);
    const out = __internal__.firstHeading(long, "fb");
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out.endsWith("…")).toBe(true);
  });

  it("shortIdForTmux strips known prefixes", () => {
    expect(__internal__.shortIdForTmux("web-abc123")).toBe("abc123");
    expect(__internal__.shortIdForTmux("wf-slug-1234-ab12")).toBe(
      "slug-1234-ab12",
    );
    expect(__internal__.shortIdForTmux("plain")).toBe("plain");
  });

  it("TASK_ID_RE rejects shell-metachar taskIds", () => {
    expect(TASK_ID_RE.test("web-abc123")).toBe(true);
    expect(TASK_ID_RE.test("wf-slug-1234-ab12")).toBe(true);
    expect(TASK_ID_RE.test("bad;rm-rf")).toBe(false);
    expect(TASK_ID_RE.test("../escape")).toBe(false);
    expect(TASK_ID_RE.test("with space")).toBe(false);
    expect(TASK_ID_RE.test("$(id)")).toBe(false);
  });
});

describe("cae-queue-item mutations reject invalid taskIds", () => {
  it("abortTask returns error for bad id", async () => {
    const r = await abortTask("bad;rm");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/invalid taskId/);
  });

  it("retryTask returns error for bad id", async () => {
    const r = await retryTask("$(id)");
    expect(r.ok).toBe(false);
  });

  it("approveReview returns error for bad id", async () => {
    const r = await approveReview("../foo");
    expect(r.ok).toBe(false);
  });

  it("denyReview returns error for bad id", async () => {
    const r = await denyReview("bad id");
    expect(r.ok).toBe(false);
  });
});
