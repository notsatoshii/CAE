"use client";

import { signIn } from "next-auth/react";
import { Github } from "lucide-react";

/**
 * GitHub sign-in button — polished for founder-first product feel.
 *
 * WCAG AA:
 *   - Text: #0a0a0a on --accent (#00d4ff) → ~10:1 contrast (exceeds 4.5:1)
 *   - Border: --accent on --surface → visible 3:1+ UI component contrast
 *   - Min touch target: py-3 + full width = ≥44px height (WCAG 2.5.8)
 *
 * T-13-11-01 (Spoofing): preserves NextAuth "github" provider call unchanged.
 */
export function GitHubSignInButton() {
  return (
    <button
      type="button"
      onClick={() => void signIn("github")}
      className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-3 text-[15px] font-semibold text-black transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface)]"
      data-testid="github-sign-in-button"
    >
      <Github className="size-5 shrink-0" aria-hidden="true" />
      Sign in with GitHub
    </button>
  );
}
