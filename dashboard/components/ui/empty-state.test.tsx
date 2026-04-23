/**
 * EmptyState primitive tests (Plan 12-03, Task 1, EMP-01).
 *
 * Covers:
 *  - heading renders as <h3> (role heading, level 3)
 *  - body renders only when provided
 *  - actions renders only when provided
 *  - default testId is "empty-state"; overridable
 *  - variant="error" sets data-variant="error" and icon gets danger class
 *  - hero icon gets aria-hidden="true" and size-12 class
 *  - no implicit role="alert" — informational only
 *  - className prop merges onto root container
 *  - <EmptyStateActions> renders a flex-wrap container with its children
 */

import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { describe, it, expect } from "vitest";
import { EmptyState, EmptyStateActions } from "./empty-state";

describe("EmptyState", () => {
  it("renders heading as h3 with the provided text", () => {
    render(<EmptyState heading="Nothing here yet." />);
    const h3 = screen.getByRole("heading", { level: 3 });
    expect(h3).toBeTruthy();
    expect(h3.textContent).toBe("Nothing here yet.");
  });

  it("does NOT render body paragraph when body prop is omitted", () => {
    render(<EmptyState heading="Heading only" />);
    // No <p> element
    const paras = document.querySelectorAll("p");
    expect(paras).toHaveLength(0);
  });

  it("renders body paragraph when body prop is provided", () => {
    render(<EmptyState heading="Head" body="Some body text." />);
    const p = screen.getByText("Some body text.");
    expect(p.tagName.toLowerCase()).toBe("p");
  });

  it("does NOT render actions slot when actions prop is omitted", () => {
    render(<EmptyState heading="Head" />);
    // No buttons
    const buttons = document.querySelectorAll("button");
    expect(buttons).toHaveLength(0);
  });

  it("renders actions slot when actions prop is provided", () => {
    render(
      <EmptyState
        heading="Head"
        actions={<button type="button">Click me</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Click me" })).toBeTruthy();
  });

  it("uses 'empty-state' as default data-testid", () => {
    const { container } = render(<EmptyState heading="Head" />);
    const el = container.querySelector('[data-testid="empty-state"]');
    expect(el).toBeTruthy();
  });

  it("uses overridden testId when provided", () => {
    const { container } = render(
      <EmptyState heading="Head" testId="my-empty" />
    );
    expect(container.querySelector('[data-testid="my-empty"]')).toBeTruthy();
  });

  it("sets data-variant='error' when variant='error'", () => {
    const { container } = render(
      <EmptyState heading="Error" variant="error" icon={Inbox} />
    );
    const root = container.querySelector('[data-testid="empty-state"]');
    expect(root?.getAttribute("data-variant")).toBe("error");
  });

  it("sets data-variant='empty' by default", () => {
    const { container } = render(<EmptyState heading="Empty" />);
    const root = container.querySelector('[data-testid="empty-state"]');
    expect(root?.getAttribute("data-variant")).toBe("empty");
  });

  it("hero icon has aria-hidden='true' and size-12 class", () => {
    render(<EmptyState heading="Head" icon={Inbox} />);
    const svg = document.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    // SVG className is an SVGAnimatedString; use getAttribute for jsdom compat
    expect(svg?.getAttribute("class")).toContain("size-12");
  });

  it("hero icon with variant='error' has danger colour class", () => {
    render(<EmptyState heading="Error" icon={Inbox} variant="error" />);
    const svg = document.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("var(--danger)");
  });

  it("does NOT render an alert role — informational only", () => {
    render(<EmptyState heading="Info" />);
    const alerts = document.querySelectorAll('[role="alert"]');
    expect(alerts).toHaveLength(0);
  });

  it("merges className onto the root container", () => {
    const { container } = render(
      <EmptyState heading="Head" className="custom-class" />
    );
    const root = container.querySelector('[data-testid="empty-state"]');
    expect(root?.className).toContain("custom-class");
  });
});

describe("EmptyStateActions", () => {
  it("renders a flex-wrap container with its children", () => {
    render(
      <EmptyStateActions>
        <button type="button">A</button>
        <button type="button">B</button>
      </EmptyStateActions>
    );
    expect(screen.getByRole("button", { name: "A" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "B" })).toBeTruthy();

    // Container should have flex and flex-wrap classes
    const container = document.querySelector(".flex.flex-wrap");
    expect(container).toBeTruthy();
  });
});

// ── Wave 2.6 alias-prop API + EMPTY_COPY adoption ──────────────────────────
describe("EmptyState — Wave 2.6 alias API", () => {
  it("renders title as the <h3> heading (alias for heading)", () => {
    render(<EmptyState title="Queue is clear" />);
    const h3 = screen.getByRole("heading", { level: 3 });
    expect(h3.textContent).toBe("Queue is clear");
  });

  it("renders description as the body paragraph (alias for body)", () => {
    render(
      <EmptyState
        title="No data"
        description="Nothing to render right now."
      />
    );
    expect(screen.getByText("Nothing to render right now.").tagName.toLowerCase()).toBe("p");
  });

  it("original heading/body win over title/description when both provided", () => {
    render(
      <EmptyState
        heading="Original heading"
        body="Original body"
        title="Aliased title"
        description="Aliased description"
      />
    );
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Original heading");
    expect(screen.getByText("Original body")).toBeTruthy();
    // Aliased copy must NOT appear when originals are present
    expect(screen.queryByText("Aliased title")).toBeNull();
    expect(screen.queryByText("Aliased description")).toBeNull();
  });

  it("renders cta as an <a> with href + label when actions slot is empty", () => {
    render(
      <EmptyState
        title="No workflows defined"
        description="Define one."
        cta={{ label: "Create workflow", href: "/build/workflows/new" }}
      />
    );
    const link = screen.getByRole("link", { name: "Create workflow" });
    expect(link.getAttribute("href")).toBe("/build/workflows/new");
  });

  it("does NOT render cta when an actions slot is provided (back-compat priority)", () => {
    render(
      <EmptyState
        title="Has actions"
        actions={<button type="button">From actions slot</button>}
        cta={{ label: "From cta", href: "/x" }}
      />
    );
    expect(screen.getByRole("button", { name: "From actions slot" })).toBeTruthy();
    // cta link must be suppressed when actions takes precedence
    expect(screen.queryByRole("link", { name: "From cta" })).toBeNull();
  });

  it("renders tip text as a small <p> below the CTA when provided", () => {
    render(
      <EmptyState
        title="No agents have run yet"
        description="Spin one up."
        tip="Agents appear after their first event."
      />
    );
    const tip = screen.getByText("Agents appear after their first event.");
    expect(tip.tagName.toLowerCase()).toBe("p");
  });
});
