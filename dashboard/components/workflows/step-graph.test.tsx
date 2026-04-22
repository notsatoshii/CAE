/**
 * StepGraph tests — SSR-rendered structural assertions.
 *
 * Uses react-dom/server `renderToStaticMarkup` to render the component to
 * static HTML, then matches against substrings. Run via:
 *   npx tsx components/workflows/step-graph.test.tsx
 */

import { renderToStaticMarkup } from "react-dom/server"
import test from "node:test"
import { strict as assert } from "node:assert"
import { StepGraph } from "./step-graph"
import type { WorkflowSpec } from "../../lib/cae-workflows"

const threeStepSpec: WorkflowSpec = {
  name: "x",
  trigger: { type: "manual" },
  steps: [
    { agent: "forge", task: "build" },
    { gate: "approval", notify: "telegram" },
    { action: "push" },
  ],
}

const fourStepMixed: WorkflowSpec = {
  name: "mixed",
  trigger: { type: "manual" },
  steps: [
    { agent: "sentinel", task: "review" },
    { gate: "auto" },
    { action: "branch" },
    { agent: "forge", task: "deploy" },
  ],
}

test("renders 3 step boxes with kind data attrs", () => {
  const html = renderToStaticMarkup(<StepGraph spec={threeStepSpec} />)
  assert.match(html, /data-testid="step-graph"/)
  assert.match(html, /data-step-index="0"/)
  assert.match(html, /data-step-index="1"/)
  assert.match(html, /data-step-index="2"/)
  assert.match(html, /data-step-type="agent"/)
  assert.match(html, /data-step-type="gate"/)
  assert.match(html, /data-step-type="action"/)
  // Color constants per behavior spec.
  assert.match(html, /#00d4ff/)
  assert.match(html, /#f59e0b/)
  assert.match(html, /#10b981/)
})

test("aria-label includes step count", () => {
  const html = renderToStaticMarkup(<StepGraph spec={threeStepSpec} />)
  assert.match(html, /aria-label="Workflow step graph, 3 steps"/)
})

test("4-step mixed spec keeps every kind distinct", () => {
  const html = renderToStaticMarkup(<StepGraph spec={fourStepMixed} />)
  assert.match(html, /data-step-index="3"/)
  // Each step type appears at least once.
  assert.match(html, /data-step-type="agent"/)
  assert.match(html, /data-step-type="gate"/)
  assert.match(html, /data-step-type="action"/)
})

test("empty spec renders empty placeholder", () => {
  const html = renderToStaticMarkup(<StepGraph spec={null} />)
  assert.match(html, /step-graph-empty/)
  assert.match(html, /No steps yet/)
})

test("spec with zero steps also renders empty placeholder", () => {
  const html = renderToStaticMarkup(
    <StepGraph
      spec={{ name: "empty", trigger: { type: "manual" }, steps: [] }}
    />,
  )
  assert.match(html, /step-graph-empty/)
})
