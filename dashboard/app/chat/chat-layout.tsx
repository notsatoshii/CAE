"use client";

/**
 * ChatLayout — full-page 50/50 split view for /chat. CHT-04, D-16 (Wave 4, Plan 09-07).
 *
 * Left pane: ChatMirror (read-only surface picker).
 * Right pane: ChatPanel standalone (max-width 800px centered — D-16).
 *
 * Height: 100vh minus the 40px top-nav.
 * Each pane has its own scroll container; no overflow at the page level.
 *
 * Dev-mode note (gotcha #8): useDevMode() flips copy (e.g. aria-labels) only,
 * NOT voice routing. The right pane talks to the same /api/chat/* routes.
 *
 * ChatRail is hidden on /chat — the rail provider checks usePathname() === "/chat"
 * (already enforced in Wave 2, 09-05). This plan audits that fact via verify greps.
 *
 * Hydration (Class 9 fix): dev-mode is hydrated client-only (localStorage) by the
 * DevModeProvider, so `useDevMode()` returns `false` on SSR and may flip to `true`
 * post-mount. The page shell (`app/chat/page.tsx`) reads the `devMode` cookie via
 * next/headers `cookies()` and passes it as `initialDev`. SSR and the first
 * client render both use `initialDev`; once mounted we switch to the live context
 * value so in-session ⌘Shift+D toggles still flip copy without a reload.
 */

import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ChatMirror, type MirrorSurface } from "@/components/chat/chat-mirror";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";

type ChatLayoutProps = {
  /**
   * Server-read dev-mode, from the `devMode` cookie via `cookies()`. Defaults
   * to `false` (founder-speak) when the cookie is absent. Used for SSR + the
   * first client render so aria-labels match and React does not warn about a
   * hydration mismatch. Post-mount, the component switches to the live
   * `useDevMode()` value to respect in-session toggles.
   */
  initialDev?: boolean;
};

export function ChatLayout({ initialDev = false }: ChatLayoutProps = {}) {
  const { dev } = useDevMode();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const effectiveDev = mounted ? dev : initialDev;
  const t = labelFor(effectiveDev);
  const [surface, setSurface] = useState<MirrorSurface>("home");

  return (
    <div
      data-testid="chat-layout"
      className="flex h-[calc(100vh-40px)] w-full overflow-hidden"
    >
      <span className="sr-only" data-truth="chat.healthy">yes</span>
      <span className="sr-only" data-truth="chat.surface">{surface}</span>
      <span className="sr-only" data-truth="chat.layout">split</span>
      <span className="sr-only" data-truth="chat.standalone">true</span>
      {/* Left pane: read-only mirror of the selected Build surface */}
      <section
        aria-label="Mirror of the Build surface"
        className="flex-1 min-w-0 overflow-auto border-r border-[color:var(--border,#1f1f22)]"
      >
        <ChatMirror surface={surface} onSurfaceChange={setSurface} />
      </section>

      {/* Right pane: full chat panel, centered at max-w-800px (D-16) */}
      <section
        aria-label={t.chatRailExpandedTitle}
        className="w-1/2 min-w-0 overflow-hidden border-l border-[color:var(--border,#1f1f22)]"
      >
        <ChatPanel standalone />
      </section>
    </div>
  );
}
