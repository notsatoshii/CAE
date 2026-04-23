/**
 * /chat route loader — Next 16 App Router renders this as the Suspense
 * fallback while ChatPage's auth + layout resolve.
 *
 * Linear-style skeleton: mimics the real chat layout so the transition to
 * loaded feels instant rather than a blocking curtain. Two message bubbles
 * shimmer under an assistant avatar; the kind voice line sits below them.
 *
 * Matches the 50/50 layout in app/chat/chat-layout.tsx so the skeleton lands
 * on the same visual axis when the real panel mounts.
 */

import { Shimmer } from "@/components/ui/shimmer";
import { labelFor } from "@/lib/copy/labels";

export default function ChatLoading() {
  const L = labelFor(false);

  return (
    <main
      data-testid="chat-loading"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading chat"
      className="flex h-[calc(100vh-40px)] w-full"
    >
      {/* Left pane — mirror surface skeleton (matches ChatMirror placement). */}
      <div className="hidden flex-1 border-r border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4 md:flex md:flex-col md:gap-3">
        <Shimmer variant="text" width="40%" height={14} testId="chat-loading-mirror-title" />
        <Shimmer variant="box" height={120} testId="chat-loading-mirror-preview" />
        <Shimmer variant="text" width="60%" height={12} />
        <Shimmer variant="text" width="80%" height={12} />
      </div>

      {/* Right pane — the actual chat panel skeleton. */}
      <div className="mx-auto flex w-full max-w-[800px] flex-col gap-4 p-4">
        {/* Assistant bubble 1 */}
        <div
          data-testid="chat-loading-bubble-1"
          className="flex items-start gap-3"
        >
          <Shimmer variant="circle" size={32} testId="chat-loading-avatar" />
          <div className="flex flex-1 flex-col gap-2">
            <Shimmer variant="text" width="32%" height={12} />
            <Shimmer variant="box" height={56} className="max-w-[75%]" />
          </div>
        </div>

        {/* User bubble (right-aligned) */}
        <div className="flex items-start justify-end">
          <Shimmer variant="box" height={40} className="max-w-[60%]" />
        </div>

        {/* Assistant bubble 2 — shorter, still drafting */}
        <div
          data-testid="chat-loading-bubble-2"
          className="flex items-start gap-3"
        >
          <Shimmer variant="circle" size={32} />
          <div className="flex flex-1 flex-col gap-2">
            <Shimmer variant="text" width="28%" height={12} />
            <Shimmer variant="box" height={36} className="max-w-[55%]" />
          </div>
        </div>

        {/* Kind voice line */}
        <div
          data-testid="chat-loading-voice"
          className="mt-auto pt-4 text-center text-sm text-[color:var(--text-muted)]"
        >
          {L.loading.chat}
        </div>
      </div>
    </main>
  );
}
