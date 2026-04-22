import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { labelFor } from "@/lib/copy/labels";
import MemoryClient from "./memory-client";

/**
 * Phase 8 Wave 5 (plan 08-07, MEM-01, D-16) — /memory server shell.
 *
 * Responsibilities:
 *   - Auth-gated: unauthenticated users redirect to /signin?from=/memory.
 *     Mirrors the /metrics pattern exactly (middleware.ts also guards the
 *     route; this is the belt-and-suspenders in-page gate).
 *   - Server-renders the page heading with `labelFor(false)` (founder default).
 *     The client island below picks up live DevMode state for deeper copy.
 *   - Mounts <MemoryClient /> once; all interactivity, deep-link query
 *     reading, tab routing, and drawer hosting live there.
 *
 * Layout notes:
 *   - `max-w-7xl` is wider than /metrics's 6xl because the graph canvas
 *     benefits from horizontal space.
 *   - `h-[calc(100vh-40px)]` subtracts the 40px top-bar so the graph
 *     canvas + tab panels have a bounded height to render into.
 *
 * Server-only: no `"use client"` directive. The auth check must run on the
 * server, and the client file below is the boundary.
 */
export default async function MemoryPage() {
  const session = await auth();
  if (!session) redirect("/signin?from=/memory");

  const L = labelFor(false);

  return (
    <main className="mx-auto flex h-[calc(100vh-40px)] max-w-7xl flex-col gap-4 p-4">
      <h1
        data-testid="memory-page-heading"
        className="text-2xl font-semibold tracking-tight text-[color:var(--text)]"
      >
        {L.memoryPageHeading}
      </h1>
      <MemoryClient />
    </main>
  );
}
