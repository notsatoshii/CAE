"use client";

/**
 * Client-side error capture bridge.
 *
 * Two complementary mechanisms:
 *
 * 1. `ClientErrorBridge` — useEffect hook that registers window.onerror and
 *    window.onunhandledrejection. Catches runtime JS errors and unhandled promise
 *    rejections. POSTs to /api/telemetry/client-error so they appear in the
 *    server-side structured log stream.
 *
 * 2. `RootErrorBoundary` — React class component error boundary. Catches errors
 *    thrown during render / lifecycle (which window.onerror does NOT catch in React
 *    apps). Shows a fallback UI and POSTs the error server-side.
 *
 * Both mechanisms fire independently — a render error fires componentDidCatch AND
 * may also fire window.onerror in some browsers. Duplicate POSTs are acceptable;
 * the server log dedupes by reqId.
 *
 * Mount in app/layout.tsx:
 *   <RootErrorBoundary>
 *     <ClientErrorBridge />
 *     {children}
 *   </RootErrorBoundary>
 *
 * Plan 13-08 (Incident Stream panel) will surface these logs in the dashboard UI.
 */

import { useEffect, Component, type ReactNode } from "react";
import { clientLog } from "@/lib/client-log-bus";

interface ClientErrorPayload {
  message?: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  componentStack?: string;
}

/**
 * Fire-and-forget POST to the server-side telemetry route.
 * Never throws — swallowed entirely so error reporting never causes a secondary error.
 */
function reportError(body: ClientErrorPayload): void {
  try {
    fetch("/api/telemetry/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      // keepalive: true ensures the POST completes even if the page is unloading
      keepalive: true,
    }).catch(() => {
      // Silently swallow network errors — telemetry must never crash the app
    });
  } catch {
    // Swallow synchronous errors from JSON.stringify etc.
  }
}

/**
 * Mounts window.onerror + window.onunhandledrejection listeners and bridges
 * them to /api/telemetry/client-error. Returns null — renders nothing visible.
 */
export function ClientErrorBridge(): null {
  useEffect(() => {
    const onError = (ev: ErrorEvent) => {
      reportError({
        message: ev.message,
        stack: ev.error?.stack,
        url: typeof location !== "undefined" ? location.href : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
    };

    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason;
      reportError({
        message:
          reason instanceof Error
            ? reason.message
            : String(reason?.message ?? reason ?? "(unhandled rejection)"),
        stack: reason instanceof Error ? reason.stack : undefined,
        url: typeof location !== "undefined" ? location.href : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

/**
 * React class error boundary — complements ClientErrorBridge for render errors.
 * React devtools also show the error in the overlay; this captures it server-side.
 */
export class RootErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    reportError({
      message: error.message,
      stack: error.stack,
      url: typeof location !== "undefined" ? location.href : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      componentStack: info.componentStack ?? undefined,
    });
    // Also push to client-log-bus so the DebugBreadcrumbPanel shows boundary errors
    clientLog("error", "boundary", error.message, {
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "2rem",
            color: "var(--danger, #ef4444)",
            fontFamily: "monospace",
            fontSize: "0.875rem",
          }}
        >
          <strong>Something went wrong.</strong>
          <br />
          {this.state.errorMessage && (
            <span style={{ opacity: 0.75 }}>{this.state.errorMessage}</span>
          )}
          <br />
          <br />
          The error has been logged. Try refreshing the page.
        </div>
      );
    }

    return this.props.children;
  }
}
