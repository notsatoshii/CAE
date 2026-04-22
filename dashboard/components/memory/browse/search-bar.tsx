"use client";

/**
 * Phase 8 Wave 3 (plan 08-04 Task 2) — SearchBar.
 *
 * Controlled debounced search input for the Browse tab. Wires to
 * `/api/memory/search` (D-11 ripgrep wrapper — see `lib/cae-memory-search.ts`).
 *
 * Behaviour:
 *   - Controlled `<input>` owning its own value state.
 *   - Max length 200 chars, matched server-side and enforced here via
 *     `maxLength` to avoid wasted round-trips.
 *   - 300ms debounce via `useEffect` + `setTimeout` cleanup — no lodash,
 *     no external debounce dep (plan 08-04 Task 2.E).
 *   - Empty / whitespace-only query fires `onResults([], "")` immediately
 *     so the SearchResults panel hides.
 *   - Loading indicator: a small pulsing dot visible while the fetch is
 *     in flight. Clears on resolve.
 *   - Explain tooltip pinned to the right of the input using the shared
 *     `ExplainTooltip` primitive (copy from `memoryExplainSearch`).
 *   - Never autofocuses — user decides when to search.
 */

import { useEffect, useRef, useState } from "react";
import type { SearchHit } from "@/lib/cae-memory-search";
import { ExplainTooltip } from "@/components/ui/explain-tooltip";
import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";

const DEBOUNCE_MS = 300;
const MAX_QUERY_LEN = 200;

export interface SearchBarProps {
  onResults: (hits: SearchHit[], q: string) => void;
  onQueryChange?: (q: string) => void;
}

export function SearchBar({ onResults, onQueryChange }: SearchBarProps) {
  const { dev } = useDevMode();
  const labels = labelFor(dev);
  const [value, setValue] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  // Track the most-recent query so late-resolving fetches can be dropped.
  const latestQRef = useRef<string>("");

  useEffect(() => {
    const trimmed = value.trim();
    latestQRef.current = trimmed;
    if (trimmed.length === 0) {
      setLoading(false);
      onResults([], "");
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/memory/search?q=${encodeURIComponent(trimmed)}`,
          { cache: "no-store" },
        );
        if (cancelled || latestQRef.current !== trimmed) return;
        if (!res.ok) {
          onResults([], trimmed);
          return;
        }
        const data = (await res.json()) as { q: string; hits: SearchHit[] };
        if (cancelled || latestQRef.current !== trimmed) return;
        onResults(data.hits ?? [], trimmed);
      } catch {
        if (!cancelled) onResults([], trimmed);
      } finally {
        if (!cancelled && latestQRef.current === trimmed) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, onResults]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <input
          type="text"
          value={value}
          maxLength={MAX_QUERY_LEN}
          placeholder={labels.memorySearchPlaceholder}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            onQueryChange?.(next);
          }}
          className="w-full rounded-sm border border-[color:var(--border)] bg-[color:var(--bg)] px-2 py-1.5 pr-6 font-mono text-[12px] text-[color:var(--text)] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent)] focus:outline-none"
          data-testid="search-input"
        />
        {loading && (
          <span
            className="pointer-events-none absolute right-2 top-1/2 inline-block size-2 -translate-y-1/2 animate-pulse rounded-full bg-[color:var(--accent)]"
            data-testid="search-loading"
            aria-hidden="true"
          />
        )}
      </div>
      <ExplainTooltip
        text={labels.memoryExplainSearch}
        ariaLabel="Explain memory search"
      />
    </div>
  );
}
