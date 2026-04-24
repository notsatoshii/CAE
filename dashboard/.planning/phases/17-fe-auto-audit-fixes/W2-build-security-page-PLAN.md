---
phase: 17
plan: W2-build-security-page
wave: 2
name: Fix /build/security parent page — truth=1 depth=1.5 liveness=1.2 (worst route)
---

# W2 — /build/security worst-scoring route

## Context

Per C5 per-route rollup, `/build/security` scored:

- truth 1.0 (vs threshold 4)
- depth 1.5 (content missing)
- liveness 1.2 (SSE markers not flipping)

This is worse than 403/signin. Subpages `/build/security/audit`, `/build/security/secrets`, `/build/security/skills` have content; the parent page is a shell. Either missing a dashboard or the parent is intentionally a hub — in which case the truth/liveness fixtures need a `build-security.*` key family and the page needs loading/healthy data-truth markers.

## Task

<task>
<name>Build the /build/security hub page (or confirm-and-document it as a redirect)</name>

<files>
app/build/security/page.tsx
app/build/security/layout.tsx
components/security/security-hub.tsx
components/security/security-hub.test.tsx
audit/fixtures/healthy.ts
audit/score/pillars.ts
</files>

<action>
1. Read current `app/build/security/page.tsx`. Decide: is it a hub, or should it redirect to `/build/security/audit`?
2. If redirect: use `redirect("/build/security/audit")` from `next/navigation` at top of server component. Done. Update routes.ts: mark as authRequired redirect, exclude from pillar scoring or add to route-stub list.
3. If hub (preferred — users land here when clicking "Security" in top-nav):
   - Render 3 summary tiles: Audit log (count of entries last 24h), Secrets (count + last-rotated), Skills (count of privileged skills + last-gated count).
   - Each tile links to the corresponding subpage.
   - Add a "Threats" live-tail card reading from `/api/security/events` (if exists) or a placeholder.
4. Emit data-truth keys: `build-security.healthy=yes`, `build-security.audit-count=<n>`, `build-security.secrets-count=<n>`, `build-security.skills-count=<n>`.
5. Add fixture entries to `audit/fixtures/healthy.ts` matching the emitted keys.
6. Add `build-security` prefix to `ROUTE_TRUTH_PREFIXES` in `audit/score/pillars.ts` (`"build-security": ["build-security."]`).
7. Unit tests: hub renders with mocked data + without (loading state).
</action>

<verify>
1. Open http://localhost:3002/build/security → hub visible with 3+ tiles, non-empty, sensible.
2. `pnpm vitest run components/security` — green.
3. Re-run audit. Truth pillar on /build/security ≥4, depth ≥4, liveness ≥3.
4. Reliability pillar still ≥3 (no new errors).
</verify>
</task>
