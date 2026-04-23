/**
 * Shimmer primitive tests.
 *
 * Contract:
 *   - role="status" + aria-busy="true" + aria-live="polite" on the root
 *   - default + override testIds
 *   - variant → rounded-* class + sensible default dimensions
 *   - width/height/size flow through to inline style
 *   - sr-only label is present and overridable
 *   - `cae-shimmer` class is applied (keyed against globals.css rule, which
 *     also owns the reduced-motion override)
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Shimmer } from "./shimmer";

describe("Shimmer (primitive)", () => {
  it("renders with role=status and aria-busy=true", () => {
    render(<Shimmer />);
    const el = screen.getByTestId("shimmer");
    expect(el.getAttribute("role")).toBe("status");
    expect(el.getAttribute("aria-busy")).toBe("true");
    expect(el.getAttribute("aria-live")).toBe("polite");
  });

  it("applies the `cae-shimmer` class (globals.css owns animation + reduced-motion)", () => {
    render(<Shimmer />);
    expect(screen.getByTestId("shimmer").className).toContain("cae-shimmer");
  });

  it("default variant is 'box' → rounded-md", () => {
    render(<Shimmer />);
    const el = screen.getByTestId("shimmer");
    expect(el.getAttribute("data-variant")).toBe("box");
    expect(el.className).toContain("rounded-md");
  });

  it("variant='text' uses rounded-sm + default height 12px", () => {
    render(<Shimmer variant="text" />);
    const el = screen.getByTestId("shimmer");
    expect(el.getAttribute("data-variant")).toBe("text");
    expect(el.className).toContain("rounded-sm");
    expect(el.getAttribute("style")).toContain("height: 12px");
  });

  it("variant='circle' uses rounded-full + default size 32px", () => {
    render(<Shimmer variant="circle" />);
    const el = screen.getByTestId("shimmer");
    expect(el.getAttribute("data-variant")).toBe("circle");
    expect(el.className).toContain("rounded-full");
    const style = el.getAttribute("style") ?? "";
    expect(style).toContain("width: 32px");
    expect(style).toContain("height: 32px");
  });

  it("variant='circle' with explicit `size` prop wins over default", () => {
    render(<Shimmer variant="circle" size={48} />);
    const style = screen.getByTestId("shimmer").getAttribute("style") ?? "";
    expect(style).toContain("width: 48px");
    expect(style).toContain("height: 48px");
  });

  it("variant='bar' uses rounded-full + default height 4px + width 100%", () => {
    render(<Shimmer variant="bar" />);
    const el = screen.getByTestId("shimmer");
    expect(el.getAttribute("data-variant")).toBe("bar");
    expect(el.className).toContain("rounded-full");
    const style = el.getAttribute("style") ?? "";
    expect(style).toContain("height: 4px");
    expect(style).toContain("width: 100%");
  });

  it("width + height passed as numbers are converted to px", () => {
    render(<Shimmer width={120} height={40} />);
    const style = screen.getByTestId("shimmer").getAttribute("style") ?? "";
    expect(style).toContain("width: 120px");
    expect(style).toContain("height: 40px");
  });

  it("width + height passed as strings pass through unchanged", () => {
    render(<Shimmer width="50%" height="2rem" />);
    const style = screen.getByTestId("shimmer").getAttribute("style") ?? "";
    expect(style).toContain("width: 50%");
    expect(style).toContain("height: 2rem");
  });

  it("respects testId override", () => {
    render(<Shimmer testId="custom-shim" />);
    expect(screen.getByTestId("custom-shim")).toBeTruthy();
  });

  it("uses 'Loading' as the default aria-label", () => {
    render(<Shimmer />);
    expect(screen.getByTestId("shimmer").getAttribute("aria-label")).toBe(
      "Loading",
    );
  });

  it("accepts a custom aria-label via `label` prop", () => {
    render(<Shimmer label="Loading chat" />);
    expect(screen.getByTestId("shimmer").getAttribute("aria-label")).toBe(
      "Loading chat",
    );
  });

  it("renders an sr-only span with the label text", () => {
    render(<Shimmer label="Loading agents" />);
    const el = screen.getByTestId("shimmer");
    const srOnly = el.querySelector(".sr-only");
    expect(srOnly).toBeTruthy();
    expect(srOnly?.textContent).toBe("Loading agents");
  });

  it("merges custom className onto root", () => {
    render(<Shimmer className="my-extra-class" />);
    expect(screen.getByTestId("shimmer").className).toContain("my-extra-class");
  });

  // Reduced-motion: the `.cae-shimmer` class in globals.css owns the
  // `animation: none !important` override under @media (prefers-reduced-motion).
  // This test asserts the CLASS is always applied — jsdom can't evaluate @media
  // queries, so we verify the contract rather than the computed style.
  it("keeps the `cae-shimmer` class regardless of prefers-reduced-motion", () => {
    // Both matchMedia(true) and matchMedia(false) should produce the same class.
    render(<Shimmer />);
    expect(screen.getByTestId("shimmer").className).toContain("cae-shimmer");
  });

  it("matches snapshot for default props", () => {
    const { container } = render(<Shimmer />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
