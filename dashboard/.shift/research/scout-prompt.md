<task>
Produce a research brief for this project. Target file: `.shift/research/SCOUT.md`.

Project: cae-dashboard
Idea: A unified web dashboard for the Ctrl+Alt+Elite (CAE) ecosystem. Two modes: Build (wraps Shift's mentor flow — idea→PRD→ROADMAP→build) for founders building products; Ops (observability into CAE internals — running phases, inbox/outbox delegation queue, agent activity, metrics, circuit breakers, branch manager, dangerous-action queue) for pro operators. Same auth, same design system, mode toggle in top nav.
Audience: Two audiences in one app: non-technical founders using Build mode (Shift UX), and pro developers / operators using Ops mode (CAE monitoring). Same user often switches between modes.
Product type: web-app

Constraints:
- Non-technical founder will read this summary. Use plain English.
- Recommend a stack using CAE's preset for web-app as default if nothing
  in the idea contradicts it.
- Flag any external services that will need API keys (user has to create accounts).
- Call out 1-2 reference products that solve similar problems.
- Keep under 1500 tokens.

Default preset (if nothing contradicts):
(none)
</task>

<format>
Write output directly into `/home/cae-dashboard/.shift/research/SCOUT.md` as markdown with these sections:
  # Research — cae-dashboard
  ## TL;DR
  ## Recommended stack
  ## API keys / accounts the user will need
  ## Reference products
  ## Pitfalls to watch for

When done, print 'RESEARCH WRITTEN'.
</format>
