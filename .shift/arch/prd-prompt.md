<persona>

</persona>

<task>
Draft a PRD (Product Requirements Document) for this project, at `/home/cae-dashboard/.shift/PRD.md`.

CRITICAL — audience is a NON-TECHNICAL founder. Every section must be readable
by someone who cannot code. No file paths, no API names, no stack jargon unless
defined in-line.

Project: cae-dashboard
Idea: A unified web dashboard for the Ctrl+Alt+Elite (CAE) ecosystem. Two modes: Build (wraps Shift's mentor flow — idea→PRD→ROADMAP→build) for founders building products; Ops (observability into CAE internals — running phases, inbox/outbox delegation queue, agent activity, metrics, circuit breakers, branch manager, dangerous-action queue) for pro operators. Same auth, same design system, mode toggle in top nav.
Audience: Two audiences in one app: non-technical founders using Build mode (Shift UX), and pro developers / operators using Ops mode (CAE monitoring). Same user often switches between modes.
Type: web-app

Scout's research brief:
(no brief available — use your best judgment)
</task>

<format>
Write `/home/cae-dashboard/.shift/PRD.md` with EXACTLY these sections:

# cae-dashboard — Product Requirements

## What it is
One paragraph, plain English.

## Who it's for
One paragraph describing the target user and their current pain.

## What a user can do (core flows)
3-6 bullet points, each a complete user story in plain English:
"As a [user], I can [action] so that [outcome]."

## What it looks like
Plain-English description of the main screens/surfaces — just enough that
the user can visualize. No UI framework jargon.

## What's NOT in v1
Explicit list of things we're deferring. Protect scope.

## How we'll know it works
3-5 testable success criteria, each in plain English.

## Tech approach (one paragraph, plain English)
Name the main pieces — "a website built with [framework], data stored in a
[database type], hosted on [provider]." If you mention a technology, add a
one-line in-plain-English explanation the first time.

Target length: 200-400 lines. Print 'PRD WRITTEN' when done.
</format>
