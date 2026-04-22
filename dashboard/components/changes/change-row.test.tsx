/**
 * Phase 9 Wave 2 (plan 09-04, CHG-02) — ChangeRow tests.
 *
 * Four assertions (per plan success criteria):
 *   1. Prose renders on the default row.
 *   2. Dev-mode detail is HIDDEN until the tech toggle is clicked
 *      (founder-mode default — dev=false).
 *   3. When the detail opens, SHA + branch + GitHub link are rendered.
 *   4. When githubUrl is null, the GitHub link is OMITTED (gotcha #14 —
 *      no `#` fallback).
 *
 * Providers: ExplainMode + DevMode wrap ChangeRow because the component
 * reads both hooks (DevMode drives open-state + label branch; ExplainMode
 * drives the ExplainTooltip trigger opacity).
 */

import { describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { ChangeRow } from "./change-row";
import { DevModeProvider } from "@/lib/providers/dev-mode";
import { ExplainModeProvider } from "@/lib/providers/explain-mode";
import type { ChangeEvent } from "@/lib/cae-changes-state";

afterEach(() => {
  cleanup();
});

function makeEvent(over: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    ts: "2026-04-22T14:00:00Z",
    project: "/home/cae/ctrl-alt-elite",
    projectName: "ctrl-alt-elite",
    sha: "abc123def456abc123def456abc123def456abcd",
    shaShort: "abc123d",
    mergeSubject: "Merge forge/p9-plA-t1-ab12cd (Sentinel-approved)",
    branch: "forge/p9-plA-t1-ab12cd",
    phase: "p9",
    task: "p9-plA-t1-ab12cd",
    githubUrl: "https://github.com/notsatoshii/CAE/commit/abc123def456",
    agent: "forge",
    model: "claude-sonnet-4-6",
    tokens: 4200,
    commits: [{ sha: "c1aaaaaaaa", shaShort: "c1aaaaa", subject: "feat(x): add Y" }],
    prose: "the builder shipped 1 change to ctrl-alt-elite this afternoon.",
    ...over,
  };
}

function renderWithProviders(ev: ChangeEvent) {
  return render(
    <ExplainModeProvider>
      <DevModeProvider>
        <ChangeRow event={ev} />
      </DevModeProvider>
    </ExplainModeProvider>,
  );
}

describe("ChangeRow", () => {
  it("renders prose in the default (founder) row", () => {
    renderWithProviders(makeEvent());
    expect(
      screen.getByText(/the builder shipped 1 change to ctrl-alt-elite/),
    ).toBeInTheDocument();
  });

  it("hides the dev-mode detail until the toggle is clicked", () => {
    renderWithProviders(makeEvent());
    expect(screen.queryByTestId("dev-mode-detail")).toBeNull();
    fireEvent.click(screen.getByTestId("change-row-tech-toggle"));
    expect(screen.getByTestId("dev-mode-detail")).toBeInTheDocument();
  });

  it("renders SHA + branch + GitHub link when technical is open", () => {
    renderWithProviders(makeEvent());
    fireEvent.click(screen.getByTestId("change-row-tech-toggle"));
    expect(screen.getByText(/abc123d/)).toBeInTheDocument();
    expect(screen.getByText(/forge\/p9-plA-t1-ab12cd/)).toBeInTheDocument();
    const link = screen.getByText(/view on GitHub|^gh$/);
    expect(link.closest("a")?.getAttribute("href")).toMatch(/github\.com/);
  });

  it("omits the GitHub link when githubUrl is null", () => {
    renderWithProviders(makeEvent({ githubUrl: null }));
    fireEvent.click(screen.getByTestId("change-row-tech-toggle"));
    expect(screen.queryByText(/view on GitHub|^gh$/)).toBeNull();
  });
});
