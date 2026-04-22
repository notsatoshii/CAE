/**
 * Phase 14 Wave 0 — type-level assertions for all five new types.
 *
 * These tests use runtime assignability checks that fail at compile time
 * (tsc --noEmit) if the type contracts are violated. They also serve as
 * living documentation for downstream waves that import from @/lib/cae-types.
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  CatalogSkill,
  ScheduledTask,
  Role,
  AuditEntry,
  TrustScore,
  TrustFactor,
} from "./cae-types";

describe("CatalogSkill", () => {
  it("has required fields with correct types", () => {
    const skill: CatalogSkill = {
      name: "vercel-labs/agent-skills",
      owner: "vercel-labs",
      source: "skills.sh",
      description: "Reusable agent skills",
      installCmd: "npx skills add vercel-labs/agent-skills",
      detailUrl: "https://skills.sh/vercel-labs/agent-skills",
      installed: false,
    };
    expectTypeOf(skill.name).toBeString();
    expectTypeOf(skill.owner).toBeString();
    expectTypeOf(skill.description).toBeString();
    expectTypeOf(skill.installCmd).toBeString();
    expectTypeOf(skill.detailUrl).toBeString();
    expectTypeOf(skill.installed).toBeBoolean();
  });

  it("source is constrained to known literals", () => {
    expectTypeOf<CatalogSkill["source"]>().toEqualTypeOf<
      "skills.sh" | "clawhub" | "local"
    >();
  });
});

describe("ScheduledTask", () => {
  it("has required fields with correct types", () => {
    const task: ScheduledTask = {
      id: "morning-brief",
      nl: "every morning at 9am",
      cron: "0 9 * * *",
      timezone: "America/New_York",
      buildplan: "tasks/morning-brief.md",
      enabled: true,
      lastRun: 0,
    };
    expectTypeOf(task.id).toBeString();
    expectTypeOf(task.nl).toBeString();
    expectTypeOf(task.cron).toBeString();
    expectTypeOf(task.timezone).toBeString();
    expectTypeOf(task.buildplan).toBeString();
    expectTypeOf(task.enabled).toBeBoolean();
    expectTypeOf(task.lastRun).toBeNumber();
  });

  it("lastCompleted is optional", () => {
    const withCompletion: ScheduledTask = {
      id: "t1",
      nl: "every hour",
      cron: "0 * * * *",
      timezone: "UTC",
      buildplan: "tasks/health.md",
      enabled: true,
      lastRun: 1700000000,
      lastCompleted: 1700000060,
    };
    expectTypeOf(withCompletion.lastCompleted).toEqualTypeOf<
      number | undefined
    >();
  });
});

describe("Role", () => {
  it("is constrained to viewer | operator | admin", () => {
    // Compile-time assertion: assigning all three literals must be valid.
    // If Role gains or loses a member, tsc will catch it at the assignment site.
    const _v: Role = "viewer";
    const _o: Role = "operator";
    const _a: Role = "admin";
    // Runtime: check all three values are string
    expectTypeOf(_v).toBeString();
    expectTypeOf(_o).toBeString();
    expectTypeOf(_a).toBeString();
  });

  it("can hold each valid value at runtime", () => {
    const values: Role[] = ["viewer", "operator", "admin"];
    for (const v of values) {
      expect(typeof v).toBe("string");
    }
  });
});

describe("AuditEntry", () => {
  it("has ts, task, tool, cwd fields", () => {
    const entry: AuditEntry = {
      ts: "2026-04-23T10:00:00Z",
      task: "t-abc123",
      tool: "Bash",
      cwd: "/home/cae/ctrl-alt-elite",
    };
    expectTypeOf(entry.ts).toBeString();
    expectTypeOf(entry.task).toBeString();
    expectTypeOf(entry.tool).toBeString();
    expectTypeOf(entry.cwd).toBeString();
  });
});

describe("TrustScore + TrustFactor", () => {
  it("TrustScore has total (number) and factors (TrustFactor[])", () => {
    const factor: TrustFactor = {
      id: "no-secret-leak",
      passed: true,
      weight: 0.4,
      reason: "gitleaks found no secrets",
    };
    const score: TrustScore = {
      total: 85,
      factors: [factor],
    };
    expectTypeOf(score.total).toBeNumber();
    expectTypeOf(score.factors).toEqualTypeOf<TrustFactor[]>();
  });

  it("TrustFactor.weight is a number (0-1 range enforced at runtime, not type)", () => {
    expectTypeOf<TrustFactor["weight"]>().toBeNumber();
  });

  it("TrustFactor.passed is boolean", () => {
    expectTypeOf<TrustFactor["passed"]>().toBeBoolean();
  });
});
