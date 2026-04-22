/**
 * ChatRailProvider + useChatRail tests — Phase 9 Plan 05 Task 1.
 *
 * Covers:
 *   - Initial state (open=false, unread=0, sessionId=null, streaming=false, lastSeenMsgId=null)
 *   - expand() → open=true + unread=0 (auto-marks read)
 *   - collapse() → open=false + records lastUserCollapseTs
 *   - toggle() flips open; opening clears unread
 *   - bumpUnread() increments when closed, no-op when open
 *   - bumpUnread({autoExpand:true}) auto-expands UNLESS within 500ms debounce (gotcha #13)
 *   - setLastSeenMsgId(id) persists; markAllRead() sets unread=0
 *   - setCurrentSession(id) updates currentSessionId
 *   - session=null → no-op defaults (sessionAuthed=false) — children render, all actions no-op (gotcha #10)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ChatRailProvider, useChatRail } from "./chat-rail";

function wrapAuthed({ children }: { children: ReactNode }) {
  // Sentinel object stands in for a NextAuth Session — provider only checks truthiness.
  return <ChatRailProvider session={{ user: { email: "test@test" } }}>{children}</ChatRailProvider>;
}

function wrapUnauthed({ children }: { children: ReactNode }) {
  return <ChatRailProvider session={null}>{children}</ChatRailProvider>;
}

describe("ChatRailProvider (authed)", () => {
  it("exposes initial state", () => {
    const { result } = renderHook(() => useChatRail(), { wrapper: wrapAuthed });
    expect(result.current.open).toBe(false);
    expect(result.current.unread).toBe(0);
    expect(result.current.currentSessionId).toBeNull();
    expect(result.current.streaming).toBe(false);
    expect(result.current.lastSeenMsgId).toBeNull();
    expect(result.current.lastMessagePreview).toBe("");
    expect(result.current.sessionAuthed).toBe(true);
  });

  it("expand() opens and clears unread", () => {
    const { result } = renderHook(() => useChatRail(), { wrapper: wrapAuthed });
    act(() => result.current.bumpUnread());
    expect(result.current.unread).toBe(1);
    act(() => result.current.expand());
    expect(result.current.open).toBe(true);
    expect(result.current.unread).toBe(0);
  });

  it("collapse() closes", () => {
    const { result } = renderHook(() => useChatRail(), { wrapper: wrapAuthed });
    act(() => result.current.expand());
    expect(result.current.open).toBe(true);
    act(() => result.current.collapse());
    expect(result.current.open).toBe(false);
  });

  it("toggle() flips open and clears unread on opening", () => {
    const { result } = renderHook(() => useChatRail(), { wrapper: wrapAuthed });
    act(() => result.current.bumpUnread());
    expect(result.current.unread).toBe(1);
    // Opening via toggle
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    expect(result.current.unread).toBe(0);
    // Closing via toggle
    act(() => result.current.toggle());
    expect(result.current.open).toBe(false);
  });

  it("bumpUnread increments when closed and is no-op when open", () => {
    const { result } = renderHook(() => useChatRail(), { wrapper: wrapAuthed });
    act(() => result.current.bumpUnread());
    act(() => result.current.bumpUnread());
    expect(result.current.unread).toBe(2);
    act(() => result.current.expand());
    expect(result.current.unread).toBe(0);
    act(() => result.current.bumpUnread());
    expect(result.current.unread).toBe(0);
  });

  it("setLastSeenMsgId persists id", () => {
    const { result } = renderHook(() => useChatRail(), { wrapper: wrapAuthed });
    act(() => result.current.setLastSeenMsgId("abc-123"));
    expect(result.current.lastSeenMsgId).toBe("abc-123");
  });

  it("markAllRead sets unread to 0", () => {
    const { result } = renderHook(() => useChatRail(), { wrapper: wrapAuthed });
    act(() => {
      result.current.bumpUnread();
      result.current.bumpUnread();
    });
    expect(result.current.unread).toBe(2);
    act(() => result.current.markAllRead());
    expect(result.current.unread).toBe(0);
  });

  it("setCurrentSession updates currentSessionId", () => {
    const { result } = renderHook(() => useChatRail(), { wrapper: wrapAuthed });
    act(() => result.current.setCurrentSession("session-1"));
    expect(result.current.currentSessionId).toBe("session-1");
    act(() => result.current.setCurrentSession(null));
    expect(result.current.currentSessionId).toBeNull();
  });

  it("setStreaming toggles streaming bool", () => {
    const { result } = renderHook(() => useChatRail(), { wrapper: wrapAuthed });
    act(() => result.current.setStreaming(true));
    expect(result.current.streaming).toBe(true);
    act(() => result.current.setStreaming(false));
    expect(result.current.streaming).toBe(false);
  });

  it("setLastMessagePreview updates preview", () => {
    const { result } = renderHook(() => useChatRail(), { wrapper: wrapAuthed });
    act(() => result.current.setLastMessagePreview("hey"));
    expect(result.current.lastMessagePreview).toBe("hey");
  });
});

describe("ChatRailProvider (auto-expand debounce — gotcha #13)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("bumpUnread({autoExpand:true}) DOES auto-expand when last collapse was >= 500ms ago", () => {
    const { result } = renderHook(() => useChatRail(), { wrapper: wrapAuthed });
    // Open then collapse — sets lastUserCollapseTs to "now"
    act(() => result.current.expand());
    act(() => result.current.collapse());
    expect(result.current.open).toBe(false);
    // Advance past the 500ms debounce window
    act(() => {
      vi.advanceTimersByTime(501);
    });
    act(() => result.current.bumpUnread({ autoExpand: true }));
    expect(result.current.open).toBe(true);
  });

  it("bumpUnread({autoExpand:true}) SKIPS auto-expand when last collapse was <500ms ago", () => {
    const { result } = renderHook(() => useChatRail(), { wrapper: wrapAuthed });
    act(() => result.current.expand());
    act(() => result.current.collapse());
    // Only advance 100ms — inside the debounce window
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => result.current.bumpUnread({ autoExpand: true }));
    // Did NOT auto-expand; unread was bumped instead
    expect(result.current.open).toBe(false);
    expect(result.current.unread).toBe(1);
  });
});

describe("ChatRailProvider (unauthed — gotcha #10)", () => {
  it("provides no-op default context when session=null", () => {
    const { result } = renderHook(() => useChatRail(), { wrapper: wrapUnauthed });
    expect(result.current.sessionAuthed).toBe(false);
    expect(result.current.open).toBe(false);
    expect(result.current.unread).toBe(0);
    // All actions are no-ops; calling them must not throw
    act(() => {
      result.current.expand();
      result.current.collapse();
      result.current.toggle();
      result.current.bumpUnread();
      result.current.markAllRead();
      result.current.setCurrentSession("x");
      result.current.setLastSeenMsgId("y");
      result.current.setStreaming(true);
      result.current.setLastMessagePreview("p");
    });
    // State remains at defaults — the no-op context doesn't mutate
    expect(result.current.open).toBe(false);
    expect(result.current.unread).toBe(0);
    expect(result.current.currentSessionId).toBeNull();
    expect(result.current.streaming).toBe(false);
  });

  it("still renders children", () => {
    render(
      <ChatRailProvider session={null}>
        <span data-testid="child">visible</span>
      </ChatRailProvider>,
    );
    expect(screen.getByTestId("child").textContent).toBe("visible");
  });
});
