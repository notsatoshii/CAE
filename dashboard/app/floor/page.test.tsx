/**
 * page.test.tsx — TDD RED for /floor server page (Plan 11-04, Task 3)
 *
 * Tests 11-17 covering auth redirect, searchParams handling, and project resolution.
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

// Mock FloorClient to a simple stub that records its props
const floorClientCalls: Array<{ cbPath: string | null; projectPath: string | null; popout: boolean }> = [];
vi.mock("@/components/floor/floor-client", () => ({
  default: (props: { cbPath: string | null; projectPath: string | null; popout: boolean }) => {
    floorClientCalls.push({ cbPath: props.cbPath, projectPath: props.projectPath, popout: props.popout });
    return React.createElement("div", {
      "data-testid": "floor-client-stub",
      "data-cbpath": props.cbPath ?? "",
      "data-projectpath": props.projectPath ?? "",
      "data-popout": String(props.popout),
    });
  },
}));

import FloorPage from "./page";
import { render, screen } from "@testing-library/react";

describe("/floor page", () => {
  beforeEach(() => {
    floorClientCalls.length = 0;
    mockRedirect.mockReset();
    mockAuth.mockReset();
    mockListProjects.mockReset();
  });

  it("11. Unauthenticated redirects to /signin?from=/floor", async () => {
    mockAuth.mockResolvedValue(null);
    // render as async server component
    await FloorPage({ searchParams: Promise.resolve({}) });
    expect(mockRedirect).toHaveBeenCalledWith("/signin?from=/floor");
  });

  it("12. Authenticated, no searchParams — resolves most-recent Shift project", async () => {
    mockAuth.mockResolvedValue({ user: { email: "test@example.com" }, expires: "2099-01-01" });
    mockListProjects.mockResolvedValue([
      { path: "/a", name: "a", shiftUpdated: "2026-04-20T00:00:00Z" },
      { path: "/b", name: "b", shiftUpdated: "2026-04-23T00:00:00Z" },
    ]);
    const result = await FloorPage({ searchParams: Promise.resolve({}) });
    render(result as React.ReactElement);
    const stub = screen.getByTestId("floor-client-stub");
    expect(stub.dataset.projectpath).toBe("/b");
    expect(stub.dataset.cbpath).toBe("/b/.cae/metrics/circuit-breakers.jsonl");
    expect(stub.dataset.popout).toBe("false");
  });

  it("13. Authenticated, ?project=/c — picks explicit project", async () => {
    mockAuth.mockResolvedValue({ user: { email: "test@example.com" }, expires: "2099-01-01" });
    mockListProjects.mockResolvedValue([
      { path: "/c", name: "c", shiftUpdated: "2026-04-22T00:00:00Z" },
      { path: "/b", name: "b", shiftUpdated: "2026-04-23T00:00:00Z" },
    ]);
    const result = await FloorPage({ searchParams: Promise.resolve({ project: "/c" }) });
    render(result as React.ReactElement);
    const stub = screen.getByTestId("floor-client-stub");
    expect(stub.dataset.projectpath).toBe("/c");
  });

  it("14. Authenticated, ?project= pointing at unknown project — trusts the path string", async () => {
    mockAuth.mockResolvedValue({ user: { email: "test@example.com" }, expires: "2099-01-01" });
    mockListProjects.mockResolvedValue([
      { path: "/b", name: "b", shiftUpdated: "2026-04-23T00:00:00Z" },
    ]);
    const result = await FloorPage({ searchParams: Promise.resolve({ project: "/unknown" }) });
    render(result as React.ReactElement);
    const stub = screen.getByTestId("floor-client-stub");
    expect(stub.dataset.projectpath).toBe("/unknown");
    expect(stub.dataset.cbpath).toBe("/unknown/.cae/metrics/circuit-breakers.jsonl");
  });

  it("15. Authenticated, no projects — FloorClient mounts with projectPath=null and cbPath=null", async () => {
    mockAuth.mockResolvedValue({ user: { email: "test@example.com" }, expires: "2099-01-01" });
    mockListProjects.mockResolvedValue([]);
    const result = await FloorPage({ searchParams: Promise.resolve({}) });
    render(result as React.ReactElement);
    const stub = screen.getByTestId("floor-client-stub");
    expect(stub.dataset.projectpath).toBe("");
    expect(stub.dataset.cbpath).toBe("");
  });

  it("16. popout=1 flows through as popout=true", async () => {
    mockAuth.mockResolvedValue({ user: { email: "test@example.com" }, expires: "2099-01-01" });
    mockListProjects.mockResolvedValue([
      { path: "/b", name: "b", shiftUpdated: "2026-04-23T00:00:00Z" },
    ]);
    const result = await FloorPage({ searchParams: Promise.resolve({ popout: "1" }) });
    render(result as React.ReactElement);
    const stub = screen.getByTestId("floor-client-stub");
    expect(stub.dataset.popout).toBe("true");
  });

  it("17. popout=1 uses h-screen layout class", async () => {
    mockAuth.mockResolvedValue({ user: { email: "test@example.com" }, expires: "2099-01-01" });
    mockListProjects.mockResolvedValue([
      { path: "/b", name: "b", shiftUpdated: "2026-04-23T00:00:00Z" },
    ]);
    const result = await FloorPage({ searchParams: Promise.resolve({ popout: "1" }) });
    render(result as React.ReactElement);
    const main = screen.getByRole("main");
    expect(main.className).toContain("h-screen");
    expect(main.className).not.toContain("calc(100vh-40px)");
  });

  it("18. searchParams is a Promise — awaiting it resolves project correctly (CR-01 regression)", async () => {
    // This test would FAIL with the old sync signature because Promise.resolve({project:"/z"})
    // accessed as a plain object returns `undefined` for `.project` — the fallback fires instead.
    mockAuth.mockResolvedValue({ user: { email: "test@example.com" }, expires: "2099-01-01" });
    mockListProjects.mockResolvedValue([
      { path: "/fallback", name: "fallback", shiftUpdated: "2026-04-23T00:00:00Z" },
    ]);
    const result = await FloorPage({ searchParams: Promise.resolve({ project: "/z" }) });
    render(result as React.ReactElement);
    const stub = screen.getByTestId("floor-client-stub");
    // Must be "/z", not "/fallback" — proves the await happened
    expect(stub.dataset.projectpath).toBe("/z");
  });
});
