"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { estimateTokens, type ChatGatedActionSpec } from "@/lib/chat-cost-estimate";

export interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  spec: ChatGatedActionSpec;
  summary: string;
  diffPreview?: string;
  onAccept: () => void | Promise<void>;
  onCancel?: () => void;
}

export function ConfirmActionDialog(props: ConfirmActionDialogProps) {
  const { open, onOpenChange, spec, summary, diffPreview, onAccept, onCancel } = props;
  const { dev } = useDevMode();
  const t = labelFor(dev);
  const tokens = estimateTokens(spec);

  // Dev-mode bypass: auto-execute + undo toast.
  useEffect(() => {
    if (!open || !dev) return;
    let cancelled = false;
    (async () => {
      await onAccept();
      if (cancelled) return;
      toast(t.chatGateInstantToast(summary), {
        action: { label: t.chatGateUndoToast, onClick: () => onCancel?.() },
        duration: 1500,
      });
      onOpenChange(false);
    })();
    return () => { cancelled = true; };
  }, [open, dev]); // eslint-disable-line react-hooks/exhaustive-deps

  if (dev) return null;
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="confirm-action-dialog" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.chatGateDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-[color:var(--text-dim,#5a5a5c)]">{t.chatGateDialogSummaryLabel}</div>
            <p className="text-sm text-[color:var(--text,#e5e5e5)]">{summary}</p>
          </div>
          <div>
            <div className="text-xs text-[color:var(--text-dim,#5a5a5c)]">{t.chatGateDialogCostLabel(tokens)}</div>
          </div>
          {diffPreview ? (
            <div>
              <div className="text-xs text-[color:var(--text-dim,#5a5a5c)]">{t.chatGateDialogDiffLabel}</div>
              <pre className="max-h-40 overflow-auto text-xs font-mono bg-[color:var(--surface,#121214)] border border-[color:var(--border,#1f1f22)] rounded p-2">{diffPreview}</pre>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { onCancel?.(); onOpenChange(false); }}
            >
              {t.chatGateDialogCancel}
            </Button>
            <Button
              type="button"
              onClick={async () => { await onAccept(); onOpenChange(false); }}
            >
              {t.chatGateDialogAccept}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
