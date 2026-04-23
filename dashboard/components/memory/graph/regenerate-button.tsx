"use client";

/**
 * Phase 8 Wave 3 (MEM-08, D-06): Regenerate button with 60s debounce.
 *
 * Behavior:
 *   - 60s client-side cooldown after a successful POST, visible countdown
 *     in the label.
 *   - 429 from the server (cooldown) is respected — cooldown is reset to
 *     the server's `retry_after_ms`.
 *   - 500 → sonner toast + no cooldown (user can retry).
 *   - If `generatedAt` (from the graph payload) is within the last 60s on
 *     mount, we pre-initialize the cooldown so a page refresh doesn't
 *     bypass it.
 *   - 1 Hz countdown via `useEffect` + `setInterval` — re-renders at
 *     second boundaries only.
 *   - Pending state shows spinner + pending-copy label.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { ExplainTooltip } from "@/components/ui/explain-tooltip";

const COOLDOWN_MS = 60_000;

interface RegenerateButtonProps {
  onRegenerated?: () => void;
  /**
   * ISO8601 timestamp of the currently-loaded graph, if any. Used on
   * mount to pre-hydrate the cooldown when a recent regeneration is
   * already visible in the dashboard.
   */
  generatedAt?: string;
}

function initialCooldownFrom(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const delta = Date.now() - t;
  if (delta < 0 || delta >= COOLDOWN_MS) return null;
  return t + COOLDOWN_MS;
}

export function RegenerateButton({
  onRegenerated,
  generatedAt,
}: RegenerateButtonProps) {
  const { dev } = useDevMode();
  const L = labelFor(dev);

  const [pending, setPending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const hydratedFromProp = useRef(false);

  useEffect(() => {
    setNow(Date.now());
    setCooldownUntil(initialCooldownFrom(generatedAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If `generatedAt` updates (new fetch lands), re-hydrate cooldown IF it's
  // not currently active — avoid squashing an in-progress cooldown.
  useEffect(() => {
    if (!hydratedFromProp.current) {
      hydratedFromProp.current = true;
      return;
    }
    const next = initialCooldownFrom(generatedAt);
    if (next && (!cooldownUntil || next > cooldownUntil)) {
      setCooldownUntil(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedAt]);

  // 1Hz tick while a cooldown is active — drives the countdown label.
  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= cooldownUntil) {
        setCooldownUntil(null);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const cooldownActive =
    cooldownUntil !== null && now !== null && now < cooldownUntil;
  const secondsLeft =
    cooldownUntil && now !== null
      ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
      : 0;
  const disabled = pending || cooldownActive;

  const handleClick = useCallback(async () => {
    if (disabled) return;
    setPending(true);
    try {
      const res = await fetch("/api/memory/regenerate", { method: "POST" });
      if (res.status === 429) {
        const body = (await res.json().catch(() => ({}))) as {
          retry_after_ms?: number;
        };
        const retry =
          typeof body.retry_after_ms === "number" && body.retry_after_ms > 0
            ? body.retry_after_ms
            : COOLDOWN_MS;
        setCooldownUntil(Date.now() + retry);
        return;
      }
      if (!res.ok) {
        toast.error(L.memoryLoadFailed);
        return;
      }
      setCooldownUntil(Date.now() + COOLDOWN_MS);
      onRegenerated?.();
    } catch {
      toast.error(L.memoryLoadFailed);
    } finally {
      setPending(false);
    }
  }, [disabled, onRegenerated, L]);

  let label: string;
  if (pending) {
    label = L.memoryBtnRegeneratePending;
  } else if (cooldownActive) {
    label = L.memoryBtnRegenerateCooldown(secondsLeft);
  } else {
    label = L.memoryBtnRegenerate;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-busy={pending}
        aria-label={label}
        data-testid="memory-regenerate-button"
        data-pending={pending ? "true" : "false"}
        data-cooldown={cooldownActive ? "true" : "false"}
        className={
          "inline-flex items-center gap-1.5 rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--text)] transition-colors " +
          (disabled
            ? "cursor-not-allowed opacity-60"
            : "hover:border-[color:var(--accent)] hover:bg-[color:var(--surface-hover)]")
        }
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="size-3.5" aria-hidden="true" />
        )}
        {label}
      </button>
      <ExplainTooltip text={L.memoryExplainRegenerate} />
    </div>
  );
}
