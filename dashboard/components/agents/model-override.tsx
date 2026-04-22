"use client"

/**
 * ModelOverride — model select + Save button for an agent in the detail
 * drawer. Save action is a STUB in Phase 5: logs to console + shows toast.
 * Full server wiring is deferred (CONTEXT §Not in scope — "Model override
 * server wiring stubbed in Phase 5").
 *
 * Hardcoded model list per CONTEXT §Claude's Discretion. If the agent's
 * current model isn't in the list, we fall back to a sensible default so
 * the `<select>` still renders a valid value.
 */

import { useState } from "react"
import { toast } from "sonner"
import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor } from "@/lib/copy/labels"
import { Button } from "@/components/ui/button"

const MODEL_OPTIONS = [
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-6",
  "claude-opus-4-7",
  "claude-opus-4-7-1m",
] as const

type ModelOption = (typeof MODEL_OPTIONS)[number]

interface ModelOverrideProps {
  agentName: string
  currentModel: string
}

export function ModelOverride({ agentName, currentModel }: ModelOverrideProps) {
  const { dev } = useDevMode()
  const t = labelFor(dev)
  const initial: string = (MODEL_OPTIONS as readonly string[]).includes(
    currentModel,
  )
    ? currentModel
    : (MODEL_OPTIONS[1] satisfies ModelOption)
  const [value, setValue] = useState<string>(initial)

  function save() {
    // STUB: real wiring deferred (CONTEXT §Detail drawer — server action stubbed).
    console.info(
      "[model-override] would set model for " + agentName + " → " + value,
    )
    toast.info("Model override noted — full wiring coming in a later phase", {
      description: agentName + " → " + value,
    })
  }

  return (
    <div data-testid="model-override" className="flex flex-col gap-2">
      <label
        htmlFor={"model-select-" + agentName}
        className="text-sm text-[color:var(--text-muted,#8a8a8c)]"
      >
        {t.agentsDrawerModelOverrideHeading}
      </label>
      <div className="flex items-center gap-2">
        <select
          id={"model-select-" + agentName}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          data-testid="model-override-select"
          className="flex-1 rounded-md border border-[color:var(--border-strong,#2a2a2e)] bg-[color:var(--surface,#121214)] px-2 py-1.5 text-sm font-mono"
        >
          {MODEL_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={save}
          data-testid="model-override-save"
        >
          {t.agentsDrawerModelSaveLabel}
        </Button>
      </div>
    </div>
  )
}
