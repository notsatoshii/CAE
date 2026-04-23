/**
 * StatusPill primitive tests — Phase 15 Wave 2.9.
 *
 * Asserts each of the 7 variants:
 *   - default label rendered when `label` prop omitted
 *   - data-variant attribute mirrors the variant prop
 *   - inline style references the right semantic CSS var
 *   - testId override applied to root + child label / dot
 *   - snapshots locked per variant so future drift is loud
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusPill, type StatusPillVariant } from "./status-pill";

const VARIANTS: ReadonlyArray<{
  variant: StatusPillVariant;
  defaultLabel: string;
  colourVar: string;
}> = [
  { variant: "idle",    defaultLabel: "Idle",    colourVar: "--text-dim"   },
  { variant: "running", defaultLabel: "Running", colourVar: "--accent"     },
  { variant: "waiting", defaultLabel: "Waiting", colourVar: "--warning"    },
  { variant: "done",    defaultLabel: "Done",    colourVar: "--success"    },
  { variant: "failed",  defaultLabel: "Failed",  colourVar: "--danger"     },
  { variant: "warning", defaultLabel: "Warning", colourVar: "--warning"    },
  { variant: "offline", defaultLabel: "Offline", colourVar: "--text-muted" },
];

describe("StatusPill", () => {
  for (const { variant, defaultLabel, colourVar } of VARIANTS) {
    it(`variant='${variant}' renders default label '${defaultLabel}'`, () => {
      render(<StatusPill variant={variant} />);
      expect(screen.getByTestId("status-pill-label").textContent).toBe(
        defaultLabel,
      );
    });

    it(`variant='${variant}' sets data-variant='${variant}'`, () => {
      render(<StatusPill variant={variant} />);
      expect(
        screen.getByTestId("status-pill").getAttribute("data-variant"),
      ).toBe(variant);
    });

    it(`variant='${variant}' colour style references var(${colourVar})`, () => {
      render(<StatusPill variant={variant} />);
      const style = screen.getByTestId("status-pill").getAttribute("style") ?? "";
      expect(style).toContain(colourVar);
    });

    it(`variant='${variant}' matches snapshot`, () => {
      const { container } = render(<StatusPill variant={variant} />);
      expect(container.firstChild).toMatchSnapshot();
    });
  }

  it("renders the custom label when `label` prop is provided", () => {
    render(<StatusPill variant="running" label="Live" />);
    expect(screen.getByTestId("status-pill-label").textContent).toBe("Live");
  });

  it("respects testId override on root + dot + label", () => {
    render(<StatusPill variant="done" testId="my-pill" />);
    expect(screen.getByTestId("my-pill")).toBeTruthy();
    expect(screen.getByTestId("my-pill-dot")).toBeTruthy();
    expect(screen.getByTestId("my-pill-label")).toBeTruthy();
  });

  it("merges custom className onto the root", () => {
    render(<StatusPill variant="idle" className="extra-cls" />);
    expect(screen.getByTestId("status-pill").className).toContain("extra-cls");
  });

  it("dot icon has aria-hidden=true", () => {
    render(<StatusPill variant="running" />);
    expect(
      screen.getByTestId("status-pill-dot").getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("renders an SVG circle as the dot", () => {
    const { container } = render(<StatusPill variant="running" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
