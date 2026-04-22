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
});
