<objective>
Phase 22 Task: Wire Historical Load into FloorClient
</objective>

<task_spec>
<name>Wire Historical Load into FloorClient</name>
<files>dashboard/components/floor/floor-client.tsx</files>
<action>
Add automatic historical hydration on component mount:
- useEffect fetches /api/cb-tail?limit=5000 on mount
- Parses circuit-breaker events and reconstructs lifecycles
- Filters to last 4 hours (configurable)
- Stores in component state: historicalAgents
- Passes to canvas for ghost rendering + sidebar for display

Non-blocking fetch (errors silently logged), only runs on mount.
</action>
<verify>
npm run dev &
Navigate to /floor
Check browser console for no errors
Verify historical agents load (if CB file has events)
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
