/**
 * Root app/loading.tsx tests.
 *
 * Contract:
 *   - renders with role=status + aria-busy
 *   - renders the brand mark + waveform dots + voice island
 *   - no console errors on render
 *   - voice variants are drawn from the FOUNDER.loading.appBoot list
 *     (asserts via the children of the voice island after effect)
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { LABELS } from "@/lib/copy/labels";

import RootLoading from "./loading";

describe("RootLoading — app/loading.tsx", () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  it("renders the root-loading page with role=status + aria-busy", () => {
    render(<RootLoading />);
    const root = screen.getByTestId("root-loading");
    expect(root.getAttribute("role")).toBe("status");
    expect(root.getAttribute("aria-busy")).toBe("true");
    expect(root.getAttribute("aria-live")).toBe("polite");
  });

  it("renders the brand-mark SVG", () => {
    const { container } = render(<RootLoading />);
    const mark = screen.getByTestId("root-loading-mark");
    expect(mark).toBeTruthy();
    const svg = container.querySelector("[data-testid='root-loading-mark'] svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders the 3-dot waveform", () => {
    render(<RootLoading />);
    const dots = screen.getByTestId("root-loading-dots");
    expect(dots).toBeTruthy();
    // 3 spans inside, each with the .cae-loader-pulse-dot class.
    const spans = dots.querySelectorAll("span.cae-loader-pulse-dot");
    expect(spans.length).toBe(3);
  });

  it("renders the voice island (empty on first paint, variant swapped after effect)", async () => {
    // act() flushes effects — the RotatingVoice effect picks a variant and
    // setState's it. Post-act, the text should be non-empty.
    await act(async () => {
      render(<RootLoading />);
    });
    const voice = screen.getByTestId("root-loading-voice");
    expect(voice).toBeTruthy();
    // Voice should be one of the FOUNDER appBoot variants after effect runs.
    const variants = LABELS.FOUNDER.loading.appBoot as readonly string[];
    const text = voice.textContent ?? "";
    // Non-empty + is in the variant list.
    expect(text.length).toBeGreaterThan(0);
    expect(variants).toContain(text);
  });

  it("voice text is a member of the appBoot variant pool", async () => {
    await act(async () => {
      render(<RootLoading />);
    });
    const voice = screen.getByTestId("root-loading-voice");
    const variants = LABELS.FOUNDER.loading.appBoot as readonly string[];
    expect(variants).toContain(voice.textContent);
  });

  it("logs no console errors during render", async () => {
    await act(async () => {
      render(<RootLoading />);
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
