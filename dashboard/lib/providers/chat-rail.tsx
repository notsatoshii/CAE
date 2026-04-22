"use client";

/**
 * ChatRailProvider — Phase 9 Plan 05 Task 1.
 *
 * Provider + hook for the persistent right-rail chat. Owns:
 *   - open/collapse state (click-toggle per D-10, Escape closes when open)
 *   - unread counter (D-09: bumps on assistant.delta + unread_tick when closed; clears on open)
 *   - current session id + last_seen_msg_id cursor for SSE dedupe (D-17)
 *   - streaming bool + last message preview (rendered by the collapsed rail)
 *   - auto-expand debounce (gotcha #13: skip auto-expand if user manually
 *     collapsed within the last 500ms — prevents screen-shake+auto-expand
 *     stacking on merge-event-triggered streams)
 *
 * session-gating (gotcha #10): when mounted without a session (e.g. /signin,
 * first paint before auth), the provider exposes a default no-op context so
 * useChatRail() is always safe to call but every mutation is inert and
 * `sessionAuthed === false`. The `<ChatRail>` component reads `sessionAuthed`
 * and renders null in that case.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface ChatRailContextValue {
  open: boolean;
  unread: number;
  currentSessionId: string | null;
  streaming: boolean;
  lastMessagePreview: string;
  lastSeenMsgId: string | null;
  sessionAuthed: boolean;
  toggle: () => void;
  expand: () => void;
  collapse: () => void;
  setCurrentSession: (id: string | null) => void;
  setLastSeenMsgId: (id: string) => void;
  setLastMessagePreview: (s: string) => void;
  markAllRead: () => void;
  bumpUnread: (opts?: { autoExpand?: boolean }) => void;
  setStreaming: (v: boolean) => void;
}

const NOOP_DEFAULT: ChatRailContextValue = {
  open: false,
  unread: 0,
  currentSessionId: null,
  streaming: false,
  lastMessagePreview: "",
  lastSeenMsgId: null,
  sessionAuthed: false,
  toggle: () => {},
  expand: () => {},
  collapse: () => {},
  setCurrentSession: () => {},
  setLastSeenMsgId: () => {},
  setLastMessagePreview: () => {},
  markAllRead: () => {},
  bumpUnread: () => {},
  setStreaming: () => {},
};

const ChatRailContext = createContext<ChatRailContextValue>(NOOP_DEFAULT);

export function useChatRail(): ChatRailContextValue {
  return useContext(ChatRailContext);
}

/**
 * Inner authed provider — always renders authed state/logic. Mounted by
 * <ChatRailProvider> only when `session` is truthy. Keeps hook calls
 * unconditional (no rules-of-hooks violations).
 */
function AuthedChatRailProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [streaming, setStreamingState] = useState(false);
  const [lastMessagePreview, setLastMessagePreviewState] = useState("");
  const [lastSeenMsgId, setLastSeenMsgIdState] = useState<string | null>(null);
  const lastUserCollapseTs = useRef<number>(0);

  const expand = useCallback(() => {
    setOpen(true);
    setUnread(0);
  }, []);

  const collapse = useCallback(() => {
    setOpen(false);
    lastUserCollapseTs.current = Date.now();
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (prev) {
        // Closing → record the user-collapse timestamp for the debounce.
        lastUserCollapseTs.current = Date.now();
        return false;
      }
      // Opening → clear unread as well.
      setUnread(0);
      return true;
    });
  }, []);

  const markAllRead = useCallback(() => setUnread(0), []);

  const bumpUnread = useCallback((opts?: { autoExpand?: boolean }) => {
    // Use functional setOpen to read the latest open state without stale closure.
    setOpen((prevOpen) => {
      if (prevOpen) {
        // Already open — no unread bump, don't change open.
        return prevOpen;
      }
      const shouldAutoExpand =
        opts?.autoExpand === true &&
        Date.now() - lastUserCollapseTs.current >= 500;
      if (shouldAutoExpand) {
        // Auto-expand clears unread (matches expand() semantics).
        setUnread(0);
        return true;
      }
      // Stay closed and bump unread.
      setUnread((u) => u + 1);
      return prevOpen;
    });
  }, []);

  const setCurrentSession = useCallback(
    (id: string | null) => setCurrentSessionId(id),
    [],
  );
  const setLastSeenMsgId = useCallback(
    (id: string) => setLastSeenMsgIdState(id),
    [],
  );
  const setLastMessagePreview = useCallback(
    (s: string) => setLastMessagePreviewState(s),
    [],
  );
  const setStreaming = useCallback((v: boolean) => setStreamingState(v), []);

  // Escape key collapses the rail when it is open (D-10).
  // Scoped to window; preventDefault so it doesn't also dismiss e.g. focused
  // form controls inside the panel.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        lastUserCollapseTs.current = Date.now();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const value: ChatRailContextValue = {
    open,
    unread,
    currentSessionId,
    streaming,
    lastMessagePreview,
    lastSeenMsgId,
    sessionAuthed: true,
    toggle,
    expand,
    collapse,
    setCurrentSession,
    setLastSeenMsgId,
    setLastMessagePreview,
    markAllRead,
    bumpUnread,
    setStreaming,
  };

  return (
    <ChatRailContext.Provider value={value}>{children}</ChatRailContext.Provider>
  );
}

export function ChatRailProvider({
  children,
  session,
}: {
  children: ReactNode;
  // `unknown | null` because we only care about truthiness. Typing as Session
  // would create a next-auth coupling unused by this provider.
  session: unknown | null;
}) {
  if (!session) {
    return (
      <ChatRailContext.Provider value={NOOP_DEFAULT}>
        {children}
      </ChatRailContext.Provider>
    );
  }
  return <AuthedChatRailProvider>{children}</AuthedChatRailProvider>;
}
