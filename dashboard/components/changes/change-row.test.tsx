/**
 * Phase 9 Wave 2 (plan 09-04, CHG-02) — ChangeRow tests.
 *
 * Five assertions:
 *   1. Prose renders on the default row.
 *   2. Dev-mode detail is HIDDEN until the tech toggle is clicked
 *      (founder-mode default — dev=false).
 *   3. When the detail opens, SHA + branch + GitHub link are rendered.
 *   4. When githubUrl is null, the GitHub link is OMITTED (gotcha #14 —
 *      no `#` fallback).
 *   5. Class 5C — two events that share the same founder-speak prose
 *      (same project, same weekday bucket, same commit count) still
 *      render visually-distinct meta (time · sha · subject), so the
 *      timeline never looks like a phantom template leak.
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
    // SHA is present in both the closed meta row and the open dev-mode detail.
    expect(screen.getAllByText(/abc123d/).length).toBeGreaterThan(0);
    expect(screen.getByText(/forge\/p9-plA-t1-ab12cd/)).toBeInTheDocument();
    const link = screen.getByText(/view on GitHub|^gh$/);
    expect(link.closest("a")?.getAttribute("href")).toMatch(/github\.com/);
  });

  it("omits the GitHub link when githubUrl is null", () => {
    renderWithProviders(makeEvent({ githubUrl: null }));
    fireEvent.click(screen.getByTestId("change-row-tech-toggle"));
    expect(screen.queryByText(/view on GitHub|^gh$/)).toBeNull();
  });

  it("Class 5C — two same-bucket events render distinct meta (time + sha + subject)", () => {
    const eventA = makeEvent({
      ts: "2026-04-20T10:15:00Z",
      sha: "aaa111000000000000000000000000000000aaaa",
      shaShort: "aaa1110",
      commits: [{ sha: "c1", shaShort: "c1aaaaa", subject: "feat(one): alpha" }],
      prose: "CAE shipped 2 changes to dashboard Monday.",
    });
    const eventB = makeEvent({
      ts: "2026-04-20T22:47:00Z",
      sha: "bbb222000000000000000000000000000000bbbb",
      shaShort: "bbb2220",
      commits: [{ sha: "c2", shaShort: "c2bbbbb", subject: "fix(two): beta" }],
      prose: "CAE shipped 2 changes to dashboard Monday.",
    });

    const { container: containerA } = renderWithProviders(eventA);
    const metaA = containerA.querySelector(
      '[data-testid="change-row-meta"]',
    ) as HTMLElement;
    expect(metaA).not.toBeNull();
    expect(metaA.textContent).toMatch(/aaa1110/);
    expect(metaA.textContent).toMatch(/feat\(one\): alpha/);

    const { container: containerB } = renderWithProviders(eventB);
    const metaB = containerB.querySelector(
      '[data-testid="change-row-meta"]',
    ) as HTMLElement;
    expect(metaB).not.toBeNull();
    expect(metaB.textContent).toMatch(/bbb2220/);
    expect(metaB.textContent).toMatch(/fix\(two\): beta/);

    // Meta lines must diverge even though the prose is identical.
    expect(metaA.textContent).not.toBe(metaB.textContent);
  });
});
