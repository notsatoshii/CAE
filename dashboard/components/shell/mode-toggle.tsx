"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Mode = "plan" | "build";

export function ModeToggle() {
  const pathname = usePathname();
  const router = useRouter();

  const activeMode: Mode | null = pathname.startsWith("/plan")
    ? "plan"
    : pathname.startsWith("/build")
      ? "build"
      : null;

  function navigate(mode: Mode) {
    document.cookie = `cae-mode=${mode}; max-age=${60 * 60 * 24 * 365}; path=/`;
    router.push(`/${mode}`);
  }

  return (
    <div
      role="tablist"
      aria-label="Mode"
      data-testid="mode-toggle"
      className="inline-flex items-center gap-0 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-0.5 text-xs"
    >
      <SegmentButton label="Plan" active={activeMode === "plan"} onClick={() => navigate("plan")} />
      <SegmentButton label="Build" active={activeMode === "build"} onClick={() => navigate("build")} />
    </div>
  );
}

function SegmentButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "h-6 rounded-[6px] px-2.5 font-medium transition-colors",
        active
          ? "bg-[color:var(--accent-muted)] text-[color:var(--accent)]"
          : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
      )}
    >
      {label}
    </button>
  );
}
