/**
 * StepGraph — SSR-safe, hand-rolled SVG preview of a WorkflowSpec.
 *
 * Vertical stack of ~48px rectangles; stroke color per kind (agent/gate/
 * action). No flowchart library — direct SVG primitives mirroring
 * components/ui/sparkline.tsx. Color tokens per UI-SPEC §13.
 */

import type { WorkflowSpec, WorkflowStep } from "@/lib/cae-workflows"
import { agentMetaFor } from "@/lib/copy/agent-meta"

const COLORS = { agent: "#00d4ff", gate: "#f59e0b", action: "#10b981" } as const
const BOX_WIDTH = 240
const BOX_HEIGHT = 48
const ARROW_GAP = 30
const STEP_PITCH = BOX_HEIGHT + ARROW_GAP

type StepKind = "agent" | "gate" | "action"

function classifyStep(step: WorkflowStep): StepKind {
  if ("agent" in step) return "agent"
  if ("gate" in step) return "gate"
  return "action"
}

function stepLabel(step: WorkflowStep): string {
  if ("agent" in step) {
    const meta = agentMetaFor(step.agent)
    const task =
      step.task.length > 32 ? step.task.slice(0, 32) + "…" : step.task
    return meta.emoji + "  " + meta.label + " — " + task
  }
  if ("gate" in step) {
    const label = step.gate === "approval" ? "Approval" : "Auto"
    return "🛑 Gate — " + label
  }
  const action = step.action.charAt(0).toUpperCase() + step.action.slice(1)
  return "⚡ Action — " + action
}

export interface StepGraphProps {
  spec: WorkflowSpec | null
  width?: number
  className?: string
}

export function StepGraph({
  spec,
  width = BOX_WIDTH + 32,
  className,
}: StepGraphProps) {
  if (!spec || spec.steps.length === 0) {
    return (
      <div
        data-testid="step-graph-empty"
        className={
          "text-xs text-[color:var(--text-muted,#8a8a8c)] italic py-6 text-center " +
          (className ?? "")
        }
      >
        No steps yet
      </div>
    )
  }

  const height = spec.steps.length * STEP_PITCH - ARROW_GAP + 16

  return (
    <svg
      data-testid="step-graph"
      role="img"
      aria-label={"Workflow step graph, " + spec.steps.length + " steps"}
      width={width}
      height={height}
      viewBox={"0 0 " + width + " " + height}
      className={className}
    >
      {spec.steps.map((step, i) => {
        const kind = classifyStep(step)
        const color = COLORS[kind]
        const x = (width - BOX_WIDTH) / 2
        const y = i * STEP_PITCH + 8
        return (
          <g
            key={i}
            data-testid="step-box"
            data-step-index={i}
            data-step-type={kind}
            data-step-color={color}
          >
            <rect
              x={x}
              y={y}
              width={BOX_WIDTH}
              height={BOX_HEIGHT}
              rx={6}
              ry={6}
              fill="rgba(255,255,255,0.02)"
              stroke={color}
              strokeWidth={1.5}
            />
            <text
              x={x + 12}
              y={y + BOX_HEIGHT / 2 + 4}
              fill="var(--text, #e5e5e5)"
              fontFamily="var(--font-geist-sans, system-ui)"
              fontSize="12"
            >
              {stepLabel(step)}
            </text>
            {i < spec.steps.length - 1 && (
              <>
                <line
                  x1={width / 2}
                  y1={y + BOX_HEIGHT}
                  x2={width / 2}
                  y2={y + BOX_HEIGHT + ARROW_GAP - 6}
                  stroke="var(--border, #1f1f22)"
                  strokeWidth={1.5}
                />
                <polygon
                  points={
                    (width / 2 - 4) +
                    "," +
                    (y + BOX_HEIGHT + ARROW_GAP - 8) +
                    " " +
                    (width / 2 + 4) +
                    "," +
                    (y + BOX_HEIGHT + ARROW_GAP - 8) +
                    " " +
                    width / 2 +
                    "," +
                    (y + BOX_HEIGHT + ARROW_GAP - 2)
                  }
                  fill="var(--border, #1f1f22)"
                />
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}
