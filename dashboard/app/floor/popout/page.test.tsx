/**
 * page.test.tsx — TDD RED for /floor/popout server page (Plan 11-05, Task 1)
 *
 * Tests 3-8 covering auth redirect, project resolution from searchParams,
 * forced popout=true, chrome-suppression style, and fallback behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks — must be before any imports of the module under test
// ---------------------------------------------------------------------------

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

// Mock redirect
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (url: string) => mockRedirect(url) }));

// Mock listProjects
const mockListProjects = vi.fn();
vi.mock("@/lib/cae-state", () => ({ listProjects: () => mockListProjects() }));

// Mock resolveCbPath — pure function, just append the suffix
vi.mock("@/lib/floor/cb-path", () => ({
  resolveCbPath: (projectPath: string | null | undefined) => {
    if (!projectPath) return null;
    return projectPath + "/.cae/metrics/circuit-breakers.jsonl";
  },
}));

// Mock FloorPopoutHost to a simple stub that records its props
const hostCalls: Array<{ cbPath: string | null; projectPath: string | null }> = [];
vi.mock("@/components/floor/floor-popout-host", () => ({
  default: (props: { cbPath: string | null; projectPath: string | null }) => {
    hostCalls.push({ cbPath: props.cbPath, projectPath: props.projectPath });
    return React.createElement("div", {
      "data-testid": "floor-popout-host-stub",
      "data-cbpath": props.cbPath ?? "",
      "data-projectpath": props.projectPath ?? "",
    });
  },
}));

import FloorPopoutPage from "./page";
import { render, screen } from "@testing-library/react";

describe("/floor/popout page", () => {
  beforeEach(() => {
    hostCalls.length = 0;
    mockRedirect.mockReset();
    mockAuth.mockReset();
    mockListProjects.mockReset();
  });

  it("3. Unauthenticated redirects to /signin?from=/floor/popout", async () => {
    mockAuth.mockResolvedValue(null);
    await FloorPopoutPage({ searchParams: { project: "/x" } });
    expect(mockRedirect).toHaveBeenCalledWith("/signin?from=/floor/popout");
  });

  it("4. Authenticated + explicit project: FloorPopoutHost receives correct projectPath + cbPath", async () => {
    mockAuth.mockResolvedValue({ user: { email: "test@example.com" }, expires: "2099-01-01" });
    mockListProjects.mockResolvedValue([]);
    const result = await FloorPopoutPage({ searchParams: { project: "/a" } });
    render(result as React.ReactElement);
    const stub = screen.getByTestId("floor-popout-host-stub");
    expect(stub.getAttribute("data-projectpath")).toBe("/a");
    expect(stub.getAttribute("data-cbpath")).toBe("/a/.cae/metrics/circuit-breakers.jsonl");
  });

  it("5. Authenticated + no project: falls back to most-recent Shift project", async () => {
    mockAuth.mockResolvedValue({ user: { email: "test@example.com" }, expires: "2099-01-01" });
    mockListProjects.mockResolvedValue([
      { path: "/a", name: "a", shiftUpdated: "2026-04-20" },
      { path: "/b", name: "b", shiftUpdated: "2026-04-23" },
    ]);
    const result = await FloorPopoutPage({ searchParams: {} });
    render(result as React.ReactElement);
    const stub = screen.getByTestId("floor-popout-host-stub");
    expect(stub.getAttribute("data-projectpath")).toBe("/b");
  });

  it("6. Authenticated + no project + no projects: FloorPopoutHost receives null, null", async () => {
    mockAuth.mockResolvedValue({ user: { email: "test@example.com" }, expires: "2099-01-01" });
    mockListProjects.mockResolvedValue([]);
    const result = await FloorPopoutPage({ searchParams: {} });
    render(result as React.ReactElement);
    const stub = screen.getByTestId("floor-popout-host-stub");
    expect(stub.getAttribute("data-projectpath")).toBe("");
    expect(stub.getAttribute("data-cbpath")).toBe("");
  });

  it("7. Chrome-suppression style present in rendered output", async () => {
    mockAuth.mockResolvedValue({ user: { email: "test@example.com" }, expires: "2099-01-01" });
    mockListProjects.mockResolvedValue([]);
    const result = await FloorPopoutPage({ searchParams: { project: "/x" } });
    const { container } = render(result as React.ReactElement);
    const styleEl = container.querySelector("style");
    expect(styleEl).not.toBeNull();
    // Must include display: none for top-nav
    expect(styleEl?.textContent).toMatch(/display:\s*none/i);
    expect(styleEl?.textContent).toMatch(/top-nav/);
  });
});
