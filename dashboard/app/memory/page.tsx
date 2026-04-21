import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function MemoryPage() {
  const session = await auth();
  if (!session) redirect("/signin?from=/memory");

  return (
    <main className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--text)]">Memory</h1>
      <p className="mt-4 text-sm text-[color:var(--text-muted)]">
        Browse and search what CAE remembers — AGENTS.md entries, project plans, agent personas,
        and a knowledge graph of everything connected. Full content ships in Phase 8.
      </p>
    </main>
  );
}
