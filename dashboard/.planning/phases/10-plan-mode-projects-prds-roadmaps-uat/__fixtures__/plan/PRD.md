# Founder Accountability App — PRD

## Problem

Solo founders struggle to maintain momentum without external accountability. Without a team or a manager, it's easy to defer hard decisions, skip commitments, or drift from the core vision. Existing tools (Notion, Linear, Asana) are built for teams — they don't address the lone-founder context.

## Who We're Building For

**Primary user:** Solo founder, pre-seed or bootstrapped. Has a clear vision but no co-founder. Checks in with advisors monthly at best. Needs daily structure.

**Secondary user:** Indie hacker / solopreneur shipping their first product. Familiar with code; frustrated by management overhead.

## Success Criteria

- User can capture a daily commitment in under 60 seconds.
- Accountability streaks are visible and motivating (daily/weekly).
- App sends one push notification at a user-chosen time (no spam).
- First-time user reaches first accountability check-in within 3 minutes of sign-up.
- P99 page load < 1 second on 4G mobile.

## Scope — v1.0

### In scope

- Daily commitment capture (one text field)
- Streak counter (days with at least one commitment kept)
- End-of-day check-in prompt (kept / missed / partial)
- Push notifications via web-push
- GitHub OAuth sign-in (no email/password complexity)
- Public accountability URL shareable to a coach or peer

### Out of scope for v1

- Team / multi-user features
- Native mobile apps (PWA only)
- Paid tiers
- Calendar sync
- AI-generated commitments
