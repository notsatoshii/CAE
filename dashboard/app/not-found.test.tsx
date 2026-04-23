/**
 * Not-found page tests — Phase 15 Wave 2.8.
 *
 * Asserts the contract:
 *   - title copy is "Looks like that page wandered off."
 *   - breadcrumb renders the requested path from x-invoke-path / x-matched-path
 *   - the 3 quick links resolve to /build, /build/agents, and /build?palette=open
 *   - quick links carry the correct testIds for harness queries
 *
 * Server-component: we call the async default export and render the resolved
 * tree. `next/headers` is mocked so the breadcrumb has a deterministic value.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Map([
      ["x-invoke-path", "/this-route-does-not-exist"],
    ]) as unknown as Headers,
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

import NotFound from "./not-found";

describe("404 — not-found page", () => {
  it("renders the lost-agent title", async () => {
    const ui = await NotFound();
    render(ui);
    expect(
      screen.getByText("Looks like that page wandered off."),
    ).toBeTruthy();
  });

  it("renders the requested path as a breadcrumb", async () => {
    const ui = await NotFound();
    render(ui);
    const crumb = screen.getByTestId("not-found-breadcrumb");
    expect(crumb.textContent).toBe("/this-route-does-not-exist");
  });

  it("renders 3 quick links pointing to home / agents / palette", async () => {
    const ui = await NotFound();
    render(ui);
    const home = screen.getByTestId("not-found-link-home") as HTMLAnchorElement;
    const agents = screen.getByTestId(
      "not-found-link-agents",
    ) as HTMLAnchorElement;
    const palette = screen.getByTestId(
      "not-found-link-palette",
    ) as HTMLAnchorElement;

    expect(home.getAttribute("href")).toBe("/build");
    expect(agents.getAttribute("href")).toBe("/build/agents");
    expect(palette.getAttribute("href")).toBe("/build?palette=open");
  });

  it("exposes the page-level testid", async () => {
    const ui = await NotFound();
    render(ui);
    expect(screen.getByTestId("not-found-page")).toBeTruthy();
  });

  it("renders the pixel-art SVG icon", async () => {
    const ui = await NotFound();
    const { container } = render(ui);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("includes the ⌘K kbd hint inside the palette link", async () => {
    const ui = await NotFound();
    render(ui);
    const palette = screen.getByTestId("not-found-link-palette");
    expect(palette.querySelector("kbd")?.textContent).toContain("⌘K");
  });
});
