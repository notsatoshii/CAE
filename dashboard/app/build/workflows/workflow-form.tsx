"use client"

// Phase 9 Wave 3 (09-06): WorkflowForm / edit-workflow page has no Run-now button.
// The only run entry point is the workflows-list page (WorkflowsListClient), which
// is now gated via useGatedAction + ConfirmActionDialog.

/**
 * WorkflowForm — unified create/edit form for workflows.
 *
 * Single source of truth: the `yaml` string held in component state.
 * `spec` is DERIVED from the yaml on every render via `parseWorkflow`
 * (cheap pure computation). Every editing surface — the NL draft
 * button, the Monaco YAML editor, and the name input — writes back to
 * the same yaml state. The StepGraph preview and validation errors
 * follow directly.
 *
 * Mode gating:
 *  - Dev-mode OFF (founder): NlDraftTextarea visible, Monaco hidden.
 *  - Dev-mode ON: MonacoYamlEditor visible, NL textarea hidden.
 *  - Switching modes mid-edit DOES NOT lose yaml state — both surfaces
 *    operate on the same string.
 *
 * Save routes by `mode`: POST /api/workflows (create) or
 * PUT /api/workflows/{slug} (edit). Delete (edit-only) DELETEs the
 * workflow after a window.confirm gate.
 *
 * Pure-schema imports: `parseWorkflow`, `serializeWorkflow`,
 * `validateWorkflow` come from `@/lib/cae-workflows-schema` (not
 * `@/lib/cae-workflows`) so the fs/promises imports on the disk-I/O
 * side of the domain layer do not leak into the client bundle. See
 * Plan 06-04 deviation Rule 3 for context.
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor } from "@/lib/copy/labels"
import { StepGraph } from "@/components/workflows/step-graph"
import { MonacoYamlEditor } from "@/components/workflows/monaco-yaml-editor"
import { NlDraftTextarea } from "@/components/workflows/nl-draft-textarea"
import {
  parseWorkflow,
  serializeWorkflow,
  validateWorkflow,
} from "@/lib/cae-workflows-schema"
import type {
  WorkflowSpec,
  WorkflowRecord,
  ValidationError,
} from "@/lib/cae-workflows-schema"

export interface WorkflowFormProps {
  mode: "create" | "edit"
  initial?: WorkflowRecord // required when mode === "edit"
}

const STARTER_YAML = [
  "name: new-recipe",
  "description: \"\"",
  "trigger:",
  "  type: manual",
  "steps: []",
  "",
].join("\n")

export function WorkflowForm({ mode, initial }: WorkflowFormProps) {
  const router = useRouter()
  const { dev } = useDevMode()
  const t = labelFor(dev)

  const [yaml, setYaml] = useState<string>(initial?.yaml ?? STARTER_YAML)
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [pending, startTransition] = useTransition()

  // Derive spec + errors from current YAML on every render — cheap pure
  // computation. If the last save set explicit errors via setErrors, prefer
  // those; otherwise surface the live parser errors.
  const parsed = parseWorkflow(yaml)
  const spec: WorkflowSpec | null = parsed.spec
  const liveErrors: ValidationError[] =
    parsed.errors.length > 0 ? parsed.errors : errors

  function handleDraft(draftedSpec: WorkflowSpec) {
    // In edit mode, if the draft emits the default "new-recipe" name,
    // preserve the existing record's name so renaming requires explicit
    // intent. In create mode, the draft wins.
    const preserveName =
      mode === "edit" &&
      initial?.spec?.name &&
      draftedSpec.name === "new-recipe"
    const merged: WorkflowSpec = preserveName
      ? { ...draftedSpec, name: initial!.spec.name }
      : draftedSpec
    setYaml(serializeWorkflow(merged))
    setErrors([])
  }

  async function handleSave() {
    if (!spec) {
      setErrors(parsed.errors)
      toast.error(t.workflowsValidationErrorHeading)
      return
    }
    const validationErrors = validateWorkflow(spec)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      toast.error(t.workflowsValidationErrorHeading)
      return
    }
    const url =
      mode === "create"
        ? "/api/workflows"
        : "/api/workflows/" + encodeURIComponent(initial!.slug)
    const method = mode === "create" ? "POST" : "PUT"
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ yaml }),
    })
    if (!res.ok) {
      const body = await res
        .json()
        .catch(() => ({
          errors: [{ path: "http", message: "HTTP " + res.status }],
        }))
      setErrors(body.errors ?? [{ path: "http", message: "save failed" }])
      toast.error(t.workflowsValidationErrorHeading)
      return
    }
    toast.success(mode === "create" ? "Recipe saved" : "Changes saved")
    router.push("/build/workflows")
    router.refresh()
  }

  async function handleDelete() {
    if (mode !== "edit" || !initial) return
    if (
      typeof window !== "undefined" &&
      !window.confirm(t.workflowsDeleteConfirm(initial.spec.name))
    )
      return
    const res = await fetch(
      "/api/workflows/" + encodeURIComponent(initial.slug),
      { method: "DELETE" },
    )
    if (!res.ok) {
      toast.error("Delete failed")
      return
    }
    toast.success("Recipe deleted")
    router.push("/build/workflows")
    router.refresh()
  }

  return (
    <div
      data-testid="workflow-form"
      data-mode={mode}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      {/* Left: input (NL in founder mode, Monaco in dev mode) */}
      <div className="space-y-4">
        {!dev && (
          <section data-testid="workflow-form-nl-section">
            <NlDraftTextarea onDraft={handleDraft} />
          </section>
        )}
        {dev && (
          <section data-testid="workflow-form-yaml-section">
            <h3 className="text-sm font-semibold mb-2">
              {t.workflowsAdvancedYamlHeading}
            </h3>
            <MonacoYamlEditor value={yaml} onChange={setYaml} height={420} />
          </section>
        )}

        {liveErrors.length > 0 && (
          <div
            data-testid="workflow-form-errors"
            role="alert"
            className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200 space-y-1"
          >
            <div className="font-semibold">
              {t.workflowsValidationErrorHeading}
            </div>
            <ul className="list-disc list-inside">
              {liveErrors.map((e, i) => (
                <li key={i}>
                  <span className="font-mono">{e.path}</span>: {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            type="button"
            data-testid="workflow-form-save"
            disabled={pending || !spec}
            onClick={() => startTransition(() => void handleSave())}
          >
            {pending ? t.workflowsSaveBtnPending : t.workflowsSaveBtn}
          </Button>
          {mode === "edit" && (
            <Button
              type="button"
              data-testid="workflow-form-delete"
              variant="outline"
              onClick={() => void handleDelete()}
            >
              {t.workflowsDeleteBtn}
            </Button>
          )}
        </div>
      </div>

      {/* Right: step graph preview + name input — always visible */}
      <aside data-testid="workflow-form-preview" className="space-y-2">
        <h3 className="text-sm font-semibold">{t.workflowsStepGraphHeading}</h3>
        <div className="rounded-lg border border-[color:var(--border,#1f1f22)] bg-[color:var(--surface,#121214)] p-6 min-h-[200px] flex flex-col">
          {spec ? (
            <StepGraph spec={spec} />
          ) : (
            /* Empty state: no workflow selected / YAML invalid */
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <p className="text-[13px] text-[color:var(--text-muted,#8a8a8c)]">
                Enter workflow details to preview the step graph
              </p>
            </div>
          )}
        </div>
        {/* Name field lives outside the dev-mode gate so founder-mode
            users can rename a drafted recipe without flipping dev-mode. */}
        <div className="pt-2 space-y-1">
          <Label htmlFor="workflow-name">Name</Label>
          <Input
            id="workflow-name"
            data-testid="workflow-form-name"
            value={spec?.name ?? ""}
            onChange={(e) => {
              // Re-serialize the yaml with the new name. If spec is null
              // (yaml invalid), skip — fix YAML first.
              if (!spec) return
              setYaml(serializeWorkflow({ ...spec, name: e.target.value }))
            }}
            disabled={!spec}
          />
        </div>
      </aside>
    </div>
  )
}
