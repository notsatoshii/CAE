/**
 * Admin section layout.
 *
 * Middleware already gates /build/admin to admin role — this layout
 * assumes the user is authenticated as admin. No need for client-side
 * role check here.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full">
      <header className="border-b border-[color:var(--border,#1f1f22)] px-6 py-4">
        <div className="flex items-center gap-3">
          <a
            href="/build"
            className="text-xs text-[color:var(--text-muted,#8a8a8c)] hover:text-[color:var(--text,#e5e5e5)] transition-colors"
          >
            ← Build
          </a>
          <span className="text-xs text-[color:var(--border,#1f1f22)]">/</span>
          <h1 className="text-sm font-medium uppercase tracking-wider text-[color:var(--text-muted,#8a8a8c)]">
            Admin
          </h1>
        </div>
      </header>
      <div className="p-6">{children}</div>
    </div>
  )
}
