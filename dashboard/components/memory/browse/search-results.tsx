"use client";

/**
 * Phase 8 Wave 3 (plan 08-04) — SearchResults (Task 1 stub, filled in Task 2).
 *
 * TODO(08-04 task 2): wire search state — replace this stub with grouped-
 * by-file rg hit display, 3-hit truncation, cyan match highlighting, and
 * click-to-select file wiring.
 */

import type { SearchHit } from "@/lib/cae-memory-search";

export interface SearchResultsProps {
  hits: SearchHit[];
  q: string;
  onSelectFile: (absPath: string) => void;
}

export function SearchResults(_props: SearchResultsProps) {
  return null;
}
