/**
 * Phase 8 Wave 3 (plan 08-04 Task 2) — SearchResults tests (4 cases).
 *
 * Cases:
 *   1. `q === ""` → renders null.
 *   2. `q === "foo"`, `hits = []` → renders "No matches for \"foo\"".
 *   3. Hits across two files → two file headers, clicking the first fires
 *      `onSelectFile` with that file path.
 *   4. A single file with 5 hits → only 3 rendered + "+2 more" text.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchResults } from "./search-results";
import type { SearchHit } from "@/lib/cae-memory-search";

describe("SearchResults", () => {
  it("renders nothing when q is empty", () => {
    const { container } = render(
      <SearchResults hits={[]} q="" onSelectFile={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders 'No matches for' when q is non-empty and hits is empty", () => {
    render(
      <SearchResults hits={[]} q="foo" onSelectFile={() => {}} />,
    );
    const el = screen.getByTestId("search-no-matches");
    expect(el.textContent).toContain("foo");
    expect(el.textContent?.toLowerCase()).toContain("no matches");
  });

  it("groups hits by file, shows both headers, and calls onSelectFile on header click", () => {
    const onSelectFile = vi.fn();
    const hits: SearchHit[] = [
      { file: "/proj/a.md", line: 1, preview: "alpha foo line" },
      { file: "/proj/a.md", line: 3, preview: "beta foo line" },
      { file: "/proj/b.md", line: 7, preview: "gamma foo line" },
    ];

    render(
      <SearchResults hits={hits} q="foo" onSelectFile={onSelectFile} />,
    );

    const headerA = screen.getByTestId("search-file-header-/proj/a.md");
    const headerB = screen.getByTestId("search-file-header-/proj/b.md");
    expect(headerA).toBeInTheDocument();
    expect(headerB).toBeInTheDocument();

    fireEvent.click(headerA);
    expect(onSelectFile).toHaveBeenCalledTimes(1);
    expect(onSelectFile).toHaveBeenCalledWith("/proj/a.md");
  });

  it("truncates a single file's hits to 3 and shows '+2 more'", () => {
    const hits: SearchHit[] = [
      { file: "/proj/big.md", line: 1, preview: "match foo 1" },
      { file: "/proj/big.md", line: 2, preview: "match foo 2" },
      { file: "/proj/big.md", line: 3, preview: "match foo 3" },
      { file: "/proj/big.md", line: 4, preview: "match foo 4" },
      { file: "/proj/big.md", line: 5, preview: "match foo 5" },
    ];

    const { container } = render(
      <SearchResults hits={hits} q="foo" onSelectFile={() => {}} />,
    );

    // Normalize: textContent concatenates across split <mark> nodes.
    const body = container.textContent ?? "";

    // First 3 hit previews visible (each split across text + <mark>, so we
    // check the flattened textContent contains them).
    expect(body).toContain("match foo 1");
    expect(body).toContain("match foo 2");
    expect(body).toContain("match foo 3");

    // "+2 more" text rendered (count of trailing truncated hits).
    const moreEl = screen.getByTestId("search-more-/proj/big.md");
    expect(moreEl.textContent).toContain("+2 more");

    // 4th & 5th hit NOT rendered.
    expect(body).not.toContain("match foo 4");
    expect(body).not.toContain("match foo 5");
  });
});
