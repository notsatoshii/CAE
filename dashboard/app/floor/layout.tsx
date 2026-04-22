/**
 * /floor layout — shared by /floor and /floor/popout (Plan 11-05, Task 1).
 *
 * Minimal pass-through: exists as a route boundary so /floor/popout can
 * suppress the TopNav via route-scoped CSS without touching app/layout.tsx.
 * No TopNav is injected here — that comes from the root app/layout.tsx.
 *
 * Zero dollar signs in this file.
 */

export default function FloorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
