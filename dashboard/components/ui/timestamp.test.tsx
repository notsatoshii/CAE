/**
 * Tests for components/ui/timestamp.tsx — shared Timestamp primitive.
 *
 * Per Eric's session-13 rule:
 *   - Render relative (e.g. "3h ago") but NEVER fuzzy ("today" / "yesterday").
 *   - Always expose the absolute ISO on the `title` attribute for hover.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Timestamp, formatRelative } from "./timestamp";

describe("Timestamp", () => {
  it("renders em-dash when iso is null", () => {
    render(<Timestamp iso={null} />);
    expect(screen.getByTestId("timestamp-empty").textContent).toBe("—");
  });

  it("renders em-dash when iso is undefined", () => {
    render(<Timestamp iso={undefined} />);
    expect(screen.getByTestId("timestamp-empty").textContent).toBe("—");
  });

  it("renders em-dash for an invalid ISO string", () => {
    render(<Timestamp iso="not-a-date" />);
    expect(screen.getByTestId("timestamp-invalid").textContent).toBe("—");
  });

  it("renders a relative string and absolute ISO on title", () => {
    const now = new Date("2026-04-24T12:00:00Z").getTime();
    const iso = "2026-04-24T09:00:00Z"; // 3h earlier
    render(<Timestamp iso={iso} now={now} />);
    const el = screen.getByTestId("timestamp");
    expect(el.textContent).toBe("3h ago");
    expect(el.getAttribute("title")).toBe(iso);
    expect(el.getAttribute("datetime")).toBe(iso);
  });

  it("supports a prefix", () => {
    const now = new Date("2026-04-24T12:00:00Z").getTime();
    const iso = "2026-04-24T11:30:00Z"; // 30m earlier
    render(<Timestamp iso={iso} now={now} prefix="updated " />);
    const el = screen.getByTestId("timestamp");
    expect(el.textContent).toBe("updated 30m ago");
  });

  it("forwards className to the root time element", () => {
    const now = new Date("2026-04-24T12:00:00Z").getTime();
    const iso = "2026-04-24T11:59:00Z";
    const { container } = render(
      <Timestamp iso={iso} now={now} className="my-chip" />
    );
    expect(container.querySelector(".my-chip")).toBeTruthy();
  });
});

describe("formatRelative", () => {
  const NOW = new Date("2026-04-24T12:00:00Z").getTime();

  it("<60s → Ns ago", () => {
    expect(formatRelative(NOW - 10_000, NOW)).toBe("10s ago");
  });
  it("<60m → Nm ago", () => {
    expect(formatRelative(NOW - 5 * 60_000, NOW)).toBe("5m ago");
  });
  it("<24h → Nh ago", () => {
    expect(formatRelative(NOW - 3 * 3_600_000, NOW)).toBe("3h ago");
  });
  it("<30d → Nd ago", () => {
    expect(formatRelative(NOW - 7 * 86_400_000, NOW)).toBe("7d ago");
  });
  it("<365d → Nmo ago", () => {
    expect(formatRelative(NOW - 45 * 86_400_000, NOW)).toBe("1mo ago");
  });
  it(">=365d → Ny ago", () => {
    expect(formatRelative(NOW - 400 * 86_400_000, NOW)).toBe("1y ago");
  });
  it("future timestamps fall back to 'just now'", () => {
    expect(formatRelative(NOW + 5_000, NOW)).toBe("just now");
  });
});
