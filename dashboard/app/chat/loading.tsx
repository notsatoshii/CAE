"use client";

/**
 * /chat route suspense fallback — ChatPanel skeleton.
 * Shows a message-list skeleton while the chat component hydrates.
 */

export default function ChatLoading() {
  return (
    <div
      data-testid="chat-loading"
      role="status"
      aria-busy="true"
      className="flex h-full w-full"
    >
      {/* Left pane: mirror skeleton */}
      <div className="hidden w-1/2 border-r border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4 md:flex flex-col gap-3 overflow-y-auto">
        <div className="h-6 w-32 rounded bg-[color:var(--text-dim)] opacity-20"></div>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2 p-2 rounded hover:bg-[color:var(--surface-hover)] transition-colors"
          >
            <div className="h-8 w-8 rounded bg-[color:var(--text-dim)] opacity-20"></div>
            <div className="flex-1">
              <div className="h-4 w-24 rounded bg-[color:var(--text-dim)] opacity-20"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Right pane: chat skeleton */}
      <div className="w-full md:w-1/2 flex flex-col bg-[color:var(--bg)]">
        {/* Messages area */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs p-3 rounded-lg ${
                  i % 2 === 0
                    ? "bg-[color:var(--accent)] opacity-20"
                    : "bg-[color:var(--surface)] opacity-40"
                }`}
              >
                <div className="h-4 w-32 rounded bg-[color:var(--text-dim)] opacity-20"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Input skeleton */}
        <div className="border-t border-[color:var(--border-subtle)] p-4 space-y-2">
          <div className="h-10 w-full rounded bg-[color:var(--surface)] opacity-40"></div>
          <div className="flex gap-2">
            <div className="h-8 flex-1 rounded bg-[color:var(--text-dim)] opacity-20"></div>
            <div className="h-8 w-20 rounded bg-[color:var(--text-dim)] opacity-20"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
