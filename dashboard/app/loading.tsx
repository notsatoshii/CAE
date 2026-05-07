/**
 * Root Suspense fallback — skeleton loading shell.
 * Replaces the Pikachu loader (dev artifact, keyboard instructions on mobile).
 */

export default function RootLoading() {
  return (
    <div
      data-testid="root-loading"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading"
      className="w-full min-h-[calc(100vh-40px)] flex flex-col items-center justify-center gap-4 bg-[color:var(--bg)]"
    >
      <div className="flex flex-col items-center gap-3">
        {/* Brand wordmark */}
        <p className="text-xs tracking-[0.25em] font-medium text-[color:var(--text-muted)] uppercase">
          Ctrl + Alt + Elite
        </p>
        {/* Three-dot pulse loader */}
        <div className="flex items-center gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-[color:var(--text-dim)] cae-loader-pulse-dot"
              style={{ ["--i" as string]: i }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
