"use client"

/**
 * NlDraftTextarea — founder-facing widget that takes a natural-language
 * description of a workflow, runs it through the rules-based heuristic
 * parser (no LLM, no network), and emits the resulting WorkflowSpec via
 * the `onDraft` callback. The page above composes this with the step-graph
 * preview and (dev-only) Monaco editor in Plan 06-04.
 *
 * - Copy flips on dev via `labelFor(dev)` — founder-speak by default.
 * - Draft button is disabled while the textarea is empty OR the transition
 *   is pending, so accidental repeat clicks can't double-fire `onDraft`.
 * - If heuristicDraft emits a spec that fails validation, or a spec with
 *   zero steps from a non-empty input, show the
 *   `workflowsNlCouldNotParseNote` warning — the spec is still emitted so
 *   the page can decide whether to render it, clear the editor, etc.
 * - data-testids are contract with Plan 06-04 + VERIFICATION pass.
 *
 * Pure-schema imports: `validateWorkflow` + types come from
 * `@/lib/cae-workflows-schema` (not `@/lib/cae-workflows`) so the fs/promises
 * imports on the disk-I/O side of the domain layer do not leak into the
 * client bundle. See Plan 06-04 deviation Rule 3 for context.
 */

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor } from "@/lib/copy/labels"
import { heuristicDraft } from "@/lib/cae-nl-draft"
import { validateWorkflow } from "@/lib/cae-workflows-schema"
import type { WorkflowSpec } from "@/lib/cae-workflows-schema"

export interface NlDraftTextareaProps {
  onDraft: (spec: WorkflowSpec) => void
  initialText?: string
  disabled?: boolean
}

export function NlDraftTextarea({
  onDraft,
  initialText = "",
  disabled = false,
}: NlDraftTextareaProps) {
  const { dev } = useDevMode()
  const t = labelFor(dev)
  const [text, setText] = useState(initialText)
  const [pending, startTransition] = useTransition()
  const [warning, setWarning] = useState<string | null>(null)

  function handleDraft() {
    setWarning(null)
    startTransition(() => {
      // heuristicDraft is synchronous + pure; transition keeps UX parity for
      // large inputs and future async swaps (Phase 9 chat-first drafting).
      const spec = heuristicDraft(text)
      const errs = validateWorkflow(spec)
      if (errs.length > 0) {
        // heuristicDraft falls back to a valid stub, but guard defensively.
        setWarning(t.workflowsNlCouldNotParseNote)
      } else if (spec.steps.length === 0 && text.trim().length > 0) {
        setWarning(t.workflowsNlCouldNotParseNote)
      }
      onDraft(spec)
    })
  }

  return (
    <div data-testid="nl-draft-textarea" className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="nl-draft-input">{t.workflowsNlTextareaLabel}</Label>
        <Textarea
          id="nl-draft-input"
          data-testid="nl-draft-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.workflowsNlTextareaPlaceholder}
          rows={5}
          disabled={disabled || pending}
          className="font-sans text-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          data-testid="nl-draft-button"
          onClick={handleDraft}
          disabled={disabled || pending || text.trim().length === 0}
        >
          {pending ? t.workflowsDraftBtnPending : t.workflowsDraftBtn}
        </Button>
        {warning && (
          <span
            data-testid="nl-draft-warning"
            className="text-xs text-[color:var(--text-muted,#8a8a8c)]"
          >
            {warning}
          </span>
        )}
      </div>
    </div>
  )
}
