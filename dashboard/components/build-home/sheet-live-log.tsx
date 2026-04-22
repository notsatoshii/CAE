"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { useSseHealth } from "@/lib/hooks/use-sse-health";
import { LastUpdated } from "@/components/ui/last-updated";

const MAX_LINES = 500;

interface Props {
  path: string;
}

export function SheetLiveLog({ path }: Props) {
  const { dev } = useDevMode();
  const t = labelFor(dev);

  const [lines, setLines] = useState<string[]>([]);
  const [totalReceived, setTotalReceived] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  // SSE health — tracks connection status + last message timestamp
  const sseUrl = path ? "/api/tail?path=" + encodeURIComponent(path) : "";
  const { lastMessageAt, status: sseStatus } = useSseHealth(sseUrl);

  const bottomRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (!path) {
      setError("No log stream available");
      return;
    }
    setError(null);
    setLines([]);
    setTotalReceived(0);

    const es = new EventSource("/api/tail?path=" + encodeURIComponent(path));
    es.onmessage = (e) => {
      setLines((prev) => {
        const next = [...prev, e.data as string];
        return next.length > MAX_LINES
          ? next.slice(next.length - MAX_LINES)
          : next;
      });
      setTotalReceived((n) => n + 1);
    };
    es.onerror = () => {
      es.close();
      setError("No log stream available");
    };
    return () => es.close();
  }, [path]);

  useEffect(() => {
    if (!pausedRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [lines]);

  if (error) {
    return (
      <div
        data-testid="sheet-live-log"
        className="py-3 text-sm text-[color:var(--text-muted)]"
      >
        {error}
      </div>
    );
  }

  const truncated = totalReceived > MAX_LINES;

  return (
    <div
      data-testid="sheet-live-log"
      className="flex flex-col border border-[color:var(--border-subtle)] rounded-md overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface)] gap-2">
        <span className="font-mono text-xs text-[color:var(--text-muted)] truncate flex-1">
          {path}
        </span>
        {/* SSE health indicators */}
        <span
          className="inline-block size-1.5 rounded-full shrink-0"
          style={{
            backgroundColor:
              sseStatus === "open"
                ? "var(--success)"
                : sseStatus === "connecting"
                  ? "var(--warning)"
                  : "var(--danger)",
          }}
          aria-label={`Stream: ${sseStatus}`}
          title={`Stream: ${sseStatus}`}
        />
        <LastUpdated at={lastMessageAt} threshold_ms={30000} />
        <button
          type="button"
          data-testid="sheet-log-pause-button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Resume log auto-scroll" : "Pause log auto-scroll"}
          className="text-xs px-2 py-0.5 rounded border border-[color:var(--border-subtle)] hover:bg-[color:var(--surface-hover)] shrink-0"
        >
          {paused ? t.sheetLogResumeScroll : t.sheetLogPauseScroll}
        </button>
      </div>
      {truncated && (
        <div className="px-3 py-1 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface)] text-xs text-[color:var(--text-muted)]">
          {t.sheetLogTruncatedNote}
        </div>
      )}
      <ScrollArea className="h-[40vh] bg-[color:var(--bg)]">
        <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all text-[color:var(--text)]">
          {lines.join("\n")}
        </pre>
        <div ref={bottomRef} />
      </ScrollArea>
    </div>
  );
}
