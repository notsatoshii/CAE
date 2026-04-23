// RED-phase scaffold for Phase 10 plan 01. Fails until lib/cae-ship.ts lands in wave 1.

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  parseEnvExample,
  validateShipInput,
  ghAuthStatus,
  writeEnvLocal,
} from "./cae-ship";

const FIXTURE_DIR = join(
  process.cwd(),
  ".planning/phases/10-plan-mode-projects-prds-roadmaps-uat/__fixtures__/plan",
);

vi.mock("child_process");

describe("parseEnvExample", () => {
  it("extracts whitelisted keys from fixture dot-env-example.txt", () => {
    const fixturePath = join(FIXTURE_DIR, "dot-env-example.txt");
    const content = readFileSync(fixturePath, "utf8");

    const keys = parseEnvExample(content);
    expect(keys).toContain("DATABASE_URL");
    expect(keys).toContain("NEXTAUTH_SECRET");
    expect(keys).toContain("NEXTAUTH_URL");
    expect(keys).toContain("SENTRY_DSN");
    expect(keys).toContain("STRIPE_KEY");
  });

  it("skips comment lines and blank lines", () => {
    const content = "# Required\nDATABASE_URL=postgres://localhost/mydb\n\n# Comment\nNEXTAUTH_SECRET=abc\n";
    const keys = parseEnvExample(content);
    expect(keys).toContain("DATABASE_URL");
    expect(keys).toContain("NEXTAUTH_SECRET");
    // No comment-only or blank entries
    expect(keys.every((k: string) => /^[A-Z_][A-Z0-9_]*$/.test(k))).toBe(true);
  });

  it("handles inline trailing comments", () => {
    const content = "FOO=bar # inline comment\n";
    const keys = parseEnvExample(content);
    expect(keys).toContain("FOO");
    // The value should not include the inline comment for key extraction purposes
    expect(keys.length).toBe(1);
  });
});

describe("validateShipInput", () => {
  it("rejects keys not in the whitelist", () => {
    const whitelist = ["DATABASE_URL", "NEXTAUTH_SECRET"];
    const input = { DATABASE_URL: "postgres://localhost/mydb", EVIL_KEY: "bad" };

    expect(() => validateShipInput(input, whitelist)).toThrow();
  });

  it("accepts whitelisted keys with empty string values", () => {
    const whitelist = ["DATABASE_URL", "SENTRY_DSN"];
    const input = { DATABASE_URL: "postgres://localhost/mydb", SENTRY_DSN: "" };

    // Should not throw — empty string is valid for optional keys
    expect(() => validateShipInput(input, whitelist)).not.toThrow();
  });
});

describe("ghAuthStatus", () => {
  it("returns { authed: true } when execFile exits 0", async () => {
    const { execFile } = await import("child_process");
    // Mock execFile to call callback with no error (exit 0)
    vi.mocked(execFile).mockImplementation(
      (_cmd: unknown, _args: unknown, callback: unknown) => {
        (callback as (err: null, stdout: string, stderr: string) => void)(null, "Logged in to github.com", "");
        return {} as ReturnType<typeof execFile>;
      },
    );

    const result = await ghAuthStatus();
    expect(result.authed).toBe(true);
  });

  it("returns { authed: false } when execFile exits 1", async () => {
    const { execFile } = await import("child_process");
    const err = Object.assign(new Error("Not logged in"), { code: 1 });
    vi.mocked(execFile).mockImplementation(
      (_cmd: unknown, _args: unknown, callback: unknown) => {
        (callback as (err: Error, stdout: string, stderr: string) => void)(err, "", "You are not logged into any GitHub hosts.");
        return {} as ReturnType<typeof execFile>;
      },
    );

    const result = await ghAuthStatus();
    expect(result.authed).toBe(false);
  });
});

describe("writeEnvLocal — newline injection guard (WR-02)", () => {
  const fakeProj = { path: "/tmp/wr02-test-" + Date.now(), name: "wr02-test", slug: "wr02-test", shiftPhase: "idea" as const, createdAt: "", hasPlanning: false };

  it("rejects a value containing \\n (newline injection)", async () => {
    await expect(
      writeEnvLocal(fakeProj, { DATABASE_URL: "postgres://ok\nEVIL_KEY=injected" }),
    ).rejects.toThrow("contains newline");
  });

  it("rejects a value containing \\r (carriage-return injection)", async () => {
    await expect(
      writeEnvLocal(fakeProj, { API_KEY: "value\rwith-cr" }),
    ).rejects.toThrow("contains newline");
  });

  it("rejects an invalid key (lowercase letters)", async () => {
    await expect(
      writeEnvLocal(fakeProj, { bad_key: "value" }),
    ).rejects.toThrow("invalid env key");
  });

  it("rejects a key with embedded newline (key injection)", async () => {
    await expect(
      writeEnvLocal(fakeProj, { "FOO\nEVIL=x": "value" }),
    ).rejects.toThrow("invalid env key");
  });

  it("accepts valid uppercase keys and clean values without throwing", async () => {
    // mkdir the fake project path so writeFile can succeed
    const { mkdir } = await import("fs/promises");
    await mkdir(fakeProj.path, { recursive: true });
    await expect(
      writeEnvLocal(fakeProj, { DATABASE_URL: "postgres://localhost/db", NEXTAUTH_SECRET: "abc123" }),
    ).resolves.toMatch(/\.env\.local$/);
  });
});
