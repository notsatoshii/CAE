/**
 * /403 — Forbidden page.
 *
 * Shown when middleware redirects a user who lacks the required role.
 * UI-SPEC: founder-speak — no "403 Forbidden" jargon, plain English explanation.
 */
export default function Forbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--bg,#0a0a0a)] px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-[color:var(--border,#1f1f22)] bg-[color:var(--surface,#121214)] px-8 py-10 text-center shadow-xl">
        <h1 className="text-2xl font-semibold text-[color:var(--text,#e5e5e5)]">
          You don&apos;t have access to this.
        </h1>
        <p className="text-[15px] leading-relaxed text-[color:var(--text-muted,#8a8a8c)]">
          Ask an admin to bump your permissions. Meanwhile you can still browse
          everything else.
        </p>
        <a
          href="/build"
          className="mt-2 inline-block rounded-lg border border-[color:var(--accent,#00d4ff)] px-5 py-2.5 text-[15px] font-semibold text-[color:var(--accent,#00d4ff)] transition-opacity hover:opacity-80"
        >
          Back to Build home
        </a>
      </div>
    </main>
  )
}
