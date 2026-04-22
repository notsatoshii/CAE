# Founder Accountability App — Roadmap

## Phase 1: Foundation
Goal: ship the authenticated shell with daily commitment capture.

Definition of done:
- GitHub OAuth sign-in works end-to-end
- Home page renders with empty-state illustration
- Daily commitment form saves to database
- Unit tests pass (>90% coverage on lib layer)
- Deployed to staging with zero downtime deploy

## Phase 2: Streaks and check-ins
Goal: make accountability visible and stickiness-inducing.

Definition of done:
- Streak counter increments on each kept commitment
- End-of-day check-in prompt renders at user-configured time
- Push notification fires within ±5 minutes of target time
- Missed days shown in streak history with reason field

## Phase 3: Polish and share
Goal: make the product shareable and production-ready.

Definition of done:
- Public accountability URL (/u/:handle) renders without auth
- Empty states exist for all list views
- Keyboard shortcuts documented in a help modal
- Lighthouse performance score ≥ 90 on mobile
- WCAG AA color contrast passes for all interactive elements
