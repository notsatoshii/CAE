/**
 * Root app/loading.tsx tests — Pikachu loader port.
 *
 * Contract:
 *   - renders with role=status + aria-busy
 *   - shows the pikachu GIF + "Loading..." text
 *   - mousemove updates cursor-follower position
 *   - click spawns trail clones
 *   - no console errors on render
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import RootLoading from "./loading";

describe("RootLoading — pikachu port", () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  it("renders with role=status + aria-busy + aria-live", () => {
    render(<RootLoading />);
    const root = screen.getByTestId("root-loading");
    expect(root.getAttribute("role")).toBe("status");
    expect(root.getAttribute("aria-busy")).toBe("true");
    expect(root.getAttribute("aria-live")).toBe("polite");
  });

  it("shows the pikachu gif + Loading text", () => {
    render(<RootLoading />);
    const img = screen.getByAltText("Loading") as HTMLImageElement;
    expect(img.src).toContain("pikachu-loading.gif");
    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("cursor-follower appears on mousemove inside loader, hides on leave", () => {
    const { container } = render(<RootLoading />);
    const loader = screen.getByTestId("root-loading");
    // Not visible until mouse enters.
    expect(container.querySelectorAll(".cae-pikachu-mouse").length).toBe(0);
    act(() => {
      fireEvent.mouseMove(loader, { clientX: 50, clientY: 60 });
    });
    expect(container.querySelectorAll(".cae-pikachu-mouse").length).toBe(1);
    act(() => {
      fireEvent.mouseLeave(loader);
    });
    expect(container.querySelectorAll(".cae-pikachu-mouse").length).toBe(0);
  });

  it("click inside loader spawns a trail clone", () => {
    const { container } = render(<RootLoading />);
    const loader = screen.getByTestId("root-loading");
    act(() => {
      fireEvent.mouseMove(loader, { clientX: 50, clientY: 60 });
    });
    const before = container.querySelectorAll(".cae-pikachu-mouse").length;
    act(() => {
      fireEvent.click(loader, { clientX: 100, clientY: 100 });
    });
    const after = container.querySelectorAll(".cae-pikachu-mouse").length;
    expect(after).toBe(before + 1);
  });

  it("logs no console errors", () => {
    render(<RootLoading />);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
