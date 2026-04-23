"use client"

/**
 * RoleEditor — displays the current admin + operator email whitelists.
 *
 * Phase 14 Plan 04: v0.1 is READ-ONLY. Admins update env vars directly.
 * v2 will expose an editable UI with a DB adapter for real-time changes.
 */
type Props = {
  admins: string[]
  operators: string[]
}

function EmailList({ emails, emptyLabel }: { emails: string[]; emptyLabel: string }) {
  if (emails.length === 0) {
    return (
      <p className="text-sm text-[color:var(--text-muted,#8a8a8c)] italic">{emptyLabel}</p>
    )
  }
  return (
    <ul className="space-y-1.5">
      {emails.map((email) => (
        <li
          key={email}
          className="flex items-center gap-2 rounded-md border border-[color:var(--border,#1f1f22)] bg-[color:var(--bg,#0a0a0a)] px-3 py-2 font-mono text-sm text-[color:var(--text,#e5e5e5)]"
        >
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full bg-[color:var(--accent,#00d4ff)]"
            aria-hidden="true"
          />
          {email}
        </li>
      ))}
    </ul>
  )
}

export function RoleEditor({ admins, operators }: Props) {
  return (
    <section className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-[color:var(--text,#e5e5e5)]">
          Permissions
        </h2>
        <p className="mt-1 text-sm text-[color:var(--text-muted,#8a8a8c)]">
          Three levels: viewer reads, operator runs, admin edits.
          Roles are resolved when a user signs in.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-[color:var(--text,#e5e5e5)] uppercase tracking-wider">
            Admins
            <span className="ml-2 text-xs font-normal normal-case text-[color:var(--text-muted,#8a8a8c)]">
              — can change settings
            </span>
          </h3>
          <EmailList emails={admins} emptyLabel="No admins configured" />
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-[color:var(--text,#e5e5e5)] uppercase tracking-wider">
            Operators
            <span className="ml-2 text-xs font-normal normal-case text-[color:var(--text-muted,#8a8a8c)]">
              — can run tasks
            </span>
          </h3>
          <EmailList emails={operators} emptyLabel="No operators configured" />
        </div>
      </div>

      <p className="text-xs text-[color:var(--text-muted,#8a8a8c)] rounded-md border border-[color:var(--border,#1f1f22)] bg-[color:var(--surface,#121214)] px-4 py-3">
        Viewers are everyone else who can sign in. To change the list, update{" "}
        <code className="font-mono text-[color:var(--accent,#00d4ff)]">ADMIN_EMAILS</code>{" "}
        and{" "}
        <code className="font-mono text-[color:var(--accent,#00d4ff)]">OPERATOR_EMAILS</code>{" "}
        in <code className="font-mono">.env.local</code> and restart.
        See <code className="font-mono">docs/ENV.md</code> for details.
      </p>
    </section>
  )
}
