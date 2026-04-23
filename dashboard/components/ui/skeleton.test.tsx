/**
 * Skeleton primitive tests — Phase 15 Wave 2.7.
 *
 * Covers each export:
 *   - <Skeleton>      atomic placeholder
 *   - <CardSkeleton>  card-shape variant
 *   - <RowSkeleton>   row-shape variant (single + multi-row)
 *
 * Asserts the contract: aria-busy="true", role="status", aria-live="polite",
 * default + override testIds, width/height styles flow through, sr-only label
 * is present, and rounded-* class matches the requested variant.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Skeleton, CardSkeleton, RowSkeleton } from "./skeleton";

describe("Skeleton (atomic)", () => {
  it("renders with role=status and aria-busy=true by default", () => {
    render(<Skeleton />);
    const el = screen.getByTestId("skeleton");
    expect(el.getAttribute("role")).toBe("status");
    expect(el.getAttribute("aria-busy")).toBe("true");
    expect(el.getAttribute("aria-live")).toBe("polite");
  });

  it("uses 'Loading' as the default aria-label", () => {
    render(<Skeleton />);
    expect(screen.getByTestId("skeleton").getAttribute("aria-label")).toBe("Loading");
  });

  it("uses a custom aria-label when `label` prop is provided", () => {
    render(<Skeleton label="Loading agents" />);
    expect(screen.getByTestId("skeleton").getAttribute("aria-label")).toBe("Loading agents");
  });

  it("respects testId override", () => {
    render(<Skeleton testId="custom-skel" />);
    expect(screen.getByTestId("custom-skel")).toBeTruthy();
  });

  it("applies width + height as inline styles when provided as numbers", () => {
    render(<Skeleton width={120} height={32} />);
    const el = screen.getByTestId("skeleton");
    expect(el.getAttribute("style")).toContain("width: 120px");
    expect(el.getAttribute("style")).toContain("height: 32px");
  });

  it("applies width + height as inline styles when provided as strings", () => {
    render(<Skeleton width="50%" height="2rem" />);
    const el = screen.getByTestId("skeleton");
    expect(el.getAttribute("style")).toContain("width: 50%");
    expect(el.getAttribute("style")).toContain("height: 2rem");
  });

  it("variant='circle' uses rounded-full", () => {
    render(<Skeleton variant="circle" />);
    expect(screen.getByTestId("skeleton").className).toContain("rounded-full");
  });

  it("variant='text' uses rounded-sm", () => {
    render(<Skeleton variant="text" />);
    expect(screen.getByTestId("skeleton").className).toContain("rounded-sm");
  });

  it("variant='box' (default) uses rounded", () => {
    render(<Skeleton />);
    const el = screen.getByTestId("skeleton");
    // rounded but NOT rounded-full and NOT rounded-sm
    expect(el.className).toMatch(/(?:^|\s)rounded(?:\s|$)/);
    expect(el.className).not.toContain("rounded-full");
    expect(el.className).not.toContain("rounded-sm");
  });

  it("includes animate-pulse class for shimmer animation", () => {
    render(<Skeleton />);
    expect(screen.getByTestId("skeleton").className).toContain("animate-pulse");
  });

  it("merges custom className onto root", () => {
    render(<Skeleton className="my-extra" />);
    expect(screen.getByTestId("skeleton").className).toContain("my-extra");
  });

  it("matches snapshot for default props", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe("CardSkeleton", () => {
  it("renders with role=status and aria-busy", () => {
    render(<CardSkeleton />);
    const el = screen.getByTestId("card-skeleton");
    expect(el.getAttribute("role")).toBe("status");
    expect(el.getAttribute("aria-busy")).toBe("true");
  });

  it("includes the .card-base utility class for visual rhythm", () => {
    render(<CardSkeleton />);
    expect(screen.getByTestId("card-skeleton").className).toContain("card-base");
  });

  it("renders a title line and subtitle line", () => {
    render(<CardSkeleton />);
    expect(screen.getByTestId("card-skeleton-line-1")).toBeTruthy();
    expect(screen.getByTestId("card-skeleton-line-2")).toBeTruthy();
  });

  it("respects testId override on the wrapper and child lines", () => {
    render(<CardSkeleton testId="my-card" />);
    expect(screen.getByTestId("my-card")).toBeTruthy();
    expect(screen.getByTestId("my-card-line-1")).toBeTruthy();
    expect(screen.getByTestId("my-card-line-2")).toBeTruthy();
  });

  it("renders optional children above the placeholder lines", () => {
    render(
      <CardSkeleton>
        <span data-testid="card-extra">extra</span>
      </CardSkeleton>,
    );
    expect(screen.getByTestId("card-extra")).toBeTruthy();
  });

  it("matches snapshot for default props", () => {
    const { container } = render(<CardSkeleton />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe("RowSkeleton", () => {
  it("renders with role=status and aria-busy", () => {
    render(<RowSkeleton />);
    const el = screen.getByTestId("row-skeleton");
    expect(el.getAttribute("role")).toBe("status");
    expect(el.getAttribute("aria-busy")).toBe("true");
  });

  it("renders a single row by default", () => {
    render(<RowSkeleton />);
    expect(screen.getByTestId("row-skeleton-row-0")).toBeTruthy();
    // Row 1 should not exist with default rows=1
    expect(screen.queryByTestId("row-skeleton-row-1")).toBeNull();
  });

  it("renders the requested number of rows", () => {
    render(<RowSkeleton rows={3} />);
    expect(screen.getByTestId("row-skeleton-row-0")).toBeTruthy();
    expect(screen.getByTestId("row-skeleton-row-1")).toBeTruthy();
    expect(screen.getByTestId("row-skeleton-row-2")).toBeTruthy();
    expect(screen.queryByTestId("row-skeleton-row-3")).toBeNull();
  });

  it("clamps rows to a minimum of 1 when 0 / negative is passed", () => {
    render(<RowSkeleton rows={0} />);
    expect(screen.getByTestId("row-skeleton-row-0")).toBeTruthy();
  });

  it("each row has title + subtitle skeletons", () => {
    render(<RowSkeleton rows={2} />);
    expect(screen.getByTestId("row-skeleton-row-0-title")).toBeTruthy();
    expect(screen.getByTestId("row-skeleton-row-0-subtitle")).toBeTruthy();
    expect(screen.getByTestId("row-skeleton-row-1-title")).toBeTruthy();
    expect(screen.getByTestId("row-skeleton-row-1-subtitle")).toBeTruthy();
  });

  it("respects testId override", () => {
    render(<RowSkeleton testId="ledger-skel" rows={2} />);
    expect(screen.getByTestId("ledger-skel")).toBeTruthy();
    expect(screen.getByTestId("ledger-skel-row-0")).toBeTruthy();
    expect(screen.getByTestId("ledger-skel-row-1")).toBeTruthy();
  });

  it("matches snapshot for a 2-row variant", () => {
    const { container } = render(<RowSkeleton rows={2} />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
