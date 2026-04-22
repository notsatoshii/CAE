# AGENTS.md — Team Knowledge Base

## Project Conventions

## Patterns That Work
- Task status: branch pattern `forge/p{N}-pl{letter}-t{id}-*` + git log merges + circuit-breakers.jsonl events = reliable pending/running/merged/failed inference. (phase 2, p2-plA-t1-ee7545) (phase 2, p2-plA-t1-ee7545)
- Poll 3s (breakers) + 5s (phases) on shared `/api/state` endpoint — low overhead, responsive. (phase 2, p2-plA-t1-ebf915) (phase 2, p2-plA-t1-ebf915)
- SSE + EventSource live log tail via ?tail= URL param. Close navigates back param-less. TailSheet wired into phase detail. (phase 2, p2-plA-t1-f69079) (phase 2, p2-plA-t1-f69079)

## Gotchas
- shadcn DropdownMenuTrigger + Avatar incompatible with `asChild` prop — Avatar doesn't support polymorphic render. Use className directly on trigger element instead. (phase 1, p1-plA-t1-c1b4cf)
- base-ui components (Tabs, DropdownMenu, etc.) don't support `asChild` prop — not polymorphic like Radix. Use `Link` + `cn(buttonVariants(...))` or className directly. (phase 2, p2-plA-t1-e81f6c) (phase 2, p2-plA-t1-e81f6c)
- Circuit-breaker state accumulates all 200-entry tail without time-window — `recentFailures`/`recentPhantomEscalations` unbounded. Add date-based filter. (phase 2, p2-plA-t1-b12bb5) (phase 2, p2-plA-t1-b12bb5)
- CAE phase/task logs in `.cae/logs/` must be in `ALLOWED_ROOTS` for SSE tail routing. Initial plan omitted it. (phase 2, p2-plA-t1-f69079) (phase 2, p2-plA-t1-f69079)

## Library/API Notes
- NextAuth v5 route.ts must re-export: `import { handlers } from "@/auth"; export const { GET, POST } = handlers`. GET/POST are handler object properties, not direct auth.ts exports. (phase 1, p1-plA-t1-c0416e)
- DONE.md is YAML frontmatter only (strip `---` prefix, parse with yaml). No markdown body. (phase 2, p2-plA-t1-b12bb5) (phase 2, p2-plA-t1-b12bb5)
