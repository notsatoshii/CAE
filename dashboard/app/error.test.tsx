/**
 * Error page tests — Phase 15 Wave 2.8.
 *
 * Asserts the contract:
 *   - title is "Something tipped over."
 *   - breadcrumb shows the current pathname
 *   - error digest + message render inside the collapsible <details>
 *   - "Try again" button calls the `reset` prop
 *   - "Build home" link points to /build
 *   - "Report this" mailto includes path + digest in the body
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/build/agents/missing",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import ErrorPage from "./error";

function buildError(): Error & { digest?: string } {
  const e = new Error("synthetic test error") as Error & { digest?: string };
  e.digest = "test-digest-abc123";
  e.stack = "Error: synthetic test error\n    at Test.fn";
  return e;
}

describe("500 — error page", () => {
  it("renders the broken-circuit title", () => {
    render(<ErrorPage error={buildError()} reset={() => {}} />);
    expect(screen.getByText("Something tipped over.")).toBeTruthy();
  });

  it("renders the current pathname as a breadcrumb", () => {
    render(<ErrorPage error={buildError()} reset={() => {}} />);
    const crumb = screen.getByTestId("error-breadcrumb");
    expect(crumb.textContent).toBe("/build/agents/missing");
  });

  it("renders the error digest inside the details summary block", () => {
    render(<ErrorPage error={buildError()} reset={() => {}} />);
    const digest = screen.getByTestId("error-digest");
    expect(digest.textContent).toContain("test-digest-abc123");
  });

  it("calls reset() when the Try-again button is clicked", () => {
    const reset = vi.fn();
    render(<ErrorPage error={buildError()} reset={reset} />);
    fireEvent.click(screen.getByTestId("error-reset-button"));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("Build home link points to /build", () => {
    render(<ErrorPage error={buildError()} reset={() => {}} />);
    const link = screen.getByTestId("error-link-home") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/build");
  });

  it("Report-this link is a mailto with the path + digest in the body", () => {
    render(<ErrorPage error={buildError()} reset={() => {}} />);
    const mailto = screen.getByTestId("error-report-link") as HTMLAnchorElement;
    const href = mailto.getAttribute("href") ?? "";
    expect(href.startsWith("mailto:eric@diiant.com")).toBe(true);
    expect(decodeURIComponent(href)).toContain("/build/agents/missing");
    expect(decodeURIComponent(href)).toContain("test-digest-abc123");
  });

  it("exposes the page-level testid", () => {
    render(<ErrorPage error={buildError()} reset={() => {}} />);
    expect(screen.getByTestId("error-page")).toBeTruthy();
  });

  it("renders the pixel-art SVG icon", () => {
    const { container } = render(
      <ErrorPage error={buildError()} reset={() => {}} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("falls back to '(no message)' when error.message is empty", () => {
    const e = new Error("") as Error & { digest?: string };
    render(<ErrorPage error={e} reset={() => {}} />);
    expect(screen.getByText("(no message)")).toBeTruthy();
  });
});
