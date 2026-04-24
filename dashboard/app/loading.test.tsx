/**
 * Root app/loading.tsx tests — arrow-key Pikachu port.
 *
 * Contract:
 *   - renders with role=status + aria-busy + aria-live
 *   - shows the pikachu gif + "Running Pikachu" heading + "Loading..." text
 *   - right-arrow keydown moves pikachu +25px, left-arrow moves -25px
 *   - no console errors on render
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import RootLoading from "./loading";

describe("RootLoading — arrow-key pikachu", () => {
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

  it("shows pikachu gif + heading + brand subtitle", () => {
    render(<RootLoading />);
    const img = screen.getByAltText("loading") as HTMLImageElement;
    expect(img.src).toContain("pikachu-loading.gif");
    expect(screen.getByText("Loading...")).toBeTruthy();
    expect(screen.getByText("CTRL + ALT + ELITE")).toBeTruthy();
  });

  it("right arrow translates pikachu by +25px", () => {
    const { container } = render(<RootLoading />);
    const pikachu = container.querySelector("#pikachu") as HTMLElement;
    expect(pikachu.style.transform).toBe("translateX(0px)");
    act(() => {
      fireEvent.keyDown(document, { keyCode: 39 });
    });
    expect(pikachu.style.transform).toBe("translateX(25px)");
    act(() => {
      fireEvent.keyDown(document, { keyCode: 39 });
    });
    expect(pikachu.style.transform).toBe("translateX(50px)");
  });

  it("left arrow translates pikachu by -25px", () => {
    const { container } = render(<RootLoading />);
    const pikachu = container.querySelector("#pikachu") as HTMLElement;
    act(() => {
      fireEvent.keyDown(document, { keyCode: 37 });
    });
    expect(pikachu.style.transform).toBe("translateX(-25px)");
  });

  it("ignores non-arrow keys", () => {
    const { container } = render(<RootLoading />);
    const pikachu = container.querySelector("#pikachu") as HTMLElement;
    act(() => {
      fireEvent.keyDown(document, { keyCode: 32 }); // space
      fireEvent.keyDown(document, { keyCode: 13 }); // enter
    });
    expect(pikachu.style.transform).toBe("translateX(0px)");
  });

  it("logs no console errors", () => {
    render(<RootLoading />);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
