/**
 * Phase 8 Wave 3 (MEM-08, D-06): RegenerateButton tests.
 *
 * Run via `pnpm test -- components/memory/graph/regenerate-button.test.tsx`.
 *
 * Assertions:
 *   1. Initial render: enabled, label = memoryBtnRegenerate.
 *   2. During fetch: disabled + label = memoryBtnRegeneratePending.
 *   3. 429 response: cooldown kicks in using server's retry_after_ms.
 *   4. 200 response: onRegenerated callback invoked + cooldown starts.
 *
 * Fetch is stubbed per-test via `vi.spyOn(globalThis, "fetch")` (matches
 * the D-13 injection pattern documented in 08-03-SUMMARY tech-stack).
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { DevModeProvider } from "@/lib/providers/dev-mode";
import { ExplainModeProvider } from "@/lib/providers/explain-mode";
import { RegenerateButton } from "./regenerate-button";

function renderBtn(onRegenerated?: () => void, generatedAt?: string) {
  return render(
    <ExplainModeProvider>
      <DevModeProvider>
        <RegenerateButton
          onRegenerated={onRegenerated}
          generatedAt={generatedAt}
        />
      </DevModeProvider>
    </ExplainModeProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("RegenerateButton", () => {
  it("renders enabled with the regenerate label on mount", () => {
    renderBtn();
    const btn = screen.getByTestId("memory-regenerate-button");
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveAttribute("data-pending", "false");
    expect(btn).toHaveAttribute("data-cooldown", "false");
    expect(btn.textContent ?? "").toContain("Regenerate");
  });

  it("becomes disabled + shows pending copy while the fetch is in flight", async () => {
    // Hang the fetch so we can observe the pending state mid-flight.
    let resolveFetch: (r: Response) => void = () => {};
    const pendingPromise = new Promise<Response>((res) => {
      resolveFetch = res;
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => pendingPromise,
    );

    renderBtn();
    const btn = screen.getByTestId("memory-regenerate-button");
    fireEvent.click(btn);

    // Mid-flight assertions.
    await waitFor(() => {
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("data-pending", "true");
    });
    expect(btn.textContent ?? "").toMatch(/regenerat/i);

    // Resolve to clean up (pending -> successful 200, cooldown follows).
    await act(async () => {
      resolveFetch(
        new Response(JSON.stringify({ ok: true, duration_ms: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      await pendingPromise.catch(() => {});
    });
  });

  it("enters cooldown using server retry_after_ms on 429", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "cooldown", retry_after_ms: 30_000 }), {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
    );

    renderBtn();
    const btn = screen.getByTestId("memory-regenerate-button");

    await act(async () => {
      fireEvent.click(btn);
    });

    await waitFor(() => {
      expect(btn).toHaveAttribute("data-cooldown", "true");
    });
    expect(btn).toBeDisabled();
    // Label should mention the second countdown — any non-zero seconds is fine.
    expect(btn.textContent ?? "").toMatch(/\d+\s*s/);
  });

  it("invokes onRegenerated + starts cooldown after a 200 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, duration_ms: 12, total_nodes: 5 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const onRegenerated = vi.fn();
    renderBtn(onRegenerated);
    const btn = screen.getByTestId("memory-regenerate-button");

    await act(async () => {
      fireEvent.click(btn);
    });

    await waitFor(() => {
      expect(onRegenerated).toHaveBeenCalledTimes(1);
      expect(btn).toHaveAttribute("data-cooldown", "true");
    });
    expect(btn).toBeDisabled();
  });
});
