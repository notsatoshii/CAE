"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ModeToggle() {
  const pathname = usePathname();
  const router = useRouter();

  const activeMode = pathname.startsWith("/ops") ? "ops" : "build";

  function navigate(mode: "build" | "ops") {
    document.cookie = `cae-mode=${mode}; max-age=${60 * 60 * 24 * 365}; path=/`;
    router.push(`/${mode}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border p-1">
      <Button
        size="sm"
        variant={activeMode === "build" ? "default" : "ghost"}
        onClick={() => navigate("build")}
      >
        Build
      </Button>
      <Button
        size="sm"
        variant={activeMode === "ops" ? "default" : "ghost"}
        onClick={() => navigate("ops")}
      >
        Ops
      </Button>
    </div>
  );
}
