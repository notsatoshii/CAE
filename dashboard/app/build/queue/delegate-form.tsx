"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { createDelegation } from "./actions";

export function DelegateForm({ onSuccess }: { onSuccess?: (taskId: string) => void } = {}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { dev } = useDevMode();
  const t = labelFor(dev);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const id = await createDelegation(data);
        setTaskId(id);
        formRef.current?.reset();
        onSuccess?.(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delegation failed");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 mb-8 max-w-2xl">
      <h2 className="text-lg font-semibold">{t.delegateHeading}</h2>

      <div className="space-y-1">
        <Label htmlFor="target_repo">{t.delegateRepoField}</Label>
        <Input
          id="target_repo"
          name="target_repo"
          placeholder="/home/cae/ctrl-alt-elite"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="buildplan">{t.delegateBuildplanField}</Label>
        <Textarea
          id="buildplan"
          name="buildplan"
          required
          rows={8}
          placeholder="# Objective&#10;Describe what CAE should build..."
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? t.delegateSubmitPending : t.delegateSubmit}
      </Button>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {taskId && (
        <p className="text-sm text-muted-foreground">
          Job created:{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{taskId}</code>
          {" — "}
          <Link href="/build/queue" className="underline underline-offset-2">
            view queue
          </Link>
        </p>
      )}
    </form>
  );
}
