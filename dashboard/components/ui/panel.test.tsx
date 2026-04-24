import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Panel } from "./panel";

describe("Panel", () => {
  it("renders title in an h2", () => {
    render(<Panel title="Spending">content</Panel>);
    expect(screen.getByRole("heading", { level: 2, name: "Spending" })).toBeTruthy();
  });

  it("renders children", () => {
    render(<Panel title="Test"><span data-testid="child">hello</span></Panel>);
    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("renders subtitle when provided", () => {
    render(<Panel title="Test" subtitle="Traffic · 42k">content</Panel>);
    expect(screen.getByText("Traffic · 42k")).toBeTruthy();
  });

  it("does not render subtitle element when absent", () => {
    const { container } = render(<Panel title="Test">content</Panel>);
    // Only the h2 should be in the header
    const spans = container.querySelectorAll("header span");
    expect(spans.length).toBe(0);
  });

  it("uses section as root by default", () => {
    const { container } = render(<Panel title="Test">content</Panel>);
    expect(container.querySelector("section")).toBeTruthy();
  });

  it("respects as prop to use div", () => {
    const { container } = render(<Panel title="Test" as="div">content</Panel>);
    expect(container.querySelector("div")).toBeTruthy();
    expect(container.querySelector("section")).toBeNull();
  });

  it("applies testId to root element", () => {
    render(<Panel title="Test" testId="my-panel">content</Panel>);
    expect(screen.getByTestId("my-panel")).toBeTruthy();
  });

  it("links aria-labelledby to h2 id", () => {
    const { container } = render(<Panel title="Spending">content</Panel>);
    const section = container.querySelector("section");
    const h2 = container.querySelector("h2");
    expect(section?.getAttribute("aria-labelledby")).toBe(h2?.getAttribute("id"));
  });

  it("respects explicit headingId", () => {
    const { container } = render(
      <Panel title="Test" headingId="spending-heading">content</Panel>
    );
    const h2 = container.querySelector("h2");
    expect(h2?.getAttribute("id")).toBe("spending-heading");
  });

  // Class 13A — elevation tokens
  it("omits elevation shadow class when elevation is 0 (default)", () => {
    const { container } = render(<Panel title="Test">content</Panel>);
    const root = container.querySelector("section");
    expect(root?.className).not.toContain("shadow-elevation-");
    expect(root?.getAttribute("data-elevation")).toBe("0");
  });

  it("applies shadow-elevation-1 when elevation=1", () => {
    const { container } = render(
      <Panel title="Test" elevation={1}>content</Panel>,
    );
    const root = container.querySelector("section");
    expect(root?.className).toContain("shadow-elevation-1");
    expect(root?.getAttribute("data-elevation")).toBe("1");
  });

  it("applies shadow-elevation-3 when elevation=3", () => {
    const { container } = render(
      <Panel title="Test" elevation={3}>content</Panel>,
    );
    const root = container.querySelector("section");
    expect(root?.className).toContain("shadow-elevation-3");
  });

  it("interactive=true sets resting elevation-1 + hover-elevation-2 + scale", () => {
    const { container } = render(
      <Panel title="Test" interactive>content</Panel>,
    );
    const root = container.querySelector("section");
    expect(root?.className).toContain("shadow-elevation-1");
    expect(root?.className).toContain("hover:shadow-elevation-2");
    expect(root?.className).toContain("hover:scale-[1.01]");
    expect(root?.className).toContain("transition-all");
    expect(root?.getAttribute("data-interactive")).toBe("true");
  });

  it("interactive=false (default) does not set interactive className hints", () => {
    const { container } = render(<Panel title="Test">content</Panel>);
    const root = container.querySelector("section");
    expect(root?.className).not.toContain("hover:scale-[1.01]");
    expect(root?.getAttribute("data-interactive")).toBeNull();
  });

  // Class 5H / session-14 — glassmorphic default ON
  it("glass=true (default) applies .glass-surface utility", () => {
    const { container } = render(<Panel title="Test">content</Panel>);
    const root = container.querySelector("section");
    expect(root?.className).toContain("glass-surface");
    // Opaque surface + solid border are omitted when glass mode is on —
    // the utility provides both fill and border-gradient.
    expect(root?.className).not.toContain("bg-[color:var(--surface)]");
    expect(root?.className).not.toContain("border border-[color:var(--border)]");
    expect(root?.getAttribute("data-glass")).toBe("true");
  });

  it("glass={false} opts out — renders opaque surface + solid border", () => {
    const { container } = render(
      <Panel title="Test" glass={false}>content</Panel>,
    );
    const root = container.querySelector("section");
    expect(root?.className).not.toContain("glass-surface");
    expect(root?.className).toContain("bg-[color:var(--surface)]");
    expect(root?.className).toContain("border border-[color:var(--border)]");
    expect(root?.getAttribute("data-glass")).toBeNull();
  });

  it("glass=true preserves rounded-lg + p-6 padding", () => {
    const { container } = render(
      <Panel title="Test" glass>content</Panel>,
    );
    const root = container.querySelector("section");
    expect(root?.className).toContain("rounded-lg");
    expect(root?.className).toContain("p-6");
  });

  it("glass=true composes with elevation={1}", () => {
    const { container } = render(
      <Panel title="Test" glass elevation={1}>content</Panel>,
    );
    const root = container.querySelector("section");
    expect(root?.className).toContain("glass-surface");
    expect(root?.className).toContain("shadow-elevation-1");
  });
});
