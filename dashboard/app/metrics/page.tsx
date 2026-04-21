import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function MetricsPage() {
  const session = await auth();
  if (!session) redirect("/signin?from=/metrics");

  return (
    <main className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--text)]">Metrics</h1>
      <p className="mt-4 text-sm text-[color:var(--text-muted)]">
        Spending, reliability, and speed — three panels covering today&apos;s token estimate,
        per-agent success rates, and wall-time percentiles. Full content ships in Phase 7.
      </p>
    </main>
  );
}
