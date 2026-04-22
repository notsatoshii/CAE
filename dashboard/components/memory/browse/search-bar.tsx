"use client";

/**
 * Phase 8 Wave 3 (plan 08-04) — SearchBar (Task 1 stub, filled in Task 2).
 *
 * TODO(08-04 task 2): wire search state — replace this stub with a fully
 * controlled input + 300ms debounce + `/api/memory/search` fetch + 200-char
 * maxLength + loading pulse + explain tooltip.
 */

import type { SearchHit } from "@/lib/cae-memory-search";

export interface SearchBarProps {
  onResults: (hits: SearchHit[], q: string) => void;
  onQueryChange?: (q: string) => void;
}

export function SearchBar(_props: SearchBarProps) {
  return null;
}
