"use client";

/**
 * RotatingVoice — client island for the root app/loading.tsx shell loader.
 *
 * Why this exists: the root loader renders during SSR + the Suspense fallback
 * window, so picking a random voice variant at module load would cause a
 * hydration mismatch (server string A, client string B). Instead, we render
 * an empty string for the first paint (SSR + pre-hydrate) and let the client
 * pick a random variant inside `useEffect`, then swap it in on the first
 * post-mount render.
 *
 * Keeping this in /components/loading/ (not inline in app/loading.tsx) lets
 * app/loading.tsx stay a server component — which matters because Next 16
 * runs app/loading.tsx as the global Suspense fallback and server components
 * mount faster (no "use client" boundary cost during the critical first paint).
 *
 * Props:
 *   - variants: the candidate copy pool (passed in explicitly so the server
 *     chooses the list, never the variant — the test-harness and the storage
 *     event semantics stay stable).
 *   - className / testId: forwarded.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface RotatingVoiceProps {
  variants: readonly string[];
  className?: string;
  testId?: string;
}

export function RotatingVoice({
  variants,
  className,
  testId = "loading-voice",
}: RotatingVoiceProps) {
  // Initial render = empty (server + first client paint) so hydration matches.
  // After mount we pick one variant at random.
  const [text, setText] = useState<string>("");

  useEffect(() => {
    if (variants.length === 0) return;
    const idx = Math.floor(Math.random() * variants.length);
    setText(variants[idx] ?? "");
  }, [variants]);

  return (
    <p
      data-testid={testId}
      aria-live="polite"
      className={cn(
        "text-sm text-[color:var(--text-muted)] tabular-nums",
        // Reserve the line height even when the string is empty so the layout
        // doesn't jump when the client swaps in the real variant post-mount.
        "min-h-[1.25rem]",
        className,
      )}
    >
      {text}
    </p>
  );
}

export default RotatingVoice;
