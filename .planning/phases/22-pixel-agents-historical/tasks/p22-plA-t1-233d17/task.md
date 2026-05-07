<objective>
Phase 22 Task: Parse Circuit-Breaker Events
</objective>

<task_spec>
<name>Parse Circuit-Breaker Events</name>
<files>dashboard/lib/floor/parse-circuit-breaker.ts</files>
<action>
Create pure utility functions to extract and reconstruct agent lifecycles from circuit-breaker JSONL:
- parseCircuitBreakerEvents(lines: string[]): ParsedCbEvent[]
- reconstructAgentLifecycles(events: ParsedCbEvent[]): AgentLifecycle[]
- deriveStation(taskId: string): StationName
- parseTimestamp(ts: string | number): number

Handle event types: forge_begin, forge_end, tool_call
Add 16 unit tests covering timestamp parsing, station derivation, event parsing, lifecycle reconstruction.
</action>
<verify>
npm run test dashboard/lib/floor/parse-circuit-breaker.test.ts
Verify 16/16 tests pass
</verify>
</task_spec>

<files_to_read>
- .planning/phases/22-pixel-agents-historical/22-pixel-agents-historical-PLAN.md (your plan)
- .planning/PROJECT.md (project context)
- .planning/STATE.md (current state)
</files_to_read>


<tool_budgets>
- Read: respect a soft cap of 2000 output tokens per call; truncate verbose results
- Grep: respect a soft cap of 1000 output tokens per call; truncate verbose results
- Bash: respect a soft cap of 3000 output tokens per call; truncate verbose results
</tool_budgets>

<instructions>
Implement the task per the plan. Match AGENTS.md conventions.
Make ALL changes, then commit with a concise message.
When done, return a brief SUMMARY in this format:

## SUMMARY
- Changed: {list of files}
- Tests: {passed/failed}
- Notes: {anything Sentinel or Scribe should know}
</instructions>
