"use client";

/**
 * ChatRail — the persistent right-rail shell. Phase 9 Plan 05 Task 2 (CHT-01).
 *
 * Collapsed: 48px wide, icon + unread dot + last-preview teaser. Click to expand.
 * Expanded: 300px wide, header (current-agent label, pop-out link, close button)
 *           + ChatPanel body.
 *
 * Hidden:
 *   - on /chat (D-16 — full-page chat surface replaces the rail there),
 *   - when !sessionAuthed (gotcha #10 — no provider state means unauth; the
 *     provider itself exposes a no-op default context in that case).
 *
 * No base-ui polymorphic render prop (gotcha #5); we use className +
 * Link/button directly. Positioned `fixed top-10 right-0 bottom-0 z-40`
 * so it sits below
 * the top-nav (h-10) and overlays page content without shifting layout.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChatRail } from "@/lib/providers/chat-rail";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { ChatPanel } from "./chat-panel";

export function ChatRail() {
  const rail = useChatRail();
  const { dev } = useDevMode();
  const t = labelFor(dev);
  const pathname = usePathname() ?? "/";

  if (!rail.sessionAuthed) return null;
  if (pathname === "/chat") return null;

  // C2-wave/Class 3: lightweight liveness marker — rail is healthy iff
  // authed + either has unread or an idle placeholder preview; empty
  // when no preview and no unread.
  const railLiveness: "empty" | "healthy" =
    rail.unread === 0 && !rail.lastMessagePreview ? "empty" : "healthy";

  if (!rail.open) {
    return (
      <aside
        data-testid="chat-rail"
        data-liveness={railLiveness}
        role="complementary"
        aria-label={t.chatRailCollapsedAria}
        onClick={rail.expand}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            rail.expand();
          }
        }}
        tabIndex={0}
        className="fixed top-10 right-0 bottom-0 w-12 z-40 bg-[color:var(--surface,#121214)] border-l border-[color:var(--border,#1f1f22)] flex flex-col items-center py-3 gap-3 cursor-pointer hover:bg-[color:var(--surface-hover,#1a1a1d)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[color:var(--accent,#00d4ff)]"
      >
        <span className="sr-only" data-truth={`chat-rail.${railLiveness}`}>yes</span>
        <span
          aria-hidden
          title={t.chatRailExpandAria}
          className="text-lg leading-none"
        >
          💬
        </span>
        {rail.unread > 0 ? (
          <span
            data-testid="chat-rail-unread"
            aria-label={t.chatUnreadAria(rail.unread)}
            className="min-w-4 h-4 px-1 rounded-full bg-[color:var(--accent,#00d4ff)] text-[10px] text-black flex items-center justify-center font-semibold"
          >
            {rail.unread > 9 ? "9+" : rail.unread}
          </span>
        ) : null}
        {rail.lastMessagePreview ? (
          <span
            aria-hidden
            className="text-[10px] text-[color:var(--text-muted,#8a8a8c)] line-clamp-2 text-center px-1"
          >
            {rail.lastMessagePreview}
          </span>
        ) : null}
        <span aria-hidden className="flex-1" />
      </aside>
    );
  }

  return (
    <aside
      data-testid="chat-rail"
      data-liveness={railLiveness}
      role="complementary"
      aria-label={t.chatRailExpandedTitle}
      className="fixed top-10 right-0 bottom-0 w-[300px] z-40 bg-[color:var(--surface,#121214)] border-l border-[color:var(--border,#1f1f22)] flex flex-col"
    >
      <span className="sr-only" data-truth={`chat-rail.${railLiveness}`}>yes</span>
      <header className="flex items-center justify-between px-3 py-2 border-b border-[color:var(--border,#1f1f22)] shrink-0">
        <span className="text-sm font-medium text-[color:var(--text,#e5e5e5)]">
          {t.chatRailExpandedTitle}
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            aria-label={t.chatRailExpandedTitle}
            className="text-xs text-[color:var(--text-muted,#8a8a8c)] hover:text-[color:var(--text,#e5e5e5)]"
          >
            ↗
          </Link>
          <button
            type="button"
            onClick={rail.collapse}
            aria-label={t.chatRailCollapseAria}
            className="text-[color:var(--text-muted,#8a8a8c)] hover:text-[color:var(--text,#e5e5e5)]"
          >
            ✕
          </button>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        <ChatPanel />
      </div>
    </aside>
  );
}
