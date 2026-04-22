"use client";

import { useCallback, useState } from "react";
import type { ChatGatedActionSpec } from "@/lib/chat-cost-estimate";
import type { ConfirmActionDialogProps } from "@/components/chat/confirm-action-dialog";

export const GATED_ACTIONS_REGISTRY = ["workflow_run", "delegate_new", "retry_task"] as const;

export interface UseGatedActionInput {
  spec: ChatGatedActionSpec;
  summary: string;
  diffPreview?: string;
  onRun: () => void | Promise<void>;
}

export interface UseGatedActionApi {
  open: boolean;
  request: () => void;
  accept: () => Promise<void>;
  cancel: () => void;
  dialogProps: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    spec: ChatGatedActionSpec;
    summary: string;
    diffPreview?: string;
    onAccept: () => void | Promise<void>;
    onCancel: () => void;
  };
}

export function useGatedAction(input: UseGatedActionInput): UseGatedActionApi {
  const { spec, summary, diffPreview, onRun } = input;
  const [open, setOpen] = useState(false);

  const request = useCallback(() => {
    setOpen(true);
  }, []);

  const accept = useCallback(async () => {
    await onRun();
  }, [onRun]);

  const cancel = useCallback(() => {
    setOpen(false);
  }, []);

  return {
    open,
    request,
    accept,
    cancel,
    dialogProps: {
      open,
      onOpenChange: setOpen,
      spec,
      summary,
      diffPreview,
      onAccept: accept,
      onCancel: cancel,
    },
  };
}
