---
phase: 18
plan: WA-403-page
wave: 1
name: Fix 403 error page — shows broken dashboard frame
---

# WA — Fix 403 error page

## Context

The 403 page shows 0/46 truth keys matched — it's rendering a broken dashboard shell instead of a proper error page. Currently scores 1 across truth/depth/liveness for all personas and viewports (18 cells).

Reference: C6-FINDINGS.md shows all 403 cells at truth=1, depth=1, liveness=1.

## Task

<task>
<name>Create a proper branded 403 Forbidden page</name>

<files>
app/403.tsx
app/forbidden.tsx
app/not-found.tsx
components/error/**/*.tsx
</files>

<action>
1. Find the current 403 handling (might be in middleware.ts redirecting to a broken route).
2. Create a proper 403 page: centered layout, CAE logo, "Access Denied" heading, "You don't have permission to view this page" description, "Go to Dashboard" button linking to /.
3. This page should NOT render the sidebar/nav — it should be a standalone branded page like the sign-in page.
4. Match the sign-in page aesthetic: dark background, centered card, cyan accent on the button.
</action>

<verify>
1. Navigating to a forbidden route shows a clean branded error page.
2. "Go to Dashboard" button works.
3. No console errors on the 403 page.
4. `pnpm build` passes.
</verify>
</task>